import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';

import { EventDataType, HelpOption } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { FormatUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class HelpCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.help', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let args = {
            option: intr.options.getString(
                Lang.getRef('commands', 'arguments.option', Language.Default)
            ) as HelpOption,
        };

        let embed: EmbedBuilder;
        switch (args.option) {
            case HelpOption.COMMANDS: {
                embed = Lang.getEmbed('info', 'help.commands', data.lang);
                break;
            }
            case HelpOption.PERMISSIONS: {
                embed = Lang.getEmbed('info', 'help.permissions', data.lang);
                break;
            }
            case HelpOption.XP: {
                embed = Lang.getEmbed('info', 'help.xp', data.lang, {
                    CMD_XP: await FormatUtils.commandMention(intr.client, 'xp'),
                    CMD_LEADERBOARD: await FormatUtils.commandMention(intr.client, 'leaderboard'),
                    CMD_REWARD_ADD_ROLE: await FormatUtils.commandMention(intr.client, 'reward', [
                        'addRole',
                    ]),
                    CMD_REWARD_REMOVE_ROLE: await FormatUtils.commandMention(
                        intr.client,
                        'reward',
                        ['remove', 'role']
                    ),
                    CMD_REWARD_REMOVE_ID: await FormatUtils.commandMention(intr.client, 'reward', [
                        'remove',
                        'id',
                    ]),
                    CMD_REWARD_CLEAR_ROLES: await FormatUtils.commandMention(
                        intr.client,
                        'reward',
                        ['clearRoles']
                    ),
                    CMD_VIEW_REWARDS: await FormatUtils.commandMention(intr.client, 'viewRewards'),
                    CMD_CLAIM_REWARDS: await FormatUtils.commandMention(
                        intr.client,
                        'claimRewards'
                    ),
                });
                break;
            }
        }

        await InteractionUtils.send(intr, embed);
    }
}
