import { Message, MessageEmbed, TextChannel, DMChannel } from 'discord.js';

import { Command } from './command';
import { ArrayUtils } from '../utils';

let Config = require('../../config/config.json');

export class GoodMorningCommand implements Command {
    public name: string = 'goodmorning';
    public aliases = ['gm'];
    public trigger = /g+o+d+\s*m+o+r+n+i+n+/i;
    public guildOnly: boolean = false;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;

    private emojis = ['🔅', '🔆', '☀️', '🌅', '🌄', '☕', '🥞'];

    public async execute(args: string[], msg: Message, channel: TextChannel | DMChannel) {
        let emoji = ArrayUtils.chooseRandom(this.emojis);
        let embed = new MessageEmbed()
            .setDescription(
                `${emoji}\u2800 **Good morning ${msg.author.toString()}!** \u2800${emoji}` // U+2800 = Braille Blank
            )
            .setColor(Config.colors.default);
        await channel.send(embed);
    }
}
