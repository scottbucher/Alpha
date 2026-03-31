import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventData } from '../../src/models/internal-models.js';
import { Lang } from '../../src/services/index.js';
import { GoodMorningTrigger } from '../../src/triggers/good-morning-trigger.js';
import { MessageUtils } from '../../src/utils/index.js';

describe('GoodMorningTrigger', () => {
    let trigger: GoodMorningTrigger;
    let mockMessage: any;
    let mockData: EventData;

    beforeEach(() => {
        trigger = new GoodMorningTrigger();
        mockMessage = {
            content: '',
            channel: { id: 'channel123' },
            author: {
                toString: vi.fn().mockReturnValue('<@user123>'),
            },
        };
        mockData = new EventData('en-US' as any, 'en-US' as any, {} as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should trigger for valid good morning messages', () => {
        mockMessage.content = 'good morning';
        expect(trigger.triggered(mockMessage)).toBe(true);
    });

    it('should not trigger for unrelated messages', () => {
        mockMessage.content = 'good night';
        expect(trigger.triggered(mockMessage)).toBe(false);
    });

    it('should send a good morning response embed', async () => {
        const embed = { title: 'good morning embed' };
        vi.spyOn(Math, 'random').mockReturnValue(0);
        vi.spyOn(Lang, 'getEmbed').mockReturnValue(embed as any);
        vi.spyOn(MessageUtils, 'send').mockResolvedValue({} as any);

        await trigger.execute(mockMessage, mockData);

        expect(Lang.getEmbed).toHaveBeenCalledWith(
            'results',
            'triggerResponses.goodMorning',
            'en-US',
            {
                EMOJI: '🔅',
                USER_MENTION: '<@user123>',
            }
        );
        expect(MessageUtils.send).toHaveBeenCalledWith(mockMessage.channel, embed);
    });
});
