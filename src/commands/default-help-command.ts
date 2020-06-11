import { DMChannel, Message, MessageEmbed, TextChannel } from 'discord.js';

import { MessageUtils } from '../utils';
import { Command } from './command';

let Config = require('../../config/config.json');

export class DefaultHelpCommand implements Command {
    public name: string = 'help';
    public aliases = ['?'];
    public trigger = null;
    public guildOnly: boolean = false;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;

    public async execute(args: string[], msg: Message, channel: TextChannel | DMChannel) {
        let embed = new MessageEmbed()
            .setAuthor('Alpha Help', msg.client.user.avatarURL())
            .setDescription(
                'Alpha is a fun all-in-one bot, in this help menu you will find the general commands and information you need to properly use the bot.' +
                    '\n' +
                    `\n**!xp [@User]** - View your or another user's xp!` +
                    '\n**!lb [size]** - View the xp leader board! (Default size: 10, Max: 25)' +
                    '\n**!8ball <Question>** - Ask the 8ball!' +
                    '\n**!server** - View information about the server!' +
                    '\n**!about** - View information about the bot'
            )
            .setColor(Config.colors.default);

        if (channel instanceof TextChannel) await channel.send(embed);
        else MessageUtils.sendDm(channel, embed);
    }
}
