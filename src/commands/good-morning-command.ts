import { DMChannel, Message, MessageEmbed, TextChannel } from 'discord.js';

import { ArrayUtils, MessageUtils } from '../utils';
import { Command } from './command';

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
            .setDescription(`${emoji} **Good morning ${msg.author.toString()}!** ${emoji}`)
            .setColor(Config.colors.default);
        await MessageUtils.send(channel, embed);
    }
}
