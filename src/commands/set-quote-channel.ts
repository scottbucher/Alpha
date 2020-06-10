import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';
import { GuildRepo } from '../services/database/repos/guild-repo';
import { PermissionUtils } from '../utils';

let Config = require('../../config/config.json');

export class SetQuoteChannelCommand implements Command {
    public name: string = 'setquotechannel';
    public aliases = ['updatequotechannel'];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = true;
    public help: string = 'Sets the Quote Channel.';

    constructor(private guildRepo: GuildRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        if (args.length === 1) {
            this.guildRepo.updateGuildQuoteChannel(msg.guild.id, channel.id); // Update Leveling Channel
            let embed = new MessageEmbed()
                .setDescription(`Successfully set the quote channel to <#${channel.id}>!`)
                .setColor(Config.colors.success);

            await channel.send(embed); // Send confirmation of completion
            return;
        }

        // Find mentioned channel
        let channelInput: TextChannel = msg.mentions.channels.first();

        if (!channelInput) {
            channelInput = msg.guild.channels.cache
                .filter(channel => channel instanceof TextChannel)
                .map(channel => channel as TextChannel)
                .find(channel => channel.name.toLowerCase().includes(args[1].toLowerCase()));
        }

        if (!channelInput || channelInput.guild.id !== msg.guild.id) {
            let embed = new MessageEmbed()
                .setDescription('Invalid channel!')
                .setColor(Config.colors.error);

            await channel.send(embed);
            return;
        }

        if (!PermissionUtils.canSend(channel)) {
            let embed = new MessageEmbed()
                .setDescription(`I don't have permission to send messages in <#${channel.id}>!`)
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        this.guildRepo.updateGuildQuoteChannel(msg.guild.id, channelInput.id); // Update Quote Channel

        let embed = new MessageEmbed()
            .setDescription(`Successfully set the quote channel to <#${channelInput.id}>!`)
            .setColor(Config.colors.success);
        await channel.send(embed); // Send confirmation of completion
    }
}
