import { EmojiResolvable, MessageReaction, Permissions, TextChannel, User } from 'discord.js';

import { Logger } from '../services';
import { RoleCallRepo } from '../services/database/repos';
import { ActionUtils, FormatUtils } from '../utils';
import { EventHandler } from './event-handler';

let Logs = require('../../lang/logs.json');
let Config = require('../../config/config.json');

export class ReactionAddHandler implements EventHandler {
    constructor(private roleCallRepo: RoleCallRepo) {}

    public async process(messageReaction: MessageReaction, author: User): Promise<void> {
        if (author.bot) return;

        let reactedEmoji = messageReaction.emoji.name;

        if (messageReaction.message.partial) {
            try {
                await messageReaction.message.fetch();
            } catch (error) {
                Logger.error(Logs.retrievePartialReactionMessageError, error);
                return;
            }
        }

        let msg = messageReaction.message;
        let reactor = msg.guild.members.resolve(author);
        let channel = msg.channel;

        if (!(channel instanceof TextChannel)) return;

        let roleCallData = await this.roleCallRepo.getRoleCalls(msg.guild.id);
        let roleCallEmotes = roleCallData.map(roleCall => roleCall.Emote);

        if (reactedEmoji === Config.refreshEmote) {
            let check = msg.reactions.cache.find(
                reaction => reaction.emoji.name === Config.refreshEmote && reaction.me
            );
            if (reactor.hasPermission(Permissions.FLAGS.ADMINISTRATOR) && check) {
                // check if it's me is not working
                // Refresh the role-call

                let roleCallEmbed = await FormatUtils.getRoleCallEmbed(msg, channel, roleCallData);
                msg = await msg.edit('', roleCallEmbed);
            }

            await msg.reactions.removeAll();

            for (let emote of roleCallEmotes) {
                let emoji: EmojiResolvable =
                    FormatUtils.findGuildEmoji(emote, msg.guild) ||
                    FormatUtils.findUnicodeEmoji(emote);
                if (!emoji) continue; // Continue if there is no emoji
                msg.react(emoji); // React with the emote
            }
            msg.react(Config.refreshEmote); // Add Administrative Recycle Emote
        }

        if (
            !msg.guild.members
                .resolve(msg.client.user)
                .hasPermission(Permissions.FLAGS.MANAGE_ROLES)
        )
            return;

        for (let emote of roleCallEmotes) {
            let emoji: EmojiResolvable =
                FormatUtils.findGuildEmoji(emote, msg.guild) || FormatUtils.findUnicodeEmoji(emote);

            if (!emoji) continue;

            let guildEmoteValue = FormatUtils.findGuildEmoji(emote, msg.guild);

            if (reactedEmoji === emoji || reactedEmoji === guildEmoteValue?.name) {
                let check = msg.reactions.cache.find(
                    reaction => reaction.emoji.name === Config.refreshEmote && reaction.me
                ); // Try and find if the bot has also given this emote on this message
                if (check) {
                    let roleCallRoles = roleCallData // Get an array of Roles under this category
                        .filter(roleCall => roleCall.Emote === emote)
                        .map(roleCall => roleCall.RoleDiscordId);

                    for (let role of roleCallRoles) {
                        let giveRole = msg.guild.roles.resolve(role);

                        ActionUtils.giveRole(reactor, giveRole);
                    }
                    return;
                }
            }
        }
    }
}
