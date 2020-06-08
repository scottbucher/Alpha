import { DMChannel, Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';
import { MessageUtils } from '../utils';

let Config = require('../../config/config.json');

export class DefaultHelpCommand implements Command {
    public name: string = 'help';
    public aliases = ['?'];
    public guildOnly: boolean = false;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;

    public async execute(args: string[], msg: Message, channel: TextChannel | DMChannel) {
        let embed = new MessageEmbed()
            .setAuthor('Alpha Help', msg.client.user.avatarURL())
            .setDescription(
                'Alpha is a fun all-in-one bot, in this help menu you will find the general commands and information you need to properly use the bot.' +
                    '\n' +
                    "\n**!xp [@User]** - View your or another user's xp!" +
                    '\n**!lb [size]** - View the xp leader board! (Default size: 10, Max: 25)' +
                    '\n**!about** - View information about the bot' +
                    '\n**!serverinfo** - View information about the server!' +
                    '\n**!shard** - View your current shard!' +
                    '\n**!ping** - View your current ping to the bot!' +
                    '\n**!quote <MessageId>** - Quote a message!' +
                    '\n**!8ball <Question>** - Ask the 8ball!' +
                    '\n**!poll create <Question>;<Option 1>;<Option 2>...** - Start a poll!'
            )
            .setColor(Config.colors.default);

        if (channel instanceof TextChannel) await channel.send(embed);
        else MessageUtils.sendDm(channel, embed);
    }
}
