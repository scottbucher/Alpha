import { Message, MessageEmbed, TextChannel, DMChannel } from 'discord.js';

import { Command } from './command';

let Config = require('../../config/config.json');

export class GoodnightCommand implements Command {
    public name: string = 'goodnight';
    public aliases = ['gn'];
    public trigger = /g+o+d+\s*n+i+g+h+t+/i;
    public guildOnly: boolean = false;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;

    public async execute(args: string[], msg: Message, channel: TextChannel | DMChannel) {
        let embed = new MessageEmbed()
            .setDescription(`Goodnight ${msg.author.toString()}!`)
            .setColor(Config.colors.default);

        await channel.send(embed);
    }
}
