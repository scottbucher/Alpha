import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';
import { MessageUtils } from '../utils';

let Config = require('../../config/config.json');

export class TestCommand implements Command {
    public name: string = 'test';
    public aliases = ['yeet'];
    public guildOnly: boolean = false;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;
    public help: string = '!help';

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        let embed = new MessageEmbed()
            .setTitle('Test Bot Command')
            .setDescription(
                'This is a test command because tbh I have no clue what I am doing in type script but here I am :shrug:'
            )
            .addField('Do I know what I am doing?', 'Nope')
            .addField('Am I here anyways?', 'yup')
            .setAuthor('Testing Bot Command', msg.client.user.avatarURL())
            .setColor(Config.colors.default);

        if (channel instanceof TextChannel) await channel.send(embed);
        else MessageUtils.sendDm(channel, embed);
    }
}
