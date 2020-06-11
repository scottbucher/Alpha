import { EmojiResolvable, MessageReaction, Permissions, TextChannel, User } from 'discord.js';

import { Logger } from '../services';
import { RoleCallRepo, UserRepo } from '../services/database/repos';
import { ActionUtils, FormatUtils, ParseUtils } from '../utils';
import { EventHandler } from './event-handler';

let Logs = require('../../lang/logs.json');
let Config = require('../../config/config.json');

export class ReactionAddHandler implements EventHandler {
    constructor(private userRepo: UserRepo, private roleCallRepo: RoleCallRepo) {}

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

        let checkRefresh = msg.reactions.cache.find(
            reaction =>
                reaction.emoji.name === Config.emotes.refresh &&
                reaction.me &&
                reaction.users.resolve(reactor.id) !== null
        );
        let checkNextPage = msg.reactions.cache.find(
            reaction =>
                reaction.emoji.name === Config.emotes.nextPage &&
                reaction.me &&
                reaction.users.resolve(reactor.id) !== null
        );
        let checkPreviousPage = msg.reactions.cache.find(
            reaction =>
                reaction.emoji.name === Config.emotes.previousPage &&
                reaction.me &&
                reaction.users.resolve(reactor.id) !== null
        );

        if (checkRefresh) await messageReaction.remove();

        if (reactor.hasPermission(Permissions.FLAGS.ADMINISTRATOR) && checkRefresh) {
            // Refresh the role-call

            let roleCallEmbed = await FormatUtils.getRoleCallEmbed(msg.guild, roleCallData);
            msg = await msg.edit('', roleCallEmbed);

            await msg.reactions.removeAll();

            for (let emote of roleCallEmotes) {
                let roleCallRoles = roleCallData // Get an array of Roles under this category
                    .filter(roleCall => roleCall.Emote === emote)
                    .map(roleCall => roleCall.RoleDiscordId);

                let roleCheck = false;

                for (let role of roleCallRoles) {
                    let giveRole = msg.guild.roles.resolve(role);

                    if (!giveRole) continue;
                    else roleCheck = true;
                }

                if (!roleCheck) continue;

                let emoji: EmojiResolvable =
                    FormatUtils.findGuildEmoji(emote, msg.guild) ||
                    FormatUtils.findUnicodeEmoji(emote);
                if (!emoji) continue; // Continue if there is no emoji
                msg.react(emoji); // React with the emote
            }
            msg.react(Config.emotes.refresh); // Add Administrative Recycle Emote
        }

        if (checkNextPage) {
            let titleArgs = msg.embeds[0]?.title.split(' ');

            let page = 1;

            if (titleArgs[4]) {
                try {
                    page = ParseUtils.parseInt(titleArgs[4]) + 1;
                } catch (error) {
                    // Not A Number
                }
                if (!page) page = 1;
            }

            let pageSize = Config.lbPageSize;

            let users = msg.guild.members.cache.filter(member => !member.user.bot).keyArray();

            let userDataResults = await this.userRepo.getLeaderBoardUsers(
                msg.guild.id,
                users,
                pageSize,
                page
            );

            if (page > userDataResults.stats.TotalPages) page = userDataResults.stats.TotalPages;

            msg.edit(
                '',
                await FormatUtils.getXpLeaderBoardEmbed(msg.guild, userDataResults, page, pageSize)
            );

            await msg.reactions.removeAll();

            if (page !== 1) await msg.react(Config.emotes.previousPage);
            if (userDataResults.stats.TotalPages > page) await msg.react(Config.emotes.nextPage);
        } else if (checkPreviousPage) {
            let titleArgs = msg.embeds[0]?.title.split(' ');

            let page = 1;

            if (titleArgs[4]) {
                try {
                    page = ParseUtils.parseInt(titleArgs[4]) - 1;
                } catch (error) {
                    // Not A Number
                }
                if (!page) page = 1;
            }

            let pageSize = Config.lbPageSize;

            let users = msg.guild.members.cache.filter(member => !member.user.bot).keyArray();

            let userDataResults = await this.userRepo.getLeaderBoardUsers(
                msg.guild.id,
                users,
                pageSize,
                page
            );

            if (page > userDataResults.stats.TotalPages) page = userDataResults.stats.TotalPages;

            msg.edit(
                '',
                await FormatUtils.getXpLeaderBoardEmbed(msg.guild, userDataResults, page, pageSize)
            );

            await msg.reactions.removeAll();

            if (page !== 1) await msg.react(Config.emotes.previousPage);
            if (userDataResults.stats.TotalPages > page) await msg.react(Config.emotes.nextPage);
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
                    reaction => reaction.emoji.name === Config.emotes.refresh && reaction.me
                ); // Try and find if the bot has also given this emote on this message
                if (check) {
                    let roleCallRoles = roleCallData // Get an array of Roles under this category
                        .filter(roleCall => roleCall.Emote === emote)
                        .map(roleCall => roleCall.RoleDiscordId);

                    for (let role of roleCallRoles) {
                        let giveRole = msg.guild.roles.resolve(role);

                        await ActionUtils.giveRole(reactor, giveRole);
                    }
                    return;
                }
            }
        }
    }
}
