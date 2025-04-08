import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/language.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/lang.js';
import { ClientUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../command.js';

export class ChannelPermissionsCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.channelPermissions', Language.Default)];
    public deferType = CommandDeferType.HIDDEN;
    public requireDev = false;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [];
    public auditLog = false;

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let channel = await ClientUtils.findTextChannel(
            intr.guild,
            intr.options.getChannel(Lang.getRef('commands', 'arguments.channel', Language.Default))
                ?.id ?? intr.channel.id
        );

        if (!channel) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.unsupportedChannelType', data.lang)
            );
            return;
        }

        let confirm = Lang.getEmoji('yes', intr.guild);
        let deny = Lang.getEmoji('no', intr.guild);

        let clientPermissions = channel.permissionsFor(intr.client.user);

        await InteractionUtils.send(
            intr,
            Lang.getEmbed('results', 'info.channelPermissions', data.lang, {
                CHANNEL_NAME: channel.name,
                VIEW_CHANNEL_ENABLED: clientPermissions.has(PermissionFlagsBits.ViewChannel)
                    ? confirm
                    : deny,
                SEND_MESSAGES_ENABLED: clientPermissions.has(PermissionFlagsBits.SendMessages)
                    ? confirm
                    : deny,
                EMBED_LINKS_ENABLED: clientPermissions.has(PermissionFlagsBits.EmbedLinks)
                    ? confirm
                    : deny,
                MENTION_EVERYONE_ENABLED: clientPermissions.has(PermissionFlagsBits.MentionEveryone)
                    ? confirm
                    : deny,
                MANAGE_MESSAGES_ENABLED: clientPermissions.has(PermissionFlagsBits.ManageMessages)
                    ? confirm
                    : deny,
                READ_MESSAGE_HISTORY_ENABLED: clientPermissions.has(
                    PermissionFlagsBits.ReadMessageHistory
                )
                    ? confirm
                    : deny,
                CREATE_PUBLIC_THREADS_ENABLED: clientPermissions.has(
                    PermissionFlagsBits.CreatePublicThreads
                )
                    ? confirm
                    : deny,
                MANAGE_THREADS_ENABLED: clientPermissions.has(PermissionFlagsBits.ManageThreads)
                    ? confirm
                    : deny,
            })
        );
    }
}
