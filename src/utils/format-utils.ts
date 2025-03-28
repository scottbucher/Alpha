import { ApplicationCommand, Client, Guild, GuildEmoji, Locale } from 'discord.js';
import { filesize } from 'filesize';
import { Duration } from 'luxon';
import { Lang } from '../services/index.js';
import { Language } from '../models/enum-helpers/language.js';
import { ClientUtils } from './client-utils.js';

const UNICODE_EMOJI_REGEX = /\p{Extended_Pictographic}/u;
const GUILD_EMOJI_REGEX = /<a?:.+?:\d{18,19}>/;
const EMOJI_REGEX = GUILD_EMOJI_REGEX || UNICODE_EMOJI_REGEX;

export class FormatUtils {
    public static roleMention(guild: Guild, discordId: string): string {
        if (discordId === '@here') {
            return discordId;
        }

        if (discordId === guild.id) {
            return '@everyone';
        }

        return `<@&${discordId}>`;
    }

    public static channelMention(discordId: string): string {
        return `<#${discordId}>`;
    }

    public static userMention(discordId: string): string {
        return `<@!${discordId}>`;
    }

    public static async getGuildEmoji(input: string, guild: Guild): Promise<GuildEmoji> {
        let id = this.getIdFromGuildEmojiString(input);
        return id ? await guild.emojis.fetch(id) : null;
    }

    public static isUnicodeEmoji(input: string): boolean {
        return UNICODE_EMOJI_REGEX.exec(input) !== null;
    }

    public static async findGuildEmoji(input: string, guild: Guild): Promise<GuildEmoji> {
        return await guild.emojis.fetch(input);
    }

    public static getEmoji(input: string): string {
        let emoji = EMOJI_REGEX.exec(input);
        return emoji ? emoji[0] : null;
    }

    public static getUnicodeEmoji(input: string): string {
        let emote = UNICODE_EMOJI_REGEX.exec(input);
        if (!emote || emote.length === 0) return null;
        return typeof emote[0] === 'number' ? null : emote[0];
    }

    public static getIdFromGuildEmojiString(input: string): string {
        let resolvedEmojis = GUILD_EMOJI_REGEX.exec(input);
        if (!resolvedEmojis || resolvedEmojis.length == 0) return null;

        let emoteData = resolvedEmojis[0].replace('<', '').replace('>', '').split(':');
        return emoteData[emoteData.length - 1];
    }

    // TODO: Replace with ApplicationCommand#toString() once discord.js #8818 is merged
    // https://github.com/discordjs/discord.js/pull/8818
    public static async commandMention(
        client: Client,
        langLocation: string,
        subParts: string[] = []
    ): Promise<string> {
        let command = await ClientUtils.findAppCommand(
            client,
            Lang.getRef('commands', `chatCommands.${langLocation}`, Language.Default)
        );

        let name = [command.name, ...subParts].join(' ');
        return `</${name}:${command.id}>`;
    }

    public static duration(milliseconds: number, langCode: Locale): string {
        return Duration.fromObject(
            Object.fromEntries(
                Object.entries(
                    Duration.fromMillis(milliseconds, { locale: langCode })
                        .shiftTo(
                            'year',
                            'quarter',
                            'month',
                            'week',
                            'day',
                            'hour',
                            'minute',
                            'second'
                        )
                        .toObject()
                ).filter(([_, value]) => !!value) // Remove units that are 0
            )
        ).toHuman({ maximumFractionDigits: 0 });
    }

    public static fileSize(bytes: number): string {
        return filesize(bytes, { output: 'string', pad: true, round: 2 });
    }

    /**
     *
     * @param values
     * @param langCode
     * @param extraUsers The amount of users that are not included in the list because of the Discord character limit
     * @returns
     */
    public static joinWithAnd(values: string[], langCode: Locale, extraUsers: number = 0): string {
        if (values.length === 0) return 'NOTHING TO JOIN';
        if (extraUsers > 0) {
            // add the "X more" to the end of the list
            values.push(
                Lang.getRef('info', `terms.xMoreMember${extraUsers > 1 ? 's' : ''}`, langCode, {
                    AMOUNT: extraUsers.toString(),
                })
            );
        }

        return values.length === 2
            ? values[0] + ` ${Lang.getRef('info', 'terms.and', langCode)} ` + values[1]
            : [values.slice(0, -1).join(', '), values.slice(-1)[0]].join(
                  values.length < 2 ? '' : `, ${Lang.getRef('info', 'terms.and', langCode)} `
              );
    }
}
