import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckUsernameAvailabilityJob } from '../../src/jobs/check-username-availability.js';
import { HytaleAuthError, HytaleAuthService, Logger } from '../../src/services/index.js';
import { ClientUtils, MessageUtils, TimeUtils } from '../../src/utils/index.js';
import { createMockClient } from '../helpers/test-mocks.js';

const require = createRequire(import.meta.url);
const Config = require('../../config/config.json');

describe('CheckUsernameAvailabilityJob', () => {
    const usernameCount: number = Config.usernameChecker.usernameList.length;
    const notifyCount: number = Config.usernameChecker.usersToNotify.length;
    let job: CheckUsernameAvailabilityJob;
    let authService: HytaleAuthService;
    let getMock: ReturnType<typeof vi.fn>;
    let sendMock: ReturnType<typeof vi.spyOn>;
    let infoMock: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        getMock = vi.fn();
        authService = { get: getMock } as unknown as HytaleAuthService;
        job = new CheckUsernameAvailabilityJob(createMockClient(), authService);

        vi.spyOn(TimeUtils, 'sleep').mockResolvedValue(undefined);
        vi.spyOn(ClientUtils, 'getUser').mockImplementation(async (_client, id) => ({ id }) as any);
        sendMock = vi.spyOn(MessageUtils, 'send').mockResolvedValue(undefined as any);
        infoMock = vi.spyOn(Logger, 'info').mockImplementation(() => {});
        vi.spyOn(Logger, 'error').mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reports available usernames', async () => {
        getMock.mockResolvedValue(new Response('', { status: 200 }));

        await job.run();

        expect(getMock).toHaveBeenCalledTimes(usernameCount);
        expect(infoMock).toHaveBeenCalledWith(expect.stringMatching(/available:/i), {});
        expect(sendMock).toHaveBeenCalledTimes(
            Config.usernameChecker.logAvailable ? notifyCount : 0
        );
    });

    it('does not report usernames as unavailable when the check itself failed', async () => {
        getMock.mockRejectedValue(new Error('fetch failed'));

        await job.run();

        expect(getMock).toHaveBeenCalledTimes(usernameCount);
        expect(infoMock).not.toHaveBeenCalled();
        expect(sendMock).not.toHaveBeenCalled();
    });

    it('stops the iteration and notifies users once when authentication fails', async () => {
        getMock.mockRejectedValue(
            new HytaleAuthError('captcha_required', 'Login failed: captcha required')
        );

        await job.run();
        await job.run();

        // Stops after the first username on each run
        expect(getMock).toHaveBeenCalledTimes(2);
        expect(infoMock).not.toHaveBeenCalled();
        // Users are only notified the first time a given error occurs
        expect(sendMock).toHaveBeenCalledTimes(notifyCount);
        const embed = sendMock.mock.calls[0][1];
        expect(JSON.stringify(embed.toJSON())).toContain('Login failed: captcha required');
    });

    it('notifies users again when the authentication error changes', async () => {
        getMock.mockRejectedValueOnce(new HytaleAuthError('captcha_required', 'Login failed: A'));
        await job.run();
        getMock.mockRejectedValueOnce(new HytaleAuthError('login_failed', 'Login failed: B'));
        await job.run();

        expect(sendMock).toHaveBeenCalledTimes(notifyCount * 2);
    });
});
