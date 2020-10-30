import {
    DMChannel,
    GuildMember,
    Message,
    MessageEmbed,
    Permissions,
    TextChannel,
} from 'discord.js';
import { GuildRepo, RewardRepo, UserRepo } from '../services/database/repos';
import { MessageUtils, XpUtils } from '../utils';

import { Command } from '../commands';
import { EventHandler } from './event-handler';
import { Logger } from '../services';

let Config = require('../../config/config.json');

export class MessageHandler implements EventHandler {
    constructor(
        private defaultHelpCommand: Command,
        private commands: Command[],
        private guildRepo: GuildRepo,
        private userRepo: UserRepo,
        private rewardRepo: RewardRepo
    ) {}

    public async process(msg: Message): Promise<void> {
        if (msg.partial) return;

        // Ignore bots & System messages
        if (msg.author.bot || msg.system) return;

        let channel = msg.channel;

        if (!(channel instanceof TextChannel || channel instanceof DMChannel)) return;

        if (channel instanceof TextChannel) {
            let userData = await this.userRepo.getUser(msg.author.id, msg.guild.id);

            if (XpUtils.canGetXp(userData.LastUpdated)) {
                // Can get xp?
                let playerXp = userData.XpAmount;
                let currentLevel = XpUtils.getLevelFromXp(playerXp); // Get current level

                playerXp += XpUtils.randomXp();

                // Update User
                await this.userRepo.updateUser(msg.member.id, msg.guild.id, playerXp);

                let newLevel = XpUtils.getLevelFromXp(playerXp); // Get new level
                if (XpUtils.isLevelUp(currentLevel, newLevel)) {
                    // xpLevelup instance
                    XpUtils.onLevelUp(msg.member, newLevel, this.guildRepo, this.rewardRepo);
                }
            }

            if (!channel.permissionsFor(msg.guild.me).has(Permissions.FLAGS.SEND_MESSAGES)) {
                // We can't even send a message to this guild
                return;
            }
        }

        let args = msg.content.split(/\s+/); // Splits consecutive number of whitespace

        let guildData = await this.guildRepo.getGuild(msg.guild?.id);

        for (let cmd of this.commands) {
            if (cmd.trigger && cmd.trigger.test(msg.content)) {
                await cmd.execute(args, msg, channel);
                return;
            }
        }

        if (!args[0].toLowerCase().startsWith(guildData.Prefix)) return;

        if (args[0].toLowerCase() === guildData.Prefix) {
            // Send default help message
            this.defaultHelpCommand.execute(args, msg, channel);
            return;
        }

        args[0] = args[0].replace(guildData.Prefix, '');

        let userCommand = args[0];
        let command = this.getCommand(userCommand);

        // If we can't find a command then run the default help message
        if (!command) {
            // help command
            this.defaultHelpCommand.execute(args, msg, channel);
            return;
        }

        if (args.length === 1 && args[0] === 'help') {
            // if it is just the default help send it
            this.defaultHelpCommand.execute(args, msg, channel);
            return;
        }

        if (command.ownerOnly && !Config.ownerIds.includes(msg.author.id)) {
            let embed = new MessageEmbed()
                .setDescription('This command can only be used by the bot owner!')
                .setColor(Config.colors.error);

            if (channel instanceof TextChannel) await channel.send(embed);
            else MessageUtils.send(channel, embed);
            return;
        }

        if (command.guildOnly && channel instanceof DMChannel) {
            let embed = new MessageEmbed()
                .setDescription('This command can only be used in a discord server!')
                .setColor(Config.colors.error);
            MessageUtils.send(channel, embed);
            return;
        }

        channel.startTyping();
        try {
            if (channel instanceof TextChannel) {
                let member = msg.member;

                if (!this.hasPermission(member, command)) {
                    let embed = new MessageEmbed()
                        .setTitle('Insufficient Permission')
                        .setDescription(
                            'You do not have the required permission to run this command!'
                        )
                        .setColor(Config.colors.error);
                    await channel.send(embed);
                    return;
                }
                await command.execute(args, msg, channel);
            }
        } catch (error) {
            // Let the user know that something went wrong
            Logger.error('The message-handler.ts class encountered an error!', error);
            try {
                let embed = new MessageEmbed()
                    .setDescription('Error encountered, something went wrong!')
                    .addField('Error code', msg.id)
                    .addField('Please contact support', '__**Stqlth#0001**__')
                    .setColor(Config.colors.error);

                if (channel instanceof TextChannel) await channel.send(embed);
                else MessageUtils.send(channel, embed);
            } catch {
                // ignored
            }
        }
        channel.stopTyping(true);
    }

    private getCommand(userCommand: string) {
        userCommand = userCommand.toLowerCase();
        for (let cmd of this.commands) {
            if (cmd.name === userCommand.toLowerCase()) {
                return cmd;
            }

            if (cmd.aliases.includes(userCommand)) {
                return cmd;
            }
        }
    }

    private hasPermission(member: GuildMember, command: Command): boolean {
        if (command.adminOnly) {
            return member.hasPermission(Permissions.FLAGS.ADMINISTRATOR); // return true if they have admin
        }
        return true;
    }
}
