import { MessageContextMenuCommandInteraction, PermissionsString } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { QuoteUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class QuoteMessage implements Command {
    public names = [Lang.getRef('commands', 'messageCommands.quote', Language.Default)];
    public cooldown = new RateLimiter(1, 5000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];
    public async execute(
        intr: MessageContextMenuCommandInteraction,
        data: EventData
    ): Promise<void> {
        let quoteChannel = data.guildData.quoteSettings.channelDiscordId;
        let quoteTarget = intr.targetMessage.author;

        let resolvedQuoteChannel = await QuoteUtils.validateQuote(
            intr,
            data,
            quoteChannel,
            quoteTarget
        );

        if (!resolvedQuoteChannel) {
            return;
        }

        await QuoteUtils.sendQuote(
            intr,
            data,
            intr.targetMessage.content,
            quoteTarget,
            resolvedQuoteChannel
        );
    }
}
