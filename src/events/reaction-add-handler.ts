import { ActionUtils, FormatUtils, ParseUtils, PermissionUtils } from '../utils';
import {
    Collection,
    EmojiResolvable,
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

        // Check if the reacted message was sent by the bot
        if (messageReaction.message.author !== messageReaction.message.client.user) {
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
            msg = messageReaction.message;
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

        if (reactorMember.hasPermission(Permissions.FLAGS.ADMINISTRATOR) && checkRefresh) {
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

        if (checkNextPage || checkPreviousPage) {
            let titleArgs = msg.embeds[0]?.title.split(' ');

            let page = 1;

            if (titleArgs[4]) {
                try {
                    if (checkNextPage) {
                        page = ParseUtils.parseInt(titleArgs[4]) + 1;
                    } else page = ParseUtils.parseInt(titleArgs[4]) - 1;
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

                        await ActionUtils.giveRole(reactorMember, giveRole);
                    }
                    return;
                }
            }
        }
    }
}
