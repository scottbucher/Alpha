import { MessageUtils } from '../utils';
import {
    CollectOptions,
    CollectorUtils,
    ExpireFunction,
    MessageFilter,
} from 'discord.js-collector-utils';
import { DMChannel, Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';
import { GuildRepo } from '../services/database/repos';

let Config = require('../../config/config.json');

const COLLECT_OPTIONS: CollectOptions = {
    time: Config.experience.promptExpireTime * 1000,
    reset: true,
};

export class PollCommand implements Command {
    public name: string = 'poll';
    public aliases = ['survey'];
    public trigger = null;
    public guildOnly: boolean = true;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = false;

    constructor(private guildRepo: GuildRepo) {}

    public async execute(
        args: string[],
        msg: Message,
        channel: TextChannel | DMChannel
    ): Promise<void> {
        let stopFilter: MessageFilter = (nextMsg: Message) =>
            nextMsg.author.id === msg.author.id &&
            [Config.prefix, ...Config.stopCommands].includes(
                nextMsg.content.split(/\s+/)[0].toLowerCase()
            );
        let expireFunction: ExpireFunction = async () => {
            await MessageUtils.send(
                channel,
                new MessageEmbed()
                    .setTitle('Poll Setup - Expired')
                    .setDescription('Type `!poll` to rerun the poll setup.')
                    .setColor(Config.colors.error)
            );
        };
        let guildData = await this.guildRepo.getGuild(msg.guild.id);

        let pollChannelId = guildData.PollChannelId;

        if (pollChannelId === '0') {
            let embed = new MessageEmbed()
                .setColor(Config.colors.error)
                .setDescription('The poll channel is not set.');
            await MessageUtils.send(msg.channel as TextChannel, embed);
            return;
        }

        let pollChannel = msg.guild.channels.resolve(pollChannelId) as TextChannel;

        if (!pollChannel) {
            let embed = new MessageEmbed()
                .setColor(Config.colors.error)
                .setDescription('The poll channel is a deleted channel');
            await MessageUtils.send(msg.channel as TextChannel, embed);
            return;
        }

        let pollQuestion: string;
        let pollOptions: string[] = [];

        let pollQuestionMessage = new MessageEmbed()
            .setAuthor(msg.member.displayName, msg.author.avatarURL())
            .setTitle('Poll Setup - Question Input')
            .setDescription(`Please input the question for your poll: `)
            .setFooter(`This message expires in 2 minutes!`, msg.guild.client.user.avatarURL())
            .setColor(Config.colors.default)
            .setTimestamp();

        let messageQuestion = await MessageUtils.send(channel, pollQuestionMessage);

        pollQuestion = await CollectorUtils.collectByMessage(
            msg.channel,
            // Collect Filter
            (nextMsg: Message) => nextMsg.author.id === msg.author.id,
            stopFilter,
            // Retrieve Result
            async (nextMsg: Message) => {
                if (nextMsg.content.split(' ').length < 3) {
                    let embed = new MessageEmbed()
                        .setDescription('Invalid question!')
                        .setFooter(
                            `Your question must be at least 3 words!`,
                            msg.guild.client.user.avatarURL()
                        )
                        .setTimestamp()
                        .setColor(Config.colors.error);
                    await MessageUtils.send(channel, embed);
                    return;
                }

                return nextMsg.content;
            },
            expireFunction,
            COLLECT_OPTIONS
        );

        await MessageUtils.delete(messageQuestion);

        if (pollQuestion === undefined) {
            return;
        }

        let optionIndex = 0;
        let end = false;

        while (!end) {
            let pollOption: string;

            let pollOptionMessage = new MessageEmbed()
                .setAuthor(msg.member.displayName, msg.author.avatarURL())
                .setTitle('Poll Setup - Option Input')
                .setDescription(`Please input option #${optionIndex + 1}: `)
                .setColor(Config.colors.default)
                .setTimestamp();

            if (optionIndex > 1)
                pollOptionMessage.setFooter(
                    'End option input with "done"',
                    msg.guild.client.user.avatarURL()
                );
            else
                pollOptionMessage.setFooter(
                    `This message expires in 2 minutes!`,
                    msg.guild.client.user.avatarURL()
                );

            let optionMessage = await MessageUtils.send(channel, pollOptionMessage);

            pollOption = await CollectorUtils.collectByMessage(
                msg.channel,
                // Collect Filter
                (nextMsg: Message) => nextMsg.author.id === msg.author.id,
                stopFilter,
                // Retrieve Result
                async (nextMsg: Message) => {
                    return nextMsg.content;
                },
                expireFunction,
                COLLECT_OPTIONS
            );

            await MessageUtils.delete(optionMessage);

            if (pollOption === undefined) {
                return;
            }

            if (optionIndex === 9 || (optionIndex > 1 && pollOption.toLowerCase() === 'done')) {
                end = true;
            } else {
                pollOptions.push(pollOption);
                optionIndex++;
            }
        }

        let reactOptions = [
            Config.emotes.zero,
            Config.emotes.one,
            Config.emotes.two,
            Config.emotes.three,
            Config.emotes.four,
            Config.emotes.five,
            Config.emotes.six,
            Config.emotes.seven,
            Config.emotes.eight,
            Config.emotes.nine,
        ];

        let pollEmbed = new MessageEmbed()
            .setAuthor(msg.member.displayName, msg.author.avatarURL())
            .setTitle(`New Poll, Vote Now!`)
            .setFooter('Vote with the emote(s) you want!', msg.client.user.avatarURL())
            .setColor(Config.colors.default)
            .setTimestamp();

        let description = `__**${pollQuestion}**__\n`;
        let i = 0;

        for (let option of pollOptions) {
            description += `${reactOptions[i]} ${option}\n`;
            i++;
        }

        pollEmbed.setDescription(description);

        let channelMessage = await MessageUtils.send(pollChannel, pollEmbed);

        for (let c = 0; c < optionIndex; c++)
            await MessageUtils.react(channelMessage, reactOptions[c]);
    }
}
