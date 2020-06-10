import { Message, MessageEmbed, Presence, TextChannel } from 'discord.js';

import { Command } from './command';
import { GuildRepo } from '../services/database/repos';

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
            .setColor(Config.colors.default)
            .addField(
                'Members',
                `${onlineMembers.size.toLocaleString()}/${members.size.toLocaleString()} Members Online`,
                true
            )
            .addField('Bots', `${bots.size} Bots`, true)
            .addField(
                'Channels',
                `${textChannels.size.toLocaleString()} Text,\n${voiceChannels.size.toLocaleString()} Voice`,
                true
            )
            .addField('Bot Prefix', guildData.Prefix, true)
            .addField('Server Owner', `${guild.owner.user}`, true)
            .addField(
                'Created On',
                `${guild.createdAt.getMonth()}/${guild.createdAt.getDate()}/${guild.createdAt.getFullYear()}`,
                true
            )
            .addField('Server ID', `\`${guild.id}\``, true)
            .addField('Current Shard', `Shard 1/1`, true)
            .setFooter(
                `© ${new Date().getFullYear()} Scott Bucher`,
                msg.client.users.resolve('478288246858711040').avatarURL()
            )
            .setTimestamp();

        await channel.send(embed);
    }
}
