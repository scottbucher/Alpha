import {
    DMChannel,
    GuildMember,
    Message,
    MessageEmbed,
    Permissions,
    TextChannel,
} from 'discord.js';

import { Command } from '../commands/command';
import { EventHandler } from './event-handler';
import { GuildRepo } from '../services/database/repos/guild-repo';
import { Logger } from '../services';
import { MessageUtils } from '../utils/message-utils';
import { RewardRepo } from '../services/database/repos/reward-repo';
import { UserRepo } from '../services/database/repos/user-repo';
import { XpUtils } from '../utils/xp-utils';

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

        let guildData = await this.guildRepo.getGuild(msg.guild.id);

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

        if (command.ownerOnly && !Config.ownerIds.include(msg.author.id)) {
            let embed = new MessageEmbed()
                .setDescription('This command can only be used by the bot owner!')
                .setColor(0xff0000);

            if (channel instanceof TextChannel) await channel.send(embed);
            else MessageUtils.sendDm(channel, embed);
            return;
        }

        if (command.guildOnly && channel instanceof DMChannel) {
            let embed = new MessageEmbed()
                .setDescription('This command can only be used in a discord server!')
                .setColor(0xff0000);
            MessageUtils.sendDm(channel, embed);
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
                        .setColor(0xff0000);
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
                    .addField('Please contact support', '<@478288246858711040>')
                    .setColor(0xff0000);

                if (channel instanceof TextChannel) await channel.send(embed);
                else MessageUtils.sendDm(channel, embed);
            } catch {
                // ignored
            }
        }
        channel.stopTyping();
    }

    private getCommand(userCommand: string) {
        for (let cmd of this.commands) {
            if (cmd.name === userCommand.toLowerCase()) {
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
