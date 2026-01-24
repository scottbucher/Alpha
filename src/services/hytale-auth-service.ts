import fetchCookie from 'fetch-cookie';
import { ImapFlow } from 'imapflow';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { URL } from 'node:url';
import { CookieJar } from 'tough-cookie';

import { Logger } from './index.js';

interface TwoFactorChallenge {
    flowId: string;
    csrfToken: string;
    emailAddress: string;
}

export class HytaleAuthService {
    private email: string;
    private password: string;
    private gmailAppPassword: string | null;
    private isLoggingIn = false;
    private cookieJar: CookieJar;
    private fetchWithCookies: typeof globalThis.fetch;
    private cachePath: string | null;
    private cacheLoaded = false;

    constructor(
        email: string,
        password: string,
        gmailAppPassword: string | null = null,
        cachePath: string | null = null
    ) {
        this.email = email;
        this.password = password;
        this.gmailAppPassword = gmailAppPassword;
        this.cachePath = cachePath;
        this.cookieJar = new CookieJar();
        this.fetchWithCookies = fetchCookie(globalThis.fetch, this.cookieJar);
    }

    private loadFromCache(): void {
        if (this.cacheLoaded || !this.cachePath) return;
        this.cacheLoaded = true;

        try {
            if (existsSync(this.cachePath)) {
                const data = readFileSync(this.cachePath, 'utf-8');
                const serialized = JSON.parse(data);
                this.cookieJar = CookieJar.deserializeSync(serialized);
                this.fetchWithCookies = fetchCookie(globalThis.fetch, this.cookieJar);
                Logger.info('Hytale session cache loaded');
            }
        } catch {
            // Cache is invalid or corrupted, start fresh
        }
    }

    private async saveToCache(): Promise<void> {
        if (!this.cachePath) return;

        try {
            const dir = dirname(this.cachePath);
            mkdirSync(dir, { recursive: true });
            const serialized = await this.cookieJar.serialize();
            writeFileSync(this.cachePath, JSON.stringify(serialized, null, 2));
        } catch {
            // Failed to save cache, not critical
        }
    }

    private isSessionValid(): boolean {
        const accountsCookies = this.cookieJar.getCookiesSync('https://accounts.hytale.com');
        const backendCookies = this.cookieJar.getCookiesSync('https://backend.accounts.hytale.com');
        const allCookies = [...accountsCookies, ...backendCookies];

        const sessionCookie = allCookies.find(c => c.key === 'ory_kratos_session');
        if (!sessionCookie?.expires) return false;

        // Consider session invalid 5 minutes before actual expiry for safety margin
        const expiresAt = new Date(sessionCookie.expires).getTime();
        return Date.now() < expiresAt - 5 * 60 * 1000;
    }

    private async fetchVerificationCodeFromGmail(triggeredAt: Date): Promise<string> {
        if (!this.gmailAppPassword) {
            throw new Error('Gmail app password not configured for 2FA email retrieval');
        }

        const client = new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: {
                user: this.email,
                pass: this.gmailAppPassword,
            },
            logger: false,
        });

        try {
            await client.connect();
            const lock = await client.getMailboxLock('INBOX');

            try {
                // Search for recent Hytale emails (1 min before trigger to account for clock skew)
                const searchSince = new Date(triggeredAt.getTime() - 60 * 1000);

                const searchResult = await client.search({
                    from: 'support@hytale.com',
                    since: searchSince,
                });

                const messages = Array.isArray(searchResult) ? searchResult : [];

                if (messages.length === 0) {
                    throw new Error('No Hytale verification email found');
                }

                // Check messages from most recent to oldest
                for (let i = messages.length - 1; i >= 0; i--) {
                    const uid = messages[i];
                    const fetchResult = await client.fetchOne(uid, {
                        source: true,
                        envelope: true,
                    });

                    if (!fetchResult || !fetchResult.source) continue;

                    // Skip emails older than when we triggered the code send
                    const emailDate = fetchResult.envelope?.date;
                    if (emailDate && new Date(emailDate) < triggeredAt) {
                        continue;
                    }

                    const emailContent = fetchResult.source.toString();

                    // Look for the code in Hytale's email format
                    let codeMatch = emailContent.match(/Your login code[:\s]*\n*\s*(\d{6})/i);
                    if (!codeMatch) {
                        codeMatch = emailContent.match(/code[:\s]+(\d{6})/i);
                    }
                    if (!codeMatch) {
                        codeMatch = emailContent.match(/\b(\d{6})\b/);
                    }

                    if (codeMatch) {
                        return codeMatch[1];
                    }
                }

                throw new Error('Could not find verification code in any recent email');
            } finally {
                lock.release();
            }
        } finally {
            await client.logout();
        }
    }

    private async complete2FA(challenge: TwoFactorChallenge): Promise<void> {
        // Record when we trigger the code send for email filtering
        const codeTriggeredAt = new Date();

        // Step 1: Request the code to be sent
        const sendCodeForm = new URLSearchParams({
            csrf_token: challenge.csrfToken,
            address: challenge.emailAddress,
        });

        const sendResponse = await this.fetchWithCookies(
            `https://backend.accounts.hytale.com/self-service/login?flow=${challenge.flowId}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: sendCodeForm,
                redirect: 'manual',
            }
        );

        if (sendResponse.status !== 303 && sendResponse.status !== 200) {
            const body = await sendResponse.text();
            throw new Error(`Failed to trigger 2FA code send: ${sendResponse.status} - ${body.slice(0, 200)}`);
        }

        // Step 2: Wait for email and fetch code with retries
        let code: string | null = null;
        const maxAttempts = 6;
        const delayBetweenAttempts = 5000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));

            try {
                code = await this.fetchVerificationCodeFromGmail(codeTriggeredAt);
                break;
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw error;
                }
            }
        }

        if (!code) {
            throw new Error('Failed to retrieve 2FA code from email after all attempts');
        }

        // Step 3: Get the updated flow to extract form fields
        const flowResponse = await this.fetchWithCookies(
            `https://backend.accounts.hytale.com/self-service/login/flows?id=${challenge.flowId}`,
            { headers: { Accept: 'application/json' } }
        );

        const flowData = (await flowResponse.json()) as {
            ui?: {
                nodes?: Array<{
                    attributes?: { name?: string; value?: string; type?: string };
                }>;
            };
        };

        // Extract required form fields
        const csrfNode = flowData.ui?.nodes?.find(n => n.attributes?.name === 'csrf_token');
        const identifierNode = flowData.ui?.nodes?.find(
            n => n.attributes?.name === 'identifier' && n.attributes?.type === 'hidden'
        );
        const methodNode = flowData.ui?.nodes?.find(
            n => n.attributes?.name === 'method' && n.attributes?.type === 'hidden'
        );

        const freshCsrfToken = csrfNode?.attributes?.value || challenge.csrfToken;
        const identifier = identifierNode?.attributes?.value || challenge.emailAddress;
        const method = methodNode?.attributes?.value || 'code';

        // Step 4: Submit the code
        const submitCodeForm = new URLSearchParams({
            csrf_token: freshCsrfToken,
            identifier: identifier,
            method: method,
            code: code,
        });

        const submitResponse = await this.fetchWithCookies(
            `https://backend.accounts.hytale.com/self-service/login?flow=${challenge.flowId}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: submitCodeForm,
                redirect: 'manual',
            }
        );

        const redirectLocation = submitResponse.headers.get('location');

        if (submitResponse.status !== 303 || !redirectLocation) {
            const body = await submitResponse.text();
            throw new Error(`2FA code submission failed: ${submitResponse.status} - ${body.slice(0, 200)}`);
        }

        // Step 5: Follow redirect to complete authentication
        await this.fetchWithCookies(redirectLocation, {
            redirect: 'follow',
            headers: { Accept: 'application/json' },
        });
    }

    private async login(): Promise<void> {
        if (this.isLoggingIn) {
            while (this.isLoggingIn) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        this.isLoggingIn = true;

        try {
            const initResponse = await this.fetchWithCookies(
                'https://backend.accounts.hytale.com/self-service/login/browser',
                { redirect: 'manual' }
            );

            const location = initResponse.headers.get('location');
            if (!location) {
                throw new Error(
                    `Could not extract flow ID. Status: ${initResponse.status}, no location header`
                );
            }

            const flowMatch = location.match(/flow=([a-f0-9-]+)/);
            if (!flowMatch) {
                throw new Error(`Could not extract flow ID from location: ${location}`);
            }
            const flowId = flowMatch[1];

            const cookies = await this.cookieJar.getCookies('https://backend.accounts.hytale.com');
            const csrfCookie = cookies.find(c => c.key.startsWith('csrf_token'));
            if (!csrfCookie) {
                throw new Error('Could not find CSRF token cookie');
            }

            const formData = new URLSearchParams({
                csrf_token: csrfCookie.value,
                identifier: this.email,
                password: this.password,
                method: 'password',
            });

            const loginResponse = await this.fetchWithCookies(
                `https://backend.accounts.hytale.com/self-service/login?flow=${flowId}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData,
                    redirect: 'manual',
                }
            );

            const redirectLocation = loginResponse.headers.get('location');

            // Check if 2FA is required
            if (redirectLocation?.includes('aal=aal2') || redirectLocation?.includes('aal2')) {
                const aal2FlowMatch = redirectLocation.match(/flow=([a-f0-9-]+)/);
                const aal2FlowId = aal2FlowMatch ? aal2FlowMatch[1] : flowId;

                const twoFactorResponse = await this.fetchWithCookies(redirectLocation, {
                    headers: { Accept: 'application/json' },
                });

                const twoFactorData = (await twoFactorResponse.json()) as {
                    id?: string;
                    ui?: {
                        nodes?: Array<{
                            group?: string;
                            attributes?: { name?: string; value?: string };
                        }>;
                    };
                };

                const nodes = twoFactorData.ui?.nodes || [];
                const csrfNode = nodes.find(n => n.attributes?.name === 'csrf_token');
                const emailNode = nodes.find(
                    n => n.group === 'code' && n.attributes?.name === 'address'
                );

                if (!csrfNode?.attributes?.value) {
                    throw new Error('Could not find CSRF token in 2FA flow');
                }

                Logger.info('Completing 2FA authentication...');
                await this.complete2FA({
                    flowId: twoFactorData.id || aal2FlowId,
                    csrfToken: csrfNode.attributes.value,
                    emailAddress: emailNode?.attributes?.value || this.email,
                });
                Logger.info('2FA authentication completed');
            } else if (loginResponse.status === 303 && redirectLocation?.includes('/settings')) {
                await this.fetchWithCookies(redirectLocation, { redirect: 'follow' });
            } else {
                const body = await loginResponse.text();
                throw new Error(`Login failed: ${loginResponse.status} - ${body.slice(0, 200)}`);
            }

            await this.saveToCache();
        } finally {
            this.isLoggingIn = false;
        }
    }

    public async ensureLoggedIn(): Promise<void> {
        this.loadFromCache();
        if (this.isSessionValid()) return;
        await this.login();
    }

    public async get(url: string | URL): Promise<globalThis.Response> {
        await this.ensureLoggedIn();

        let response = await this.fetchWithCookies(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });

        // Check if the response is a 2FA challenge (session has AAL1 but endpoint requires AAL2)
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json') && response.ok) {
            const clonedResponse = response.clone();
            try {
                const body = (await clonedResponse.json()) as {
                    id?: string;
                    requested_aal?: string;
                    state?: string;
                    ui?: {
                        nodes?: Array<{
                            group?: string;
                            attributes?: { name?: string; value?: string };
                        }>;
                    };
                };

                if (body.requested_aal === 'aal2' || body.state === 'choose_method') {
                    if (!this.gmailAppPassword) {
                        throw new Error(
                            'Two-factor authentication required but Gmail app password not configured.'
                        );
                    }

                    const nodes = body.ui?.nodes || [];
                    const csrfNode = nodes.find(n => n.attributes?.name === 'csrf_token');
                    const emailNode = nodes.find(
                        n => n.group === 'code' && n.attributes?.name === 'address'
                    );

                    if (!csrfNode?.attributes?.value || !body.id) {
                        throw new Error('Could not extract 2FA challenge details from response');
                    }

                    Logger.info('Completing 2FA authentication...');
                    await this.complete2FA({
                        flowId: body.id,
                        csrfToken: csrfNode.attributes.value,
                        emailAddress: emailNode?.attributes?.value || this.email,
                    });
                    Logger.info('2FA authentication completed');
                    await this.saveToCache();

                    // Retry the original request
                    response = await this.fetchWithCookies(url.toString(), {
                        method: 'GET',
                        headers: {
                            Accept: 'application/json',
                        },
                    });
                }
            } catch (error) {
                if (
                    error instanceof Error &&
                    (error.message.includes('Two-factor authentication') ||
                        error.message.includes('2FA') ||
                        error.message.includes('Gmail') ||
                        error.message.includes('verification'))
                ) {
                    throw error;
                }
                // JSON parsing failed, return original response
            }
        }

        return response;
    }
}
