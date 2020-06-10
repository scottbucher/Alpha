import { DMChannel, Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';

let Config = require('../../config/config.json');
let EightBall = require('../../config/eightball.json');

export class EightBallCommand implements Command {
    public name: string = '8ball';
    public aliases: string[] = ['eightball', 'magicball', '8magiceightball', 'magic8ball', '8b'];
    public trigger = null;
    public guildOnly = false;
    public adminOnly = false;
    public ownerOnly = false;

    public async execute(
        args: string[],
        msg: Message,
        channel: TextChannel | DMChannel
    ): Promise<void> {
        if (args.length === 1) {
            let embed = new MessageEmbed()
                .setDescription(
                    'Discord TOS says I am not allowed to read your mind so you\'re going to have to ask a question.'
                )
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        if (!args[args.length - 1].includes('?')) {
            let embed = new MessageEmbed()
                .setDescription('Shouldn\'t you have learned proper punctuation at school?')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        if (
            msg.content
                .toLowerCase()
                .includes('does hunter smoke') /*&& msg.guild.id === '468268307573768194'*/
        ) {
            let embed = new MessageEmbed().setDescription('Yes.').setColor(Config.colors.success);
            await channel.send(embed);
            return;
        }

        let outCome = Math.floor(Math.random() * 3); // 0 = no, 1 = yes, 2 = maybe
        let embed = new MessageEmbed();

        if (outCome === 0) {
            embed
                .setDescription(
                    EightBall.messages.no[Math.floor(Math.random() * EightBall.messages.no.length)]
                )
                .setColor(Config.colors.error);
        } else if (outCome === 1) {
            embed
                .setDescription(
                    EightBall.messages.yes[Math.floor(Math.random() * EightBall.messages.yes.length)]
                )
                .setColor(Config.colors.success);
        } else if (outCome === 2) {
            embed
                .setDescription(
                    EightBall.messages.maybe[
                        Math.floor(Math.random() * EightBall.messages.maybe.length)
                    ]
                )
                .setColor(Config.colors.default);
        }

        await channel.send(embed);
    }
}
