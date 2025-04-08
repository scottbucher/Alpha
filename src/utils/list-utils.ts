import {
    ActionRowData,
    ButtonComponentData,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    Guild,
} from 'discord.js';
import { createRequire } from 'node:module';

import { ButtonData, EventData, PageStats } from '../models/index.js';
import { Lang } from '../services/index.js';
import { ExperienceUtils, FormatUtils } from './index.js';
import { DatabaseUtils } from './database-utils.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

// Class which handles list embed generation
export class ListUtils {
    public static getPageStats(page: number, pageSize: number, itemLength: number): PageStats {
        let totalPages = Math.ceil(itemLength / pageSize);

        if (totalPages === 0) totalPages = 1;

        if (page > totalPages) page = totalPages;
        else if (page < 1) page = 1;

        // Calculate the starting and ending index of the list
        let startIndex = (page - 1) * pageSize;
        let endIndex = startIndex + pageSize;

        // Calculate stats
        let totalMessages = itemLength;

        return new PageStats(startIndex, endIndex, totalPages, totalMessages, page);
    }

    public static getListButtonComponentData(
        guild: Guild,
        channelId: string,
        names: string[],
        page: number,
        disabled: boolean = false
    ): ActionRowData<ButtonComponentData> {
        return {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    customId: JSON.stringify(<ButtonData>{
                        id: names.join(' '),
                        ch: channelId,
                        pg: page - 5,
                    }),
                    emoji: Lang.getEmoji('fastBack', guild),
                    style: ButtonStyle.Primary,
                    disabled,
                },
                {
                    type: ComponentType.Button,
                    customId: JSON.stringify(<ButtonData>{
                        id: names.join(' '),
                        ch: channelId,
                        pg: page - 1,
                    }),
                    emoji: Lang.getEmoji('back', guild),
                    style: ButtonStyle.Primary,
                    disabled,
                },
                {
                    type: ComponentType.Button,
                    customId: JSON.stringify(<ButtonData>{
                        id: names.join(' '),
                        ch: channelId,
                        pg: page,
                    }),
                    emoji: Lang.getEmoji('reuse', guild),
                    style: ButtonStyle.Primary,
                    disabled,
                },
                {
                    type: ComponentType.Button,
                    customId: JSON.stringify(<ButtonData>{
                        id: names.join(' '),
                        ch: channelId,
                        pg: page + 1,
                    }),
                    emoji: Lang.getEmoji('forward', guild),
                    style: ButtonStyle.Primary,
                    disabled,
                },
                {
                    type: ComponentType.Button,
                    customId: JSON.stringify(<ButtonData>{
                        id: names.join(' '),
                        ch: channelId,
                        pg: page + 5,
                    }),
                    emoji: Lang.getEmoji('fastForward', guild),
                    style: ButtonStyle.Primary,
                    disabled,
                },
            ],
        };
    }

    public static async getLeaderBoardFullEmbed(
        guild: Guild,
        memberIds: string[],
        page: number,
        data: EventData
    ): Promise<{ embed: EmbedBuilder; pageStats: PageStats }> {
        let embed: EmbedBuilder;
        let description = '';

        let pageStats = ListUtils.getPageStats(page, Config.pageSize.leaderboard, memberIds.length);

        if (pageStats.totalItems === 0) {
            description += Lang.getRef('info', 'lists.emptyList', data.lang);
        }

        let { GuildData: _, GuildUserData: guildMemberDatas } =
            await DatabaseUtils.getOrCreateDataForGuild(data.em, guild, memberIds, data.guildData);

        // Sort the guild member datas by xp, highest to lowest
        guildMemberDatas.sort((a, b) => b.experience - a.experience);

        //slice the guild member datas to the page stats
        guildMemberDatas = guildMemberDatas.slice(pageStats.startIndex, pageStats.endIndex);

        let rank = pageStats.startIndex + 1;

        for (let i = 0; i < guildMemberDatas.length; i++) {
            let guildMemberData = guildMemberDatas[i];
            description += `${Lang.getRef('info', 'lists.leaderBoardEntry', data.lang, {
                RANK: rank.toLocaleString(),
                USER_MENTION: FormatUtils.userMention(guildMemberData.userDiscordId),
            })}\n${Lang.getRef('info', 'lists.leaderBoardEntryInfo', data.lang, {
                LEVEL: ExperienceUtils.getLevelFromXp(guildMemberData.experience).toLocaleString(),
                TOTAL_XP: guildMemberData.experience.toLocaleString(),
            })}`;

            // Add spacing only if this isn't the last member in the list
            if (i < guildMemberDatas.length - 1) {
                description += '\n\n';
            }

            rank++;
        }

        embed = Lang.getEmbed('info', 'lists.leaderboard', data.lang, {
            PAGE: `${pageStats.page > 0 ? pageStats.page.toString() : '1'}`,
            TOTAL_PAGES: `${pageStats.totalPages > 0 ? pageStats.totalPages.toString() : '1'}`,
            LIST_DATA: description,
            TOTAL_MEMBERS: pageStats.totalItems.toString(),
            ICON: guild.client.user.displayAvatarURL(),
        });

        return { embed: embed.setThumbnail(guild.iconURL()), pageStats };
    }

    public static async getRewardListEmbed(
        guild: Guild,
        page: number,
        data: EventData
    ): Promise<{ embed: EmbedBuilder; pageStats: PageStats }> {
        let embed: EmbedBuilder;
        let description = '';

        let levelingRewardDatas = data.guildData.levelingRewardDatas.getItems();

        // TODO: when we add leveling rewards that aren't roles, we will need a more dynamic way of filtering and constructing the description
        levelingRewardDatas = levelingRewardDatas.filter(
            levelingRewardData => levelingRewardData.roleDiscordIds.length > 0
        );

        if (!levelingRewardDatas || levelingRewardDatas.length === 0) {
            description += Lang.getRef('info', 'lists.emptyList', data.lang);
        }

        levelingRewardDatas.sort((a, b) => a.level - b.level);

        let pageStats = ListUtils.getPageStats(
            page,
            Config.pageSize.rewards,
            levelingRewardDatas.length
        );

        levelingRewardDatas = levelingRewardDatas.slice(pageStats.startIndex, pageStats.endIndex);
        let guildRoles = await guild.roles.fetch();

        for (let i = 0; i < levelingRewardDatas.length; i++) {
            let levelingReward = levelingRewardDatas[i];
            let rolesForThisLevel = levelingReward.roleDiscordIds
                .map(id => guildRoles.get(id) || id)
                .map(r => r.toString());

            // Alphabetize the roles
            // I think this makes it look better but idk
            rolesForThisLevel.sort();

            description += `${Lang.getRef('info', 'lists.rewardListEntry', data.lang, {
                LEVEL: levelingReward.level.toLocaleString(),
                TOTAL_XP: ExperienceUtils.getTotalXpForLevel(levelingReward.level).toLocaleString(),
            })}\n${Lang.getRef('info', 'lists.rewardListEntryInfo', data.lang, {
                TYPE: `${Lang.getRef('info', 'terms.role', data.lang)}${rolesForThisLevel.length > 1 ? Lang.getCom('plurals.s') : ''}`,
                LIST: FormatUtils.joinWithAnd(rolesForThisLevel, data.lang),
            })}`;

            // Add spacing only if this isn't the last reward in the list
            if (i < levelingRewardDatas.length - 1) {
                description += '\n\n';
            }
        }

        embed = Lang.getEmbed('info', 'lists.rewardList', data.lang, {
            PAGE: `${pageStats.page > 0 ? pageStats.page.toString() : '1'}`,
            TOTAL_PAGES: `${pageStats.totalPages > 0 ? pageStats.totalPages.toString() : '1'}`,
            LIST_DATA: description,
            ICON: guild.iconURL(),
        });

        return { embed: embed.setThumbnail(guild.iconURL()), pageStats };
    }

    public static async getJoinRoleListEmbed(
        guild: Guild,
        page: number,
        data: EventData
    ): Promise<{ embed: EmbedBuilder; pageStats: PageStats }> {
        let embed: EmbedBuilder;
        let description = '';

        // load the leveling reward data
        let joinRoleIds = data.guildData.welcomeSettings.joinRoleDiscordIds;

        if (joinRoleIds?.length === 0) {
            description += Lang.getRef('info', 'lists.emptyList', data.lang);
        }

        let pageStats = ListUtils.getPageStats(page, Config.pageSize.joinRoles, joinRoleIds.length);

        joinRoleIds = joinRoleIds.slice(pageStats.startIndex, pageStats.endIndex);
        let guildRoles = await guild.roles.fetch();

        for (let i = 0; i < joinRoleIds.length; i++) {
            let joinRoleId = joinRoleIds[i];
            let joinRoleDisplay = (guildRoles.get(joinRoleId) || joinRoleId).toString();

            description += `${Lang.getRef('info', 'lists.joinRoleListEntry', data.lang, {
                ROLE_NUMBER: (i + 1).toLocaleString(),
                ROLE_DISPLAY: joinRoleDisplay,
            })}`;

            // Add spacing only if this isn't the last reward in the list
            if (i < joinRoleIds.length - 1) {
                description += '\n\n';
            }
        }

        embed = Lang.getEmbed('info', 'lists.joinRoleList', data.lang, {
            PAGE: `${pageStats.page > 0 ? pageStats.page.toString() : '1'}`,
            TOTAL_PAGES: `${pageStats.totalPages > 0 ? pageStats.totalPages.toString() : '1'}`,
            LIST_DATA: description,
            ICON: guild.iconURL(),
        });

        return { embed: embed.setThumbnail(guild.iconURL()), pageStats };
    }
}
