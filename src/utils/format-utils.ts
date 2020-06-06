import { Guild, GuildEmoji, Util } from 'discord.js';

import { Logger } from '../services';
import { MathUtils } from './math-utils';
import { ParseUtils } from './parse-utils';

const emojiRegex = require('emoji-regex/text.js');

export abstract class FormatUtils {
    public static getRoleName(roleDiscordId: string, guild: Guild): string {
        return roleDiscordId ? guild.roles.resolve(roleDiscordId)?.toString() || '**Unknown**' : '**None**';
    }

    public static getMemberDisplayName(memberDiscordId: string, guild: Guild): string {
        let displayName = guild.members.resolve(memberDiscordId)?.displayName;
        return displayName ? Util.escapeMarkdown(displayName) : 'Unknown Member';
    }

    public static getMemberMention(memberDiscordId: string, guild: Guild): string {
        return guild.members.resolve(memberDiscordId)?.toString() || 'Unknown Member';
    }

    public static getPercent(decimal: number): string {
        return decimal*100 +'%';
    }

    public static resolvePage(input: string, maxPageNumber: number): number {
        return MathUtils.clamp(ParseUtils.parseInt(input) || 1, 1, maxPageNumber);
    }

    public static isLevel(input: number) {
        return Number.isInteger(input) && input >= 0 && input <= 1000;
    }

    public static joinWithAnd(values: string[]): string {
        return [values.slice(0, -1).join(', '), values.slice(-1)[0]].join(
            values.length < 2 ? '' : ', and '
        );
    }

    public static getIdFromEmojiString(input: string): string {
        let emoteData = input.replace('<', '').replace('>', '').split(':');
        return emoteData[emoteData.length-1];
    }

    public static findGuildEmoji(input: string, guild: Guild): GuildEmoji {
        return guild.emojis.resolve(this.getIdFromEmojiString(input));
    }

    public static isUnicodeEmoji(input: string): boolean {
        return emojiRegex().exec(input) !== null;
    }

    public static findUnicodeEmoji(input: string): string {
        return emojiRegex().exec(input)[0];
    }
}