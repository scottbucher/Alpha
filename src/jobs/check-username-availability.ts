import { Client, EmbedBuilder } from 'discord.js';
import { createRequire } from 'node:module';

import { Job } from './index.js';
import { Language } from '../models/enum-helpers/index.js';
import { HytaleAuthError, HytaleAuthService, Lang, Logger } from '../services/index.js';
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
    // Only DM users once per distinct auth problem so a broken login doesn't spam them every run.
    private lastNotifiedAuthError: string | null = null;

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

                const responseText = await res.text();

                // Check if response is a 2FA challenge (shouldn't happen if auth worked properly)
                // 2FA challenges have "requested_aal":"aal2" or "state":"choose_method"
                if (
                    responseText.includes('"requested_aal":"aal2"') ||
                    responseText.includes('"state":"choose_method"')
                ) {
                    throw new Error(
                        '2FA challenge still present after authentication. Session may not have AAL2.'
                    );
                }

                // Status 200 = username is available, Status 400 = username is taken
                if (res.status === 200) {
                    usernamesAvailable.push(username);
                } else if (res.status === 400) {
                    usernamesUnavailable.push(username);
                } else if (res.status === 429) {
                    Logger.error(Logs.error.checkUsernameAvailabilityRateLimited, responseText);
                    await TimeUtils.sleep(60000);
                    i--; // Retry the current username after rate limit wait
                    continue;
                } else {
                    Logger.error(
                        Logs.error.checkUsernameAvailabilityUnexpectedStatus
                            .replace('{STATUS}', res.status.toString())
                            .replace('{USERNAME}', username)
                    );
                    usernamesUnavailable.push(username);
                }

                await TimeUtils.sleep(5000);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);

                // Check if this is a login/auth error - if so, stop the entire job iteration
                // These are unrecoverable errors that will affect all subsequent usernames
                const isAuthError =
                    error instanceof HytaleAuthError ||
                    // Login errors
                    errorMessage.includes('Login failed') ||
                    errorMessage.includes('Could not extract flow ID') ||
                    errorMessage.includes('Could not find CSRF token') ||
                    // 2FA errors
                    errorMessage.includes('Two-factor authentication') ||
                    errorMessage.includes('2FA') ||
                    errorMessage.includes('AAL2') ||
                    errorMessage.includes('Gmail') ||
                    errorMessage.includes('verification email') ||
                    errorMessage.includes('verification code') ||
                    errorMessage.includes('Session may not have') ||
                    // Rate limiting
                    errorMessage.toLowerCase().includes('rate limit') ||
                    errorMessage.includes('Rate exceeded') ||
                    (errorMessage.includes('429') && errorMessage.includes('Login'));

                if (isAuthError) {
                    Logger.error(
                        Logs.error.checkUsernameAvailabilityLoginError.replace(
                            '{ERROR}',
                            errorMessage
                        ),
                        error
                    );
                    await this.notifyAuthError(errorMessage);
                    // Stop the entire job iteration - these errors will affect all subsequent usernames
                    return;
                }

                // For other errors (e.g. network failures), log and continue with the next username.
                // The result for this username is unknown, so it is neither available nor unavailable.
                Logger.error(
                    Logs.error.checkUsernameAvailabilityError
                        .replace('{USERNAME}', username)
                        .replace('{ERROR}', errorMessage)
                );
            }
        }

        if (usernamesAvailable.length > 0) {
            Logger.info(
                Logs.info.checkUsernameAvailabilityAvailable
                    .replaceAll(
                        '{USERNAME_LIST}',
                        FormatUtils.joinWithAnd(usernamesAvailable, Language.Default)
                    )
                    .replaceAll('{PLURAL}', usernamesAvailable.length === 1 ? '' : 's'),
                {}
            );

            if (Config.usernameChecker.logAvailable) {
                await this.notifyUsers('available', usernamesAvailable);
            }
        }

        if (usernamesUnavailable.length > 0) {
            Logger.info(
                Logs.info.checkUsernameAvailabilityUnavailable
                    .replaceAll(
                        '{USERNAME_LIST}',
                        FormatUtils.joinWithAnd(usernamesUnavailable, Language.Default)
                    )
                    .replaceAll('{PLURAL}', usernamesUnavailable.length === 1 ? '' : 's'),
                {}
            );

            if (Config.usernameChecker.logUnavailable)
                await this.notifyUsers('unavailable', usernamesUnavailable);
        }
    }

    private async notifyUsers(
        type: 'available' | 'unavailable',
        usernames: string[]
    ): Promise<void> {
        const embed = Lang.getEmbed('results', `usernameChecker.${type}`, Language.Default, {
            USERNAME_LIST: FormatUtils.joinWithAnd(usernames, Language.Default),
            USERNAME_LIST_SPLIT: usernames.join('\n'),
            IS_OR_ARE: usernames.length === 1 ? 'is' : 'are',
            PLURAL: usernames.length === 1 ? '' : 's',
        });
        await this.sendToUsersToNotify(embed);
    }

    private async notifyAuthError(errorMessage: string): Promise<void> {
        if (this.lastNotifiedAuthError === errorMessage) return;
        this.lastNotifiedAuthError = errorMessage;

        const embed = Lang.getEmbed('results', 'usernameChecker.authError', Language.Default, {
            // Discord embed field values are capped at 1024 characters
            ERROR: errorMessage.slice(0, 1000),
        });
        await this.sendToUsersToNotify(embed);
    }

    private async sendToUsersToNotify(embed: EmbedBuilder): Promise<void> {
        const usersToNotify: string[] = [...Config.usernameChecker.usersToNotify];
        for (const userId of usersToNotify) {
            const user = await ClientUtils.getUser(this.client, userId);
            await MessageUtils.send(user, embed);
        }
    }
}
