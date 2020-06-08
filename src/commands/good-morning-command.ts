import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';

let Config = require('../../config/config.json');

export class GoodMorningCommand implements Command {
    public name: string = 'goodmorning';
    public aliases = ['gm'];
    public trigger = /g+o+d+\s*m+o+r+n+i+n+/i;
    public guildOnly: boolean = false;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;

    public async execute(args: string[], msg: Message, channel: TextChannel) {
        let embed = new MessageEmbed()
            .setDescription(`Good morning ${msg.author.toString()}!`)
            .setColor(Config.colors.default);

        await channel.send(embed);
    }
}
