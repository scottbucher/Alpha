import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';
import { GuildRepo } from '../services/database/repos';
import { MessageUtils } from '../utils';

let Config = require('../../config/config.json');

export class ServerInfoCommand implements Command {
    public name: string = 'server';
    public aliases: string[] = ['serverinfo', 'guildinfo', 'info', 'guild'];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = false;
    public ownerOnly = false;

    constructor(private guildRepo: GuildRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        let guildData = await this.guildRepo.getGuild(msg.guild.id);

        let guild = msg.guild;

        let members = guild.members.cache.filter(member => !member.user.bot);
        let bots = guild.members.cache.filter(member => member.user.bot);
        let onlineMembers = members.filter(
            member => member.presence.status === 'online' || member.presence.status === 'dnd'
        );

        let textChannels = guild.channels.cache.filter(channel => channel.type === 'GUILD_TEXT');
        let voiceChannels = guild.channels.cache.filter(channel => channel.type === 'GUILD_VOICE');

        let embed = new MessageEmbed()
            .setAuthor(
                msg.guild.id === '777956000857980938' ? 'The Loser Server' : msg.guild.name,
                msg.guild.iconURL()
            )
            .setDescription('Information about your server.')
            .addField('Server ID', `\`${guild.id}\``, true)
            .addField('Owner', `${(await guild.fetchOwner()).user}`, true)
            .addField(
                'Created',
                `${guild.createdAt.getMonth()}/${guild.createdAt.getDate()}/${guild.createdAt.getFullYear()}`,
                true
            )
            .addField(
                'Channels',
                `${textChannels.size.toLocaleString()} Text, ${voiceChannels.size.toLocaleString()} Voice`,
                true
            )
            .addField(
                'Members',
                `${onlineMembers.size.toLocaleString()}/${members.size.toLocaleString()} Online`,
                true
            )
            .addField('Bots', `${bots.size} Bots`, true)
            .addField('Current Shard', `Shard 1/1`, true) // TODO: Retrieve shard number + count
            .addField('Bot Prefix', `\`${guildData.Prefix}\``, true)
            .setTimestamp()
            .setColor(Config.colors.default);

        await MessageUtils.send(channel, embed);
    }
}
