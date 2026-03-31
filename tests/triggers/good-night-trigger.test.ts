import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventData } from '../../src/models/internal-models.js';
import { Lang } from '../../src/services/index.js';
import { GoodNightTrigger } from '../../src/triggers/good-night-trigger.js';
import { MessageUtils } from '../../src/utils/index.js';

describe('GoodNightTrigger', () => {
    let trigger: GoodNightTrigger;
    let mockMessage: any;
    let mockData: EventData;

    beforeEach(() => {
        trigger = new GoodNightTrigger();
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

    it('should trigger for valid good night messages', () => {
        mockMessage.content = 'good night!';
        expect(trigger.triggered(mockMessage)).toBe(true);

        mockMessage.content = 'gn';
        expect(trigger.triggered(mockMessage)).toBe(true);
    });

    it('should not trigger for words that only contain gn', () => {
        mockMessage.content = 'signal';
        expect(trigger.triggered(mockMessage)).toBe(false);
    });

    it('should send a good night response embed', async () => {
        const embed = { title: 'good night embed' };
        vi.spyOn(Math, 'random').mockReturnValue(0);
        vi.spyOn(Lang, 'getEmbed').mockReturnValue(embed as any);
        vi.spyOn(MessageUtils, 'send').mockResolvedValue({} as any);

        await trigger.execute(mockMessage, mockData);

        expect(Lang.getEmbed).toHaveBeenCalledWith('results', 'triggerResponses.goodNight', 'en-US', {
            USER_MENTION: '<@user123>',
            EMOJI: '😴',
        });
        expect(MessageUtils.send).toHaveBeenCalledWith(mockMessage.channel, embed);
    });
});
