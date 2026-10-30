import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HytaleAuthError, HytaleAuthService } from '../../src/services/hytale-auth-service.js';

const BACKEND = 'https://backend.accounts.hytale.com';
const FLOW_ID = '203526ba-e0e2-4500-89a2-3a240e9e4962';
const AVAILABILITY_URL =
    'https://accounts.hytale.com/api/account/username-reservations/availability?username=Scott';

type FetchCall = { url: string; init?: RequestInit };

function jsonResponse(
    body: unknown,
    status: number = 200,
    headers: Record<string, string> = {}
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
    });
}

function redirectResponse(location: string, headers: Record<string, string> = {}): Response {
    return new Response(null, { status: 303, headers: { location, ...headers } });
}

/** Responses that a password login against the current (captcha protected) flow produces. */
function captchaLoginHandler(url: string, init?: RequestInit): Response {
    if (url === `${BACKEND}/self-service/login/browser`) {
        return redirectResponse(`https://accounts.hytale.com/login?flow=${FLOW_ID}`, {
            'set-cookie': 'csrf_token_abc=csrf-value; Path=/; Domain=hytale.com; Secure; HttpOnly',
        });
    }
    if (url === `${BACKEND}/self-service/login?flow=${FLOW_ID}` && init?.method === 'POST') {
        // Kratos bounces back to the same login page when the captcha is missing
        return redirectResponse(`https://accounts.hytale.com/login?flow=${FLOW_ID}`);
    }
    if (url === `${BACKEND}/self-service/login/flows?id=${FLOW_ID}`) {
        return jsonResponse({
            id: FLOW_ID,
            ui: {
                nodes: [
                    { group: 'default', attributes: { name: 'csrf_token', type: 'hidden' } },
                    {
                        group: 'captcha',
                        attributes: { name: 'cf-turnstile-response', type: 'hidden' },
                        messages: [
                            {
                                id: 4000038,
                                text: 'Captcha verification failed, please try again.',
                                type: 'error',
                            },
                        ],
                    },
                ],
            },
        });
    }
    throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
}

describe('HytaleAuthService', () => {
    let calls: FetchCall[];
    let handler: (url: string, init?: RequestInit) => Response | Promise<Response>;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        calls = [];
        handler = captchaLoginHandler;
        globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();
            calls.push({ url, init });
            const response = await handler(url, init);
            // Real responses carry the request URL; the cookie jar needs it to store Set-Cookie
            Object.defineProperty(response, 'url', { value: url });
            return response;
        }) as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    function cookieHeader(call: FetchCall): string | null {
        return new Headers(call.init?.headers).get('cookie');
    }

    describe('password login', () => {
        it('reports a captcha requirement with instructions when Kratos rejects the login', async () => {
            const service = new HytaleAuthService('user@example.com', 'password');

            const error = await service.ensureLoggedIn().catch(e => e);

            expect(error).toBeInstanceOf(HytaleAuthError);
            expect((error as HytaleAuthError).code).toBe('captcha_required');
            // Keep the "Login failed" prefix: the job relies on it to classify auth errors
            expect(error.message).toMatch(/^Login failed: Captcha verification failed/);
            expect(error.message).toContain('hytaleSessionCookie');
        });

        it('backs off instead of retrying the login while the captcha block is active', async () => {
            const service = new HytaleAuthService('user@example.com', 'password');

            await expect(service.ensureLoggedIn()).rejects.toBeInstanceOf(HytaleAuthError);
            const callsAfterFirstAttempt = calls.length;

            const error = await service.ensureLoggedIn().catch(e => e);

            expect((error as HytaleAuthError).code).toBe('captcha_required');
            expect(calls.length).toBe(callsAfterFirstAttempt);
        });

        it('surfaces other flow error messages as a login failure', async () => {
            handler = (url, init) => {
                if (url === `${BACKEND}/self-service/login/flows?id=${FLOW_ID}`) {
                    return jsonResponse({
                        id: FLOW_ID,
                        ui: {
                            messages: [
                                {
                                    text: 'The provided credentials are invalid.',
                                    type: 'error',
                                },
                            ],
                            nodes: [],
                        },
                    });
                }
                return captchaLoginHandler(url, init);
            };
            const service = new HytaleAuthService('user@example.com', 'wrong');

            const error = await service.ensureLoggedIn().catch(e => e);

            expect((error as HytaleAuthError).code).toBe('login_failed');
            expect(error.message).toBe('Login failed: 303 - The provided credentials are invalid.');
        });
    });

    describe('session cookie import', () => {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        function sessionHandler(url: string, init?: RequestInit): Response {
            if (url === `${BACKEND}/sessions/whoami`) {
                const cookie = new Headers(init?.headers).get('cookie') ?? '';
                if (cookie.includes('ory_kratos_session=valid-session')) {
                    return jsonResponse({
                        active: true,
                        expires_at: expiresAt.toISOString(),
                        authenticator_assurance_level: 'aal2',
                    });
                }
                return jsonResponse({ error: { code: 401 } }, 401);
            }
            if (url === AVAILABILITY_URL) {
                return new Response('', { status: 400 });
            }
            return captchaLoginHandler(url, init);
        }

        beforeEach(() => {
            handler = sessionHandler;
        });

        it('uses a configured browser session cookie instead of logging in', async () => {
            const service = new HytaleAuthService(
                'user@example.com',
                'password',
                null,
                null,
                'valid-session'
            );

            const response = await service.get(new URL(AVAILABILITY_URL));

            expect(response.status).toBe(400);
            expect(calls.map(c => c.url)).toEqual([`${BACKEND}/sessions/whoami`, AVAILABILITY_URL]);
            expect(cookieHeader(calls[1])).toContain('ory_kratos_session=valid-session');
            expect(service.getSessionExpiry()?.getTime()).toBe(expiresAt.getTime());
        });

        it('only validates the imported cookie once while it is still valid', async () => {
            const service = new HytaleAuthService(
                'user@example.com',
                'password',
                null,
                null,
                'valid-session'
            );

            await service.get(new URL(AVAILABILITY_URL));
            await service.get(new URL(AVAILABILITY_URL));

            const whoamiCalls = calls.filter(c => c.url === `${BACKEND}/sessions/whoami`);
            expect(whoamiCalls).toHaveLength(1);
        });

        it('falls back to a password login when the configured cookie is rejected', async () => {
            const service = new HytaleAuthService(
                'user@example.com',
                'password',
                null,
                null,
                'expired-session'
            );

            const error = await service.ensureLoggedIn().catch(e => e);

            expect((error as HytaleAuthError).code).toBe('captcha_required');
            expect(calls[0].url).toBe(`${BACKEND}/sessions/whoami`);
            expect(calls[1].url).toBe(`${BACKEND}/self-service/login/browser`);
            // The rejected cookie must not leak into the login attempt
            expect(cookieHeader(calls[1]) ?? '').not.toContain('expired-session');
        });

        it('does not re-validate a cookie that was already rejected', async () => {
            const service = new HytaleAuthService(
                'user@example.com',
                'password',
                null,
                null,
                'expired-session'
            );

            await expect(service.ensureLoggedIn()).rejects.toBeInstanceOf(HytaleAuthError);
            await expect(service.ensureLoggedIn()).rejects.toBeInstanceOf(HytaleAuthError);

            const whoamiCalls = calls.filter(c => c.url === `${BACKEND}/sessions/whoami`);
            expect(whoamiCalls).toHaveLength(1);
        });
    });
});
