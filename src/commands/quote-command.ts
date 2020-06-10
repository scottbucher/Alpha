import { Collection, GuildMember, Message, MessageEmbed, TextChannel } from 'discord.js';
import { FormatUtils, MessageUtils } from '../utils';

import { Command } from './command';
import { GuildRepo } from '../services/database/repos';

let Config = require('../../config/config.json');

export class QuoteCommand implements Command {
    public name: string = 'quote';
    public aliases: string[] = ['q'];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = false;
    public ownerOnly = false;

    constructor(private guildRepo: GuildRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        let guildData = await this.guildRepo.getGuild(msg.guild.id);

        let quoteChannel = msg.guild.channels.resolve(guildData.QuoteChannelId) as TextChannel;

        if (!quoteChannel) {
            let embed = new MessageEmbed()
                .setDescription('This guild doesn\'t have a quote channel set!')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        if (args.length < 2) {
            let embed = new MessageEmbed()
                .setDescription('Please specify a message id, link, or user')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        let data = MessageUtils.extractMessageId(args[1]);
        let channels = msg.guild.channels.cache.filter(
            channel => channel.type === 'text'
        ) as Collection<string, TextChannel>;

        let originChannel: TextChannel;
        let originMessage: Message;

        if (!data) {
            for (let channel of channels.array()) {
                let message = await channel.messages.fetch(args[1]);
                if (message) {
                    originChannel = channel;
                    originMessage = message;
                    break;
                }
            }
        } else {
            originChannel = channels.find(channel => channel.id === data.ChannelId);
            originMessage = await originChannel?.messages.fetch(data.MessageId);
        }

        // Cannot find message!
        if (!(originChannel && originMessage)) {
            let embed = new MessageEmbed()
                .setDescription('Could not find that message!')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        if (!data) {
            let target: GuildMember;

            target =
                msg.mentions.members.first() ||
                msg.guild.members.cache.find(
                    member =>
                        member.displayName.toLowerCase().includes(args[1].toLowerCase()) ||
                        member.user.username.toLowerCase().includes(args[1].toLowerCase())
                );

            if (!target) {
                let embed = new MessageEmbed()
                    .setTitle('Invalid Input!')
                    .setDescription('Please specify a valid message id, link, or user')
                    .setColor(Config.colors.error);
                await channel.send(embed);
                return;
            }

            if (args.length < 3) {
                let embed = new MessageEmbed()
                    .setTitle('Invalid Input!')
                    .setDescription('Please supply a quote!')
                    .setColor(Config.colors.error);
                await channel.send(embed);
                return;
            }

            // Get data and send

            let quote = args.slice(2, args.length).join(' ');
            await quoteChannel.send(
                await FormatUtils.getQuoteEmbed(target.user, msg.member, quote)
            );
        }

        if (!originChannel) {
            let embed = new MessageEmbed()
                .setTitle('Invalid Input!')
                .setDescription('Please specify a valid message id, link, or user')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        let quote = await originChannel.messages.fetch(data.MessageId);
        let quoted = quote.author;

        await quoteChannel.send(await FormatUtils.getQuoteEmbed(quoted, msg.member, quote.content));
    }
}
