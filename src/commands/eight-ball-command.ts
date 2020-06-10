import { DMChannel, Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';

let Config = require('../../config/config.json');
let EightBall = require('../../config/eight-ball.json');

const HUNTER_REGEX = /(hunter|draxi|reed).*smoke/i;

export class EightBallCommand implements Command {
    public name: string = '8ball';
    public aliases: string[] = ['eightball', 'magicball', 'magiceightball', 'magic8ball', '8b'];
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

        if (HUNTER_REGEX.test(msg.content)) {
            let embed = new MessageEmbed().setDescription('Yes.').setColor(Config.colors.success);
            await channel.send(embed);
            return;
        }

        let outCome = Math.floor(Math.random() * 3); // 0 = no, 1 = yes, 2 = maybe
        let embed = new MessageEmbed();

        if (outCome === 0) {
            embed
                .setDescription(EightBall.no[Math.floor(Math.random() * EightBall.no.length)])
                .setColor(Config.colors.error);
        } else if (outCome === 1) {
            embed
                .setDescription(EightBall.yes[Math.floor(Math.random() * EightBall.yes.length)])
                .setColor(Config.colors.success);
        } else if (outCome === 2) {
            embed
                .setDescription(EightBall.maybe[Math.floor(Math.random() * EightBall.maybe.length)])
                .setColor(Config.colors.default);
        }

        await channel.send(embed);
    }
}
