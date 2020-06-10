import { DMChannel, Guild, MessageEmbed } from 'discord.js';

import { MessageLinkData } from '../models/message-link-data-models';

const MESSAGE_LINK_REGEX = /https:\/\/discordapp.com\/channels\/(\d+)\/(\d+)\/(\d+)/;

export abstract class MessageUtils {
    public static async sendDm(channel: DMChannel, msg: MessageEmbed | string): Promise<void> {
        try {
            await channel.send(msg);
        } catch (error) {
            // Error code 50007: "Cannot send messages to this user"
            if (error.code === 50007) {
                return;
            } else {
                throw error;
            }
        }
    }

    public static getRoleName(roleDiscordId: string, guild: Guild): string {
        return roleDiscordId
            ? guild.roles.resolve(roleDiscordId)?.toString() || '**Unknown**'
            : '**None**';
    }

    public static extractMessageLinkData(input: string): MessageLinkData {
        let match = MESSAGE_LINK_REGEX.exec(input);
        if (match) {
            return {
                GuildId: match[1],
                ChannelId: match[2],
                MessageId: match[3],
            } as MessageLinkData;
        }
    }
}
