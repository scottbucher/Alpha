import { Message, MessageEmbed, TextChannel, User } from 'discord.js';

import { GuildRepo } from '../services/database/repos';
import { FormatUtils, MessageUtils } from '../utils';
import { Command } from './command';

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
                .setDescription(`This guild doesn't have a quote channel set!`)
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        if (args.length < 2) {
            let embed = new MessageEmbed()
                .setDescription('Please specify a message id, link, or user')
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        let messageLinkData = MessageUtils.extractMessageLinkData(args[1]);
        let textChannels = msg.guild.channels.cache
            .filter(channel => channel instanceof TextChannel)
            .map(channel => channel as TextChannel);

        let quote: string;
        let author: User;

        if (!messageLinkData) {
            for (let textChannel of textChannels) {
                try {
                    let message = await textChannel.messages.fetch(args[1]);
                    if (message) {
                        quote = message.content;
                        author = message.author;
                        break;
                    }
                } catch {
                    // Ignore fetch failure
                }
            }
        } else {
            let channel = textChannels.find(channel => channel.id === messageLinkData.ChannelId);
            let message = await channel?.messages.fetch(messageLinkData.MessageId);
            if (message) {
                quote = message.content;
                author = message.author;
            }
        }

        if (!(quote && author)) {
            author =
                msg.mentions.members.first()?.user ??
                msg.guild.members.cache.find(
                    member =>
                        member.displayName.toLowerCase().includes(args[1].toLowerCase()) ||
                        member.user.username.toLowerCase().includes(args[1].toLowerCase())
                )?.user;

            if (!author) {
                let embed = new MessageEmbed()
                    .setTitle('Invalid Input!')
                    .setDescription('Please specify a valid message id, link, or user')
                    .setColor(Config.colors.error);
                await MessageUtils.send(channel, embed);
                return;
            }

            if (args.length < 3) {
                let embed = new MessageEmbed()
                    .setTitle('Invalid Input!')
                    .setDescription('Please supply a quote!')
                    .setColor(Config.colors.error);
                await MessageUtils.send(channel, embed);
                return;
            }

            // Get data and send
            quote = args.slice(2, args.length).join(' ');
        }

        // Cannot find message!
        if (!(quote && author)) {
            let embed = new MessageEmbed()
                .setTitle('Invalid Input!')
                .setDescription('Please specify a valid message id, link, or user')
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        let embed = await FormatUtils.getQuoteEmbed(author, msg.member, quote);
        await MessageUtils.send(quoteChannel, embed);
    }
}
