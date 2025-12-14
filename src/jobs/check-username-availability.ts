import { Client } from 'discord.js';
import { createRequire } from 'node:module';

import { Job } from './index.js';
import { Language } from '../models/enum-helpers/index.js';
import { HytaleAuthService, Lang, Logger } from '../services/index.js';
import { ClientUtils, FormatUtils, MessageUtils, TimeUtils } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

export class CheckUsernameAvailabilityJob extends Job {
    public name = 'Check Username Availability';
    public schedule: string = Config.jobs.checkUsernameAvailability.schedule;
    public log: boolean = Config.jobs.checkUsernameAvailability.log;
    public runOnce: boolean = Config.jobs.checkUsernameAvailability.runOnce;
    public initialDelaySecs: number = Config.jobs.checkUsernameAvailability.initialDelaySecs;

    constructor(
        private client: Client,
        private hytaleAuthService: HytaleAuthService
    ) {
        super();
    }

    public async run(): Promise<void> {
        const usernamesAvailable: string[] = [];
        const usernamesUnavailable: string[] = [];
        const usernamesToCheck: string[] = [...Config.usernameChecker.usernameList];

        for (let i = 0; i < usernamesToCheck.length; i++) {
            const username = usernamesToCheck[i];

            try {
                const res = await this.hytaleAuthService.get(
                    new URL(
                        `https://accounts.hytale.com/api/account/username-reservations/availability?username=${encodeURIComponent(username)}`
                    )
                );

                // Status 200 = username is available, Status 400 = username is taken
                if (res.status === 200) {
                    usernamesAvailable.push(username);
                } else if (res.status === 400) {
                    usernamesUnavailable.push(username);
                } else if (res.status === 429) {
                    Logger.error(Logs.error.checkUsernameAvailabilityRateLimited, await res.text());
                    await TimeUtils.sleep(60000);
                    i--; // Retry the current username after rate limit wait
                    continue;
                } else {
                    Logger.error(Logs.error.checkUsernameAvailabilityUnexpectedStatus, {
                        username,
                        status: res.status,
                    });
                    usernamesUnavailable.push(username);
                }

                await TimeUtils.sleep(5000);
            } catch (error) {
                Logger.error(Logs.error.checkUsernameAvailabilityError, {
                    username,
                    error,
                });
                usernamesUnavailable.push(username);
            }
        }

        if (usernamesAvailable.length > 0) {
            Logger.info(Logs.info.checkUsernameAvailabilityAvailable, {
                USERNAME_LIST: FormatUtils.joinWithAnd(usernamesAvailable, Language.Default),
                PLURAL: usernamesAvailable.length === 1 ? '' : 's',
            });
            if (Config.usernameChecker.logAvailable) {
                await this.notifyUsers('available', usernamesAvailable);
            }
        }

        if (Config.usernameChecker.logUnavailable && usernamesUnavailable.length > 0) {
            Logger.info(Logs.info.checkUsernameAvailabilityUnavailable, {
                USERNAME_LIST: usernamesUnavailable.join(', '),
                PLURAL: FormatUtils.joinWithAnd(usernamesUnavailable, Language.Default),
            });
            await this.notifyUsers('unavailable', usernamesUnavailable);
        }
    }

    private async notifyUsers(
        type: 'available' | 'unavailable',
        usernames: string[]
    ): Promise<void> {
        const usersToNotify: string[] = [...Config.usernameChecker.usersToNotify];
        for (const userId of usersToNotify) {
            const user = await ClientUtils.getUser(this.client, userId);
            const embed = Lang.getEmbed('results', `usernameChecker.${type}`, Language.Default, {
                USERNAME_LIST: FormatUtils.joinWithAnd(usernames, Language.Default),
                USERNAME_LIST_SPLIT: usernames.join('\n'),
                IS_OR_ARE: usernames.length === 1 ? 'is' : 'are',
                PLURAL: usernames.length === 1 ? '' : 's',
            });
            await MessageUtils.send(user, embed);
        }
    }
}
