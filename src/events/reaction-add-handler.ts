import { ActionUtils, FormatUtils, MessageUtils, PermissionUtils } from '../utils';
import {
    Collection,
    EmojiResolvable,
    GuildMember,
    Message,
    MessageReaction,
    Permissions,
    TextChannel,
    User,
} from 'discord.js';
import { RoleCallRepo, UserRepo } from '../services/database/repos';

import { EventHandler } from './event-handler';
import { Logger } from '../services';

let Logs = require('../../lang/logs.json');
let Config = require('../../config/config.json');

export class ReactionAddHandler implements EventHandler {
    constructor(private userRepo: UserRepo, private roleCallRepo: RoleCallRepo) {}

    public async process(messageReaction: MessageReaction, reactor: User): Promise<void> {
        // Don't respond to bots, and only text channels
        if (reactor.bot || !(messageReaction.message.channel instanceof TextChannel)) return;

        let reactedEmoji = messageReaction.emoji.name;

        // Check permissions needed to respond
        let channel = messageReaction.message.channel as TextChannel;
        if (
            !PermissionUtils.canSend(channel) ||
            !PermissionUtils.canHandleReaction(channel) ||
            !PermissionUtils.canReact(channel)
        ) {
            return;
        }

        // Get the reacted message
        let msg: Message;
        if (messageReaction.message.partial) {
            try {
                msg = await messageReaction.message.fetch();
            } catch (error) {
                Logger.error(Logs.error.messagePartial, error);
                return;
            }
        } else {
            msg = messageReaction.message as Message;
        }

        // Check if the reacted message was sent by the bot
        if (messageReaction.message.author !== messageReaction.message.client.user) {
            return;
        }

        let users: Collection<string, User>;
        try {
            users = await messageReaction.users.fetch();
        } catch (error) {
            Logger.error(Logs.error.userFetch, error);
            return;
        }

        // Check if bot has reacted to the message before
        if (!users.find(user => user === msg.client.user)) {
            return;
        }

        let checkNextPage: boolean = messageReaction.emoji.name === Config.emotes.nextPage;
        let checkPreviousPage: boolean = messageReaction.emoji.name === Config.emotes.previousPage;

        let checkRefresh: boolean = messageReaction.emoji.name === Config.emotes.refresh;

        if (checkRefresh) {
            try {
                await messageReaction.users.remove(reactor);
            } catch (error) {
                // Reaction Remove Failed
            }
        }

        let roleCallData = await this.roleCallRepo.getRoleCalls(msg.guild.id);
        let roleCallEmotes = roleCallData.map(roleCall => roleCall.Emote);

        let reactorMember = msg.guild.members.resolve(reactor);

        if (reactorMember.permissions.has(Permissions.FLAGS.ADMINISTRATOR) && checkRefresh) {
            // Refresh the role-call

            let roleCallEmbed = await FormatUtils.getRoleCallEmbed(msg.guild, roleCallData);
            msg = await MessageUtils.edit(msg, roleCallEmbed);

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
                await MessageUtils.react(msg, emoji); // React with the emote
            }
            await MessageUtils.react(msg, Config.emotes.refresh); // Add Administrative Recycle Emote
        }

        let titleArgs = msg.embeds[0]?.title?.split(/\s+/);

        if (!titleArgs) return;

        if (checkNextPage || checkPreviousPage) {
            let oldPage: number;
            let page = 1;

            if (titleArgs[4]) {
                try {
                    oldPage = parseInt(titleArgs[4]);
                    if (checkNextPage) page = oldPage + 1;
                    else page = oldPage - 1;
                } catch (error) {
                    // Not A Number
                }
                if (!page) page = 1;
            }

            let pageSize = Config.lbPageSize;

            let members: Collection<string, GuildMember>;

            try {
                members = await msg.guild.members.fetch();
            } catch (error) {
                members = msg.guild.members.cache;
            }

            let users = [...members.filter(member => !member.user.bot).keys()];

            let userDataResults = await this.userRepo.getLeaderBoardUsers(
                msg.guild.id,
                users,
                pageSize,
                page
            );

            if (
                (oldPage === 1 && checkPreviousPage) || // if the old page was page 1 and they are trying to decrease
                (oldPage === userDataResults.stats.TotalPages && checkNextPage) // if the  old page was the max page and they are trying to increase
            ) {
                await messageReaction.users.remove(reactor);
                return;
            }

            if (page > userDataResults.stats.TotalPages) page = userDataResults.stats.TotalPages;

            let embed = await FormatUtils.getXpLeaderBoardEmbed(
                msg.guild,
                userDataResults,
                page,
                pageSize
            );
            await MessageUtils.edit(msg, embed);

            if (page !== 1) await MessageUtils.react(msg, Config.emotes.previousPage);
            if (userDataResults.stats.TotalPages > page)
                await MessageUtils.react(msg, Config.emotes.nextPage);

            await messageReaction.users.remove(reactor);
        }

        if (
            !msg.guild.members
                .resolve(msg.client.user)
                .permissions.has(Permissions.FLAGS.MANAGE_ROLES)
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

                        await ActionUtils.giveRole(reactorMember, giveRole);
                    }
                    return;
                }
            }
        }
    }
}
