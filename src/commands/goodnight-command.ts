import { DMChannel, Message, MessageEmbed, TextChannel } from 'discord.js';

import { ArrayUtils, MessageUtils } from '../utils';
import { Command } from './command';

let Config = require('../../config/config.json');

export class GoodnightCommand implements Command {
    public name: string = 'goodnight';
    public aliases = ['gn'];
    public trigger = /g+o+d+\s*n+i+g+h+t+/i;
    public guildOnly: boolean = false;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;

    private emojis = ['😴', '😪', '🌃', '✨', '💤', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

    public async execute(
        args: string[],
        msg: Message,
        channel: TextChannel | DMChannel
    ): Promise<void> {
        let emoji = ArrayUtils.chooseRandom(this.emojis);
        let embed = new MessageEmbed()
            .setDescription(`${emoji} **Goodnight ${msg.author.toString()}!** ${emoji}`)
            .setColor(Config.colors.default);
        await MessageUtils.send(channel, embed);
    }
}
