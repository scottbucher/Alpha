import { ChatInputCommandInteraction, PermissionsString, TextChannel } from 'discord.js';

import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { QuoteUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';
import { EventDataType } from '../../enums/index.js';

export class QuoteCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.quote', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let target = intr.options.getUser(
            Lang.getRef('commands', 'arguments.user', Language.Default)
        );
        let quote = intr.options.getString(
            Lang.getRef('commands', 'arguments.quote', Language.Default)
        );

        let quoteChannel = data.guildData.quoteSettings.channelDiscordId;

        let resolvedQuoteChannel = await QuoteUtils.validateQuote(intr, data, quoteChannel, target);

        if (!resolvedQuoteChannel) {
            return;
        }

        await QuoteUtils.sendQuote(intr, data, quote, target, resolvedQuoteChannel as TextChannel);
    }
}
