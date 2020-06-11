import { GuildMember, MessageEmbed, TextChannel } from 'discord.js';

import { Logger } from '../services';
import { GuildRepo, UserRepo } from '../services/database/repos';
import { EventHandler } from './event-handler';

let Config = require('../../config/config.json');

export class UserJoinHandler implements EventHandler {
    constructor(private guildRepo: GuildRepo, private userRepo: UserRepo) {}

    public async process(member: GuildMember): Promise<void> {
        Logger.info(`${member.displayName} Joining...`);
        if (!member.user.bot) this.userRepo.syncUser(member.guild.id, member.id);
        Logger.info(`${member.displayName} Joined!`);

        let welcomeChannelId = (await this.guildRepo.getGuild(member.guild.id)).WelcomeChannelId;

        if (welcomeChannelId === '0') return;

        let welcomeChannel = member.guild.channels.resolve(welcomeChannelId) as TextChannel;

        if (!welcomeChannel) return;

        let embed = new MessageEmbed()
            .setTitle(`Welcome to ${member.guild.name}!`)
            .setThumbnail(member.user.avatarURL())
            .setDescription(`Enjoy your stay ${member.toString()}!`)
            .setColor(Config.colors.default)
            .setFooter(`${member.displayName} joined!`, member.user.avatarURL())
            .setTimestamp();
        await welcomeChannel.send(embed);
    }
}
