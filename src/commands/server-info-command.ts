import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { GuildRepo } from '../services/database/repos';
import { Command } from './command';

let Config = require('../../config/config.json');

export class ServerInfoCommand implements Command {
    public name: string = 'serverinfo';
    public aliases: string[] = ['info', 'guildinfo', 'server', 'guild'];
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

        let textChannels = guild.channels.cache.filter(channel => channel.type === 'text');
        let voiceChannels = guild.channels.cache.filter(channel => channel.type === 'voice');

        let embed = new MessageEmbed()
            .setAuthor(msg.guild.name, msg.guild.iconURL())
            .setDescription('Information about your server.')
            .addField('Server ID', `\`${guild.id}\``, true)
            .addField('Owner', `${guild.owner.user}`, true)
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

        await channel.send(embed);
    }
}
