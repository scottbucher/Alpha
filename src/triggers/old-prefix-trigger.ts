import { Message } from 'discord.js';

import { Trigger } from './index.js';
import { EventData } from '../models/internal-models.js';
import { Lang } from '../services/index.js';
import { FormatUtils, MessageUtils } from '../utils/index.js';
import { EventDataType } from '../enums/index.js';

export class OldPrefixTrigger implements Trigger {
    public requireGuild = false;
    public requireEventData: EventDataType[] = [];

    public triggered(msg: Message): boolean {
        return msg.content.startsWith('!');
    }

    public async execute(msg: Message, data: EventData): Promise<void> {
        try {
            await MessageUtils.send(
                msg.channel,
                Lang.getEmbed('validation', 'embeds.oldPrefixUsed', data.lang, {
                    HELP_COMMAND: await FormatUtils.commandMention(msg.client, 'help'),
                })
            );
        } catch (_error) {
            // Ignore
        }
    }
}
