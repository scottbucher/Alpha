import { Guild, GuildEmoji, Message, MessageEmbed, TextChannel, Util } from 'discord.js';

import { MathUtils } from './math-utils';
import { ParseUtils } from './parse-utils';
import { RoleCallData } from '../models/database/rolecall-models';
import { UserData } from '../models/database/user-models';
import { XpUtils } from './xp-utils';
import { isNumber } from 'util';

let Config = require('../../config/config.json');
const emojiRegex = require('emoji-regex/text.js');

export abstract class FormatUtils {
    public static getRoleName(guild: Guild, roleDiscordId: string): string {
        return roleDiscordId
            ? guild.roles.resolve(roleDiscordId)?.toString() || '**Unknown**'
            : '**None**';
    }

    public static getMemberDisplayName(memberDiscordId: string, guild: Guild): string {
        let displayName = guild.members.resolve(memberDiscordId)?.displayName;
        return displayName ? Util.escapeMarkdown(displayName) : 'Unknown Member';
    }

    public static getMemberMention(memberDiscordId: string, guild: Guild): string {
        return guild.members.resolve(memberDiscordId)?.toString() || 'Unknown Member';
    }

    public static getPercent(decimal: number): string {
        return Math.floor(decimal * 100) + '%';
    }

    public static resolvePage(input: string, maxPageNumber: number): number {
        return MathUtils.clamp(ParseUtils.parseInt(input) || 1, 1, maxPageNumber);
    }

    public static isLevel(input: number): boolean {
        return Number.isInteger(input) && input >= 0 && input <= 1000;
    }

    public static joinWithAnd(values: string[]): string {
        return [values.slice(0, -1).join(', '), values.slice(-1)[0]].join(
            values.length < 2 ? '' : ', and '
        );
    }

    public static getIdFromEmojiString(input: string): string {
        let emoteData = input.replace('<', '').replace('>', '').split(':');
        return emoteData[emoteData.length - 1];
    }

    public static getNameFromEmojiString(input: string): string {
        let emoteData = input.replace('<', '').replace('>', '').split(':');
        return emoteData[emoteData.length - 2];
    }

    public static findGuildEmoji(input: string, guild: Guild): GuildEmoji {
        return guild.emojis.resolve(this.getIdFromEmojiString(input));
    }

    public static isUnicodeEmoji(input: string): boolean {
        return emojiRegex().exec(input) !== null;
    }

    public static findUnicodeEmoji(input: string): string {
        if (input.length > 2) return null;
        let emote = emojiRegex().exec(input)[0];
        return isNumber(emote) ? null : emote;
    }

    public static getFieldList(guild: Guild, roleIds: string[], emotes: string[]): string {
        let fieldList = '';
        for (let i = 0; i < roleIds.length; i++) {
            if (!this.getEmoteDisplay(guild, emotes[i]) || !this.getRoleDisplay(guild, roleIds[i]))
                continue; // Skip if either the role or emote are invalid
            fieldList += `${this.getEmoteDisplay(guild, emotes[i])} ${this.getRoleName(
                guild,
                roleIds[i]
            )}\n`; // Add to list
        }
        return fieldList;
    }

    public static getEmoteDisplay(guild: Guild, emote: string): string {
        let guildEmote = guild.emojis.resolve(emote);
        if (guildEmote) return guildEmote.toString();
        else if (this.isUnicodeEmoji(emote)) return emote;
        else return null;
    }

    public static getRoleDisplay(guild: Guild, roleDiscordId: string): string {
        return guild.roles.resolve(roleDiscordId)?.name;
    }

    public static async getRoleCallEmbed(
        guild: Guild,
        roleCallData: RoleCallData[]
    ): Promise<MessageEmbed> {
        let roleCallCategories = Array.from(
            // Removes duplicate categories
            new Set(roleCallData.map(roleCall => roleCall.Category))
        );

        let roleCallEmbed = new MessageEmbed() // Enter Default Values (Eventually make these customizable)
            .setTitle('Role Manager')
            .addField(
                'Use this to obtain your roles.',
                'React with emotes to the corresponding roles you would like.'
            )
            .setFooter(
                'To remove a role, simply remove your reaction of the corresponding role.',
                guild.me.user.avatarURL()
            )
            .setColor(Config.colors.default);

        for (let category of roleCallCategories) {
            // Go through all of the categories

            let roleCallRoles = roleCallData // Get an array of Roles under this category
                .filter(roleCall => roleCall.Category === category)
                .map(roleCall => roleCall.RoleDiscordId);

            let roleCallEmotes = roleCallData // Get an array of Emotes under this category
                .filter(roleCall => roleCall.Category === category)
                .map(roleCall => roleCall.Emote);

            let list = FormatUtils.getFieldList(guild, roleCallRoles, roleCallEmotes); // Returns a formatted list of Emotes and Role names
            let categoryName = category || 'Roles';
            if (!list) continue; // If all emotes or roles are invalid in this category, list will be null
            roleCallEmbed.addField(categoryName, list);
        }

        roleCallEmbed.addField('Administration', '♻️ Refresh Message'); // Add Administrative refresh button

        return roleCallEmbed;
    }

    public static async getXpLeaderBoardEmbed(
        guild: Guild,
        userData: UserData[],
        page: number,
        pageSize: number
    ): Promise<MessageEmbed> {
        let embed = new MessageEmbed()
            .setTitle(`__**Xp Leaderboard**__ **| Page ${page}**`)
            .setThumbnail(guild.iconURL())
            .setColor(Config.colors.default)
            .setFooter('Talk in Text & Voice Channels to level up!', guild.iconURL())
            .setTimestamp();

            let i = ((page-1) * pageSize) + 1;

            for (let user of userData) {
                embed.addField(`#${i}: ${guild.members.resolve(user.UserDiscordId).displayName}`, `Level: ${XpUtils.getLevelFromXp(user.XpAmount)} (Total XP: ${user.XpAmount})`);
                i++;
            }

        return embed;
    }
}
