import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';
import { GuildRepo } from '../services/database/repos';
import { MessageUtils } from '../utils';

let Config = require('../../config/config.json');

export class AboutCommand implements Command {
    public name: string = 'about';
    public aliases = ['bot'];
    public trigger = null;
    public guildOnly: boolean = false;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;
    public help: string = '!help';

    constructor(private guildRepo: GuildRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        let guildData = await this.guildRepo.getGuild(msg.guild.id);

        let embed = new MessageEmbed()
            .setDescription(
                'Hello! I am <@642088667615199242>, a bot built by [Scott Bucher](https://github.com/scottbucher/) with help from [Kevin Novak](https://github.com/KevinNovak)!'
                + '\n\nMy prefix for this server is `' + guildData.Prefix + '`'
                + '\n\nType `' + guildData.Prefix + 'help` and I\'ll display you a list of commands you can use!'
                + '\n\nFor additional help contact Stqlth#0001 on discord or through github!'
            )
            .setAuthor('Alpha Bot', msg.client.user.avatarURL())
            .setFooter('© 2020 Scott Bucher', msg.client.users.resolve('478288246858711040').avatarURL())
            .setTimestamp()
            .setThumbnail(msg.client.user.avatarURL())
            .setColor(Config.colors.default);

        if (channel instanceof TextChannel) await channel.send(embed);
        else MessageUtils.sendDm(channel, embed);
    }
}
