import { EmojiResolvable, MessageReaction, TextChannel, User } from 'discord.js';

import { Logger } from '../services';
import { RoleCallRepo } from '../services/database/repos';
import { ActionUtils, FormatUtils } from '../utils';
import { EventHandler } from './event-handler';

let Logs = require('../../lang/logs.json');
let Config = require('../../config/config.json');

export class ReactionRemoveHandler implements EventHandler {
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

        for (let emote of roleCallEmotes) {
            let emoji: EmojiResolvable =
                FormatUtils.findGuildEmoji(emote, msg.guild) || FormatUtils.findUnicodeEmoji(emote);

            if (!emoji) continue;

            let guildEmoteValue = FormatUtils.findGuildEmoji(emote, msg.guild);

            if (reactedEmoji === emoji || reactedEmoji === guildEmoteValue?.name) {
                let check = msg.reactions.cache.find(
                    reaction => reaction.emoji.name === Config.refreshEmote && reaction.me
                );
                if (check) {
                    let roleCallRoles = roleCallData // Get an array of Roles under this category
                        .filter(roleCall => roleCall.Emote === emote)
                        .map(roleCall => roleCall.RoleDiscordId);

                    for (let role of roleCallRoles) {
                        let giveRole = msg.guild.roles.resolve(role);

                        await ActionUtils.removeRole(reactor, giveRole);
                    }
                    return;
                }
            }
        }
    }
}
