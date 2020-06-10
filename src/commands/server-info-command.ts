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
        let onlineMembers = members.filter(member => member.presence.status === 'online' || member.presence.status === 'dnd');

        let textChannels = guild.channels.cache.filter(channel => channel.type === 'text');
        let voiceChannels = guild.channels.cache.filter(channel => channel.type === 'voice');


        let embed = new MessageEmbed()
            .setAuthor(msg.guild.name, msg.guild.iconURL())
            .setColor(Config.colors.default)
            .addField('Member Count', `${members.size} (${onlineMembers.size} currently online)`, true)
            .addField('Bot Count', bots.size, true)
            .addField('Channel Count', `${textChannels.size} text channels\n${voiceChannels.size} voice channels`, true)
            .addField('Guild Specific Prefix', guildData.Prefix, true)
            .addField('Server Owner', `${guild.owner.user.username}#${guild.owner.user.discriminator}`, true)
            .addField('Created On', `${guild.createdAt.getMonth()}/${guild.createdAt.getDate()}/${guild.createdAt.getFullYear()}`, true)
            .addField('Server ID', guild.id, true)
            .addField('Current Shard', `shard 1/1 total shards`, true)
            .setThumbnail(msg.client.user.avatarURL())
            .setFooter('© 2020 Scott Bucher', msg.client.users.resolve('478288246858711040').avatarURL())
            .setTimestamp();

        await channel.send(embed);
    }
}