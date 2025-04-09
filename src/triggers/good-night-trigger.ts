import { Message } from 'discord.js';

import { Trigger } from './index.js';
import { EventDataType } from '../enums/index.js';
import { EventData } from '../models/internal-models.js';
import { Lang } from '../services/index.js';
import { MessageUtils } from '../utils/index.js';

const GOOD_NIGHT_TRIGGER = /(?:g['`]?(?:oo+d+|d)?\s*n+[iy]+(?:g+h+)?t+[ez]*[!1.]*|^gn[!1.]*$)/i;
const GOOD_NIGHT_EMOJIS = [
    '😴',
    '😪',
    '🌃',
    '✨',
    '💤',
    '🌑',
    '🌒',
    '🌓',
    '🌔',
    '🌕',
    '🌖',
    '🌗',
    '🌘',
];

export class GoodNightTrigger implements Trigger {
    public requireGuild = false;
    public requireEventData: EventDataType[] = [];

    public triggered(msg: Message): boolean {
        return GOOD_NIGHT_TRIGGER.test(msg.content);
    }

    public async execute(msg: Message, data: EventData): Promise<void> {
        let randomEmoji = GOOD_NIGHT_EMOJIS[Math.floor(Math.random() * GOOD_NIGHT_EMOJIS.length)];
        try {
            await MessageUtils.send(
                msg.channel,
                Lang.getEmbed('results', 'triggerResponses.goodNight', data.lang, {
                    USER_MENTION: msg.author.toString(),
                    EMOJI: randomEmoji,
                })
            );
        } catch (_error) {
            // Ignore
        }
    }
}
