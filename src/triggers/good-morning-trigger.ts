import { Message } from 'discord.js';

import { Trigger } from './index.js';
import { EventDataType } from '../enums/index.js';
import { EventData } from '../models/internal-models.js';
import { Lang } from '../services/index.js';
import { MessageUtils } from '../utils/index.js';

const GOOD_MORNING_TRIGGER = /g['`]?(?:oo+d+|d)?\s*m+o+r+n+[ie]+n+g*[!1.]*$/i;
const GOOD_MORNING_EMOJIS = ['🔅', '🔆', '☀️', '🌅', '🌄', '☕', '🥞'];

export class GoodMorningTrigger implements Trigger {
    public requireGuild = false;
    public requireEventData: EventDataType[] = [];

    public triggered(msg: Message): boolean {
        return GOOD_MORNING_TRIGGER.test(msg.content);
    }

    public async execute(msg: Message, data: EventData): Promise<void> {
        let randomEmoji =
            GOOD_MORNING_EMOJIS[Math.floor(Math.random() * GOOD_MORNING_EMOJIS.length)];
        try {
            await MessageUtils.send(
                msg.channel,
                Lang.getEmbed('results', 'triggerResponses.goodMorning', data.lang, {
                    EMOJI: randomEmoji,
                    USER_MENTION: msg.author.toString(),
                })
            );
        } catch (_error) {
            // Ignore
        }
    }
}
