import { DMChannel, Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';
import { MessageUtils } from '../utils';

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
                    `\n**!xp [user]** - View your or another user's xp.` +
                    '\n**!lb [page]** - View the leaderboard.' +
                    '\n**!quote <message link or id>** - Quote a message.' +
                    '\n**!quote <user> <text>** - Quote a message (custom).' +
                    '\n**!8ball <question>** - Ask the 8ball a question.' +
                    '\n**!server** - View information about the server.' +
                    '\n**!about** - View information about the bot.'
            )
            .setColor(Config.colors.default);

        if (channel instanceof TextChannel) await MessageUtils.send(channel, embed);
        else MessageUtils.send(channel, embed);
    }
}
