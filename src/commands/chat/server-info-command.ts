import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class ServerInfoCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.serverInfo', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let guild = intr.guild;

        let members = guild.members.cache.filter(member => !member.user.bot);
        let bots = guild.members.cache.filter(member => member.user.bot);
        let presenceStatuses = members.map(member => member.presence?.status);
        let onlineMembers = members.filter(
            member => member.presence?.status === 'online' || member.presence?.status === 'dnd'
        );

        let textChannels = guild.channels.cache.filter(channel => channel.isTextBased());
        let voiceChannels = guild.channels.cache.filter(channel => channel.isVoiceBased());

        let owner = await guild.fetchOwner();

        await InteractionUtils.send(
            intr,
            Lang.getEmbed('info', 'embeds.serverInfo', data.lang, {
                GUILD_NAME: guild.name,
                GUILD_ICON: guild.iconURL(),
                SERVER_ID: guild.id,
                OWNER_MENTION: owner.user.toString(),
                CREATED_DATE: `${guild.createdAt.getMonth() + 1}/${guild.createdAt.getDate()}/${guild.createdAt.getFullYear()}`,
                TEXT_CHANNELS: textChannels.size.toLocaleString(),
                VOICE_CHANNELS: voiceChannels.size.toLocaleString(),
                ONLINE_MEMBERS: onlineMembers.size.toLocaleString(),
                TOTAL_MEMBERS: members.size.toLocaleString(),
                BOT_COUNT: bots.size.toLocaleString(),
                SHARD_ID: (intr.guild.shardId + 1).toLocaleString(),
                SHARD_COUNT: (intr.client.shard?.count ?? 1).toLocaleString(),
            })
        );
    }
}
