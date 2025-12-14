import fetchCookie from 'fetch-cookie';
import { URL } from 'node:url';
import { CookieJar } from 'tough-cookie';

export class HytaleAuthService {
    private email: string;
    private password: string;
    private isLoggingIn = false;
    private cookieJar: CookieJar;
    private fetchWithCookies: typeof globalThis.fetch;

    constructor(email: string, password: string) {
        this.email = email;
        this.password = password;
        this.cookieJar = new CookieJar();
        this.fetchWithCookies = fetchCookie(globalThis.fetch, this.cookieJar);
    }

    private isSessionValid(): boolean {
        // Check both possible domains where the session cookie might be set
        const accountsCookies = this.cookieJar.getCookiesSync('https://accounts.hytale.com');
        const backendCookies = this.cookieJar.getCookiesSync('https://backend.accounts.hytale.com');
        const allCookies = [...accountsCookies, ...backendCookies];

        const sessionCookie = allCookies.find(c => c.key === 'ory_kratos_session');
        if (!sessionCookie?.expires) return false;

        // Consider session invalid 5 minutes before actual expiry for safety margin
        const expiresAt = new Date(sessionCookie.expires).getTime();
        return Date.now() < expiresAt - 5 * 60 * 1000;
    }

    private async login(): Promise<void> {
        if (this.isLoggingIn) {
            // Wait for existing login attempt to complete
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
            if (loginResponse.status !== 303 || !redirectLocation?.includes('/settings')) {
                const body = await loginResponse.text();
                throw new Error(`Login failed: ${loginResponse.status} - ${body.slice(0, 200)}`);
            }

            await this.fetchWithCookies(redirectLocation, { redirect: 'follow' });
        } finally {
            this.isLoggingIn = false;
        }
    }

    public async ensureLoggedIn(): Promise<void> {
        if (this.isSessionValid()) return;
        await this.login();
    }

    public async get(url: string | URL): Promise<globalThis.Response> {
        await this.ensureLoggedIn();

        return await this.fetchWithCookies(url.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });
    }
}
