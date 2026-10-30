import fetchCookie from 'fetch-cookie';
import { ImapFlow } from 'imapflow';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { URL } from 'node:url';
import { Cookie, CookieJar } from 'tough-cookie';

import { Logger } from './index.js';

interface TwoFactorChallenge {
    flowId: string;
    csrfToken: string;
    emailAddress: string;
}

interface LoginFlowUi {
    messages?: Array<{ text?: string; type?: string }>;
    nodes?: Array<{
        group?: string;
        attributes?: { name?: string; value?: string; type?: string };
        messages?: Array<{ text?: string; type?: string }>;
    }>;
}

export type HytaleAuthErrorCode = 'captcha_required' | 'login_failed' | 'session_cookie_invalid';

/**
 * Error thrown when the bot cannot obtain a usable Hytale session. The job treats these as
 * unrecoverable for the current iteration and notifies the configured users.
 */
export class HytaleAuthError extends Error {
    public constructor(
        public readonly code: HytaleAuthErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'HytaleAuthError';
    }
}

const SESSION_COOKIE_NAME = 'ory_kratos_session';
const BACKEND_URL = 'https://backend.accounts.hytale.com';
const COOKIE_DOMAIN = 'hytale.com';
// Once we know the password login is blocked by a captcha, don't hammer Hytale on every run.
const CAPTCHA_BACKOFF_MS = 60 * 60 * 1000;
// Warn (at most once a day) when a manually imported session is about to expire.
const SESSION_EXPIRY_WARNING_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_EXPIRY_WARNING_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const HYTALE_CAPTCHA_HELP =
    'Hytale now requires a Cloudflare Turnstile captcha to log in with a password, which cannot be ' +
    'completed automatically. Log in at https://accounts.hytale.com in a browser, copy the value of ' +
    `the "${SESSION_COOKIE_NAME}" cookie, and set usernameChecker.hytaleSessionCookie in config.json.`;

export class HytaleAuthService {
    private email: string;
    private password: string;
    private gmailAppPassword: string | null;
    private sessionCookie: string | null;
    private rejectedSessionCookie: string | null = null;
    private captchaBlockedUntil = 0;
    private lastExpiryWarningAt = 0;
    private isLoggingIn = false;
    private cookieJar: CookieJar;
    private fetchWithCookies: typeof globalThis.fetch;
    private cachePath: string | null;
    private cacheLoaded = false;

    constructor(
        email: string,
        password: string,
        gmailAppPassword: string | null = null,
        cachePath: string | null = null,
        sessionCookie: string | null = null
    ) {
        this.email = email;
        this.password = password;
        this.gmailAppPassword = gmailAppPassword;
        this.sessionCookie = sessionCookie?.trim() || null;
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

    private getSessionCookie(): Cookie | undefined {
        const accountsCookies = this.cookieJar.getCookiesSync('https://accounts.hytale.com');
        const backendCookies = this.cookieJar.getCookiesSync(BACKEND_URL);
        return [...accountsCookies, ...backendCookies].find(c => c.key === SESSION_COOKIE_NAME);
    }

    /** Expiry of the current session, or null if there is no session with a known expiry. */
    public getSessionExpiry(): Date | null {
        const expires = this.getSessionCookie()?.expires;
        if (!expires || expires === 'Infinity') return null;
        const date = new Date(expires);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    private isSessionValid(): boolean {
        const expiresAt = this.getSessionExpiry()?.getTime();
        if (expiresAt === undefined) return false;

        // Consider session invalid 5 minutes before actual expiry for safety margin
        return Date.now() < expiresAt - 5 * 60 * 1000;
    }

    private warnIfSessionExpiringSoon(): void {
        const expiresAt = this.getSessionExpiry();
        if (!expiresAt) return;

        const remainingMs = expiresAt.getTime() - Date.now();
        if (remainingMs > SESSION_EXPIRY_WARNING_MS) return;
        if (Date.now() - this.lastExpiryWarningAt < SESSION_EXPIRY_WARNING_INTERVAL_MS) return;

        this.lastExpiryWarningAt = Date.now();
        Logger.warn(`Hytale session expires at ${expiresAt.toISOString()}. ${HYTALE_CAPTCHA_HELP}`);
    }

    private async setSessionCookie(value: string, expires?: Date): Promise<void> {
        const cookie = new Cookie({
            key: SESSION_COOKIE_NAME,
            value,
            domain: COOKIE_DOMAIN,
            hostOnly: false,
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            expires: expires ?? 'Infinity',
        });
        await this.cookieJar.setCookie(cookie, BACKEND_URL);
    }

    /**
     * Imports a session cookie that was obtained by logging in through a browser. Hytale's
     * password login is protected by a captcha, so this is the supported way to (re)authenticate
     * the bot. The cookie is validated against the whoami endpoint to learn its expiry.
     *
     * @returns true if the cookie was accepted and the session is now valid.
     */
    private async importSessionCookie(): Promise<boolean> {
        if (!this.sessionCookie || this.sessionCookie === this.rejectedSessionCookie) return false;

        // Don't re-validate a cookie we have already imported (its expiry is already known).
        const existing = this.getSessionCookie();
        if (existing?.value === this.sessionCookie && existing.expires !== 'Infinity') {
            return false;
        }

        await this.setSessionCookie(this.sessionCookie);

        const whoamiResponse = await this.fetchWithCookies(`${BACKEND_URL}/sessions/whoami`, {
            headers: { Accept: 'application/json' },
        });

        if (!whoamiResponse.ok) {
            this.rejectedSessionCookie = this.sessionCookie;
            await this.cookieJar.removeAllCookies();
            Logger.warn(
                `The configured Hytale session cookie was rejected (status ${whoamiResponse.status}). ` +
                    'It has probably expired. Log in again in a browser and update ' +
                    'usernameChecker.hytaleSessionCookie.'
            );
            return false;
        }

        const session = (await whoamiResponse.json()) as {
            active?: boolean;
            expires_at?: string;
            authenticator_assurance_level?: string;
        };

        const expiresAt = session.expires_at ? new Date(session.expires_at) : null;
        if (!session.active || !expiresAt || Number.isNaN(expiresAt.getTime())) {
            this.rejectedSessionCookie = this.sessionCookie;
            await this.cookieJar.removeAllCookies();
            Logger.warn(
                'The configured Hytale session cookie does not belong to an active session.'
            );
            return false;
        }

        await this.setSessionCookie(this.sessionCookie, expiresAt);
        await this.saveToCache();
        Logger.info(
            `Imported Hytale session cookie (${session.authenticator_assurance_level ?? 'unknown aal'}), ` +
                `expires at ${expiresAt.toISOString()}`
        );
        return this.isSessionValid();
    }

    /**
     * Builds a descriptive error for a failed password login by reading the error messages Ory
     * Kratos attached to the login flow (e.g. "Captcha verification failed").
     */
    private async describeLoginFailure(
        flowId: string,
        loginResponse: globalThis.Response
    ): Promise<HytaleAuthError> {
        const messages: string[] = [];
        let captchaRequired = false;

        try {
            const flowResponse = await this.fetchWithCookies(
                `${BACKEND_URL}/self-service/login/flows?id=${flowId}`,
                { headers: { Accept: 'application/json' } }
            );
            const flow = (await flowResponse.json()) as { ui?: LoginFlowUi };

            for (const message of flow.ui?.messages ?? []) {
                if (message.text) messages.push(message.text);
            }
            for (const node of flow.ui?.nodes ?? []) {
                const nodeMessages = node.messages ?? [];
                for (const message of nodeMessages) {
                    if (message.text) messages.push(message.text);
                }
                if (node.group === 'captcha' || node.attributes?.name === 'cf-turnstile-response') {
                    captchaRequired = captchaRequired || nodeMessages.length > 0;
                }
            }
        } catch {
            // Fall through to a generic error below
        }

        if (!captchaRequired) {
            captchaRequired = messages.some(m => /captcha/i.test(m));
        }

        if (captchaRequired) {
            this.captchaBlockedUntil = Date.now() + CAPTCHA_BACKOFF_MS;
            return new HytaleAuthError(
                'captcha_required',
                `Login failed: ${messages.join(' ') || 'captcha verification failed'}. ${HYTALE_CAPTCHA_HELP}`
            );
        }

        let detail = messages.join(' ');
        if (!detail) {
            const body = await loginResponse.text();
            detail = body.slice(0, 200);
        }
        return new HytaleAuthError(
            'login_failed',
            `Login failed: ${loginResponse.status} - ${detail}`
        );
    }

    private extractVerificationCodeFromEmail(emailContent: string): string | null {
        // Normalize content to make regex extraction resilient to quoted-printable wraps.
        const normalizedContent = emailContent.replace(/\r\n/g, '\n').replace(/=\n/g, '');
        const markerRegex = /your login code\s*:/gi;
        const tokenRegex = /\b((?=[A-Z0-9]*\d)[A-Z0-9]{6,12})\b/g;

        let markerMatch: RegExpExecArray | null = markerRegex.exec(normalizedContent);
        while (markerMatch) {
            const sectionStart = markerMatch.index + markerMatch[0].length;
            const section = normalizedContent.slice(sectionStart, sectionStart + 300);
            const tokenMatch = tokenRegex.exec(section);
            tokenRegex.lastIndex = 0;

            if (tokenMatch) {
                return tokenMatch[1];
            }

            markerMatch = markerRegex.exec(normalizedContent);
        }

        return null;
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

                    // Supports both legacy numeric codes and current alphanumeric codes.
                    const code = this.extractVerificationCodeFromEmail(emailContent);
                    if (code) {
                        return code;
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
            throw new Error(
                `Failed to trigger 2FA code send: ${sendResponse.status} - ${body.slice(0, 200)}`
            );
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
            throw new Error(
                `2FA code submission failed: ${submitResponse.status} - ${body.slice(0, 200)}`
            );
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
            if (Date.now() < this.captchaBlockedUntil) {
                throw new HytaleAuthError(
                    'captcha_required',
                    `Login failed: password login is blocked by a captcha (retrying after ` +
                        `${new Date(this.captchaBlockedUntil).toISOString()}). ${HYTALE_CAPTCHA_HELP}`
                );
            }

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
                throw await this.describeLoginFailure(flowId, loginResponse);
            }

            await this.saveToCache();
        } finally {
            this.isLoggingIn = false;
        }
    }

    public async ensureLoggedIn(): Promise<void> {
        this.loadFromCache();
        if (this.isSessionValid()) {
            this.warnIfSessionExpiringSoon();
            return;
        }

        if (await this.importSessionCookie()) {
            this.warnIfSessionExpiringSoon();
            return;
        }

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
