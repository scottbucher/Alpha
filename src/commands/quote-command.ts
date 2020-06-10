import { GuildMember, Message, MessageEmbed, TextChannel } from 'discord.js';
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
                .setDescription(`This guild doesn't have a quote channel set!`)
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

        let messageLinkData = MessageUtils.extractMessageLinkData(args[1]);
        let textChannels = msg.guild.channels.cache
            .filter(channel => channel instanceof TextChannel)
            .map(channel => channel as TextChannel);

        let originChannel: TextChannel;
        let originMessage: Message;

        if (!messageLinkData) {
            for (let textChannel of textChannels) {
                try {
                    let message = await textChannel.messages.fetch(args[1]);
                    if (message) {
                        originChannel = textChannel;
                        originMessage = message;
                        break;
                    }
                } catch {
                    // Ignore fetch failure
                }
            }
        } else {
            originChannel = textChannels.find(channel => channel.id === messageLinkData.ChannelId);
            originMessage = await originChannel?.messages.fetch(messageLinkData.MessageId);
        }

        if (!(originChannel && originMessage)) {
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
            let embed = await FormatUtils.getQuoteEmbed(target.user, msg.member, quote);
            await quoteChannel.send(embed);
            return;
        }

        // Cannot find message!
        if (!(originChannel && originMessage)) {
            let embed = new MessageEmbed()
                .setTitle('Invalid Input!')
                .setDescription('Please specify a valid message id, link, or user')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        let embed = await FormatUtils.getQuoteEmbed(
            originMessage.author,
            msg.member,
            originMessage.content
        );
        await quoteChannel.send(embed);
    }
}
