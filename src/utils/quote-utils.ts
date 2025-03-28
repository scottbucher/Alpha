import { CommandInteraction, DiscordAPIError, TextChannel, User } from 'discord.js';
import { Lang } from '../services/lang.js';
import { FormatUtils, InteractionUtils, MessageUtils, PermissionUtils } from './index.js';
import { EventData } from '../models/index.js';

// TODO: Move this to the config
const UNKNOWN_USER_AVATAR =
    'https://birthday-bot-dev-images.s3.us-east-1.amazonaws.com/unknown-user.png';

export class QuoteUtils {
    public static async sendQuote(
        intr: CommandInteraction,
        data: EventData,
        quote: string,
        target: User,
        channel: TextChannel
    ): Promise<void> {
        await MessageUtils.send(
            channel,
            Lang.getEmbed('info', 'embeds.quote', data.lang, {
                QUOTE_USER: target?.displayName ?? 'Unknown User',
                QUOTE_MESSAGE: quote,
                QUOTER_NAME: intr.user.displayName,
                QUOTER_ICON: intr.user.displayAvatarURL(),
                QUOTED_USER_AVATAR: target?.displayAvatarURL() ?? UNKNOWN_USER_AVATAR,
            })
        );

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed('results', 'successEmbeds.quoteSent', data.lang, {
                CHANNEL: FormatUtils.channelMention(channel.id),
            })
        );
    }

    public static async validateQuote(
        intr: CommandInteraction,
        data: EventData,
        quoteChannelId: string,
        quoteTarget?: User
    ): Promise<TextChannel | null> {
        if (quoteTarget?.bot) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.cannotQuoteBot', data.lang)
            );
            return null;
        }

        if (!quoteChannelId) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.noQuoteChannel', data.lang, {
                    EDIT_CHANNEL_COMMAND: await FormatUtils.commandMention(intr.client, 'edit', [
                        'channel',
                    ]),
                })
            );
            return null;
        }

        let resolvedQuoteChannel: TextChannel | null = null;
        try {
            resolvedQuoteChannel = (await intr.guild.channels.fetch(quoteChannelId)) as TextChannel;
        } catch (error) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.quoteChannelDeleted', data.lang, {
                    EDIT_CHANNEL_COMMAND: await FormatUtils.commandMention(intr.client, 'edit', [
                        'channel',
                    ]),
                })
            );
            return null;
        }

        if (!PermissionUtils.canSend(resolvedQuoteChannel, true)) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.noPermissionToSendToChannel',
                    data.lang,
                    {
                        CHANNEL_MENTION: FormatUtils.channelMention(resolvedQuoteChannel.id),
                    }
                )
            );
            return null;
        }

        return resolvedQuoteChannel ?? null;
    }
}
