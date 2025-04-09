import {
    CommandInteraction,
    GuildChannel,
    MessageComponentInteraction,
    ModalSubmitInteraction,
    ThreadChannel,
} from 'discord.js';
import { createRequire } from 'node:module';

import { DatabaseUtils, FormatUtils, InteractionUtils } from './index.js';
import { Command } from '../commands/index.js';
import { EventDataType } from '../enums/index.js';
import { Permission } from '../models/enum-helpers/index.js';
import { EventData } from '../models/internal-models.js';
import { Lang, Logger } from '../services/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

export class CommandUtils {
    public static findCommand(commands: Command[], commandParts: string[]): Command {
        let found = [...commands];
        let closestMatch: Command;
        for (let [index, commandPart] of commandParts.entries()) {
            found = found.filter(command => command.names[index] === commandPart);
            if (found.length === 0) {
                return closestMatch;
            }

            if (found.length === 1) {
                return found[0];
            }

            let exactMatch = found.find(command => command.names.length === index + 1);
            if (exactMatch) {
                closestMatch = exactMatch;
            }
        }
        return closestMatch;
    }

    public static async runChecks(
        command: Command,
        intr: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
        data: EventData
    ): Promise<boolean> {
        if (command.cooldown) {
            let limited = command.cooldown.take(intr.user.id);
            if (limited) {
                await InteractionUtils.send(
                    intr,
                    Lang.getErrorEmbed('validation', 'errorEmbeds.cooldownHit', data.lang, {
                        AMOUNT: command.cooldown.amount.toLocaleString(data.lang),
                        INTERVAL: FormatUtils.duration(command.cooldown.interval, data.lang),
                    })
                );
                return false;
            }
        }

        if (command.isDevOnly && !Config.developers.includes(intr.user.id)) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.devOnly', data.lang)
            );
            return;
        }

        if (
            (intr.channel instanceof GuildChannel || intr.channel instanceof ThreadChannel) &&
            !intr.channel.permissionsFor(intr.client.user).has(command.requireClientPerms)
        ) {
            await InteractionUtils.send(
                intr,
                Lang.getEmbed('validation', 'embeds.missingClientPerms', data.lang, {
                    PERMISSIONS: command.requireClientPerms
                        .map(perm => `**${Permission.Data[perm].displayName(data.lang)}**`)
                        .join(', '),
                })
            );
            return false;
        }

        // TODO: Should this live in runChecks or should we move it to the eventDataService?
        if (command.requireEventData.includes(EventDataType.GUILD_DATA) && !data.guildData) {
            // Guild must have added the bot while it was offline, thus, we never created guild
            // or guild user data for it. Let's do that now.
            Logger.warn(
                Logs.warn.noGuildDataDuringEventServiceCreation
                    .replaceAll('{GUILD_NAME}', intr.guild.name)
                    .replaceAll('{GUILD_ID}', intr.guild.id)
            );
            let { GuildData: guildData, GuildUserData: _ } =
                await DatabaseUtils.getOrCreateDataForGuild(data.em, intr.guild);

            data.guildData = guildData;
        }

        return true;
    }
}
