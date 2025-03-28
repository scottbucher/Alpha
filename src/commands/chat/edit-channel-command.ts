import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { ChannelType, EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/language.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/lang.js';
import { ClientUtils, FormatUtils, InteractionUtils, PermissionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../command.js';

export class EditChannelCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.edit', Language.Default),
        Lang.getRef('commands', 'chatCommands.channel', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireDev = false;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];
    public auditLog = true;

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let type: ChannelType = intr.options.getString(
            Lang.getRef('commands', 'arguments.type', Language.Default)
        ) as ChannelType;
        let channel =
            intr.options.getChannel(
                Lang.getRef('commands', 'arguments.channel', Language.Default)
            ) ?? undefined;

        let reset = !channel;

        if (!reset) {
            channel = await ClientUtils.findTextChannel(intr.guild, channel.id);

            if (!channel) {
                await InteractionUtils.send(
                    intr,
                    Lang.getErrorEmbed(
                        'validation',
                        'errorEmbeds.unsupportedChannelType',
                        data.lang
                    )
                );
                return;
            }

            // Check for essential permissions in channel
            if (!PermissionUtils.canSend(channel, true)) {
                await InteractionUtils.send(
                    intr,
                    Lang.getErrorEmbed(
                        'validation',
                        'errorEmbeds.noPermissionEssential',
                        data.lang,
                        {
                            CHANNEL_MENTION: FormatUtils.channelMention(channel.id),
                            CMD_LINK_CHANNEL_PERMISSIONS: await FormatUtils.commandMention(
                                intr.client,
                                `channelPermissions`
                            ),
                        }
                    )
                );
                return;
            }
        }

        data.guildData[`${type.toLowerCase()}Settings`].channelDiscordId = reset
            ? undefined
            : channel.id;

        await data.em.flush();

        if (!reset) {
            await InteractionUtils.send(
                intr,
                Lang.getSuccessEmbed('results', 'successEmbeds.channelSet', data.lang, {
                    CHANNEL: FormatUtils.channelMention(channel.id),
                    TYPE: type.toLowerCase(),
                })
            );
        } else {
            await InteractionUtils.send(
                intr,
                Lang.getSuccessEmbed('results', 'successEmbeds.channelClear', data.lang, {
                    TYPE: type.toLowerCase(),
                })
            );
        }
    }
}
