import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventData } from '../../src/models/internal-models.js';
import { Lang } from '../../src/services/index.js';
import { OldPrefixTrigger } from '../../src/triggers/old-prefix-trigger.js';
import { FormatUtils, MessageUtils } from '../../src/utils/index.js';

describe('OldPrefixTrigger', () => {
    let trigger: OldPrefixTrigger;
    let mockMessage: any;
    let mockData: EventData;

    beforeEach(() => {
        trigger = new OldPrefixTrigger();
        mockMessage = {
            content: '',
            channel: { id: 'channel123' },
            client: { id: 'client123' },
        };
        mockData = new EventData('en-US' as any, 'en-US' as any, {} as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should trigger when old prefix is used', () => {
        mockMessage.content = '!help';
        expect(trigger.triggered(mockMessage)).toBe(true);
    });

    it('should not trigger when old prefix is not used', () => {
        mockMessage.content = '/help';
        expect(trigger.triggered(mockMessage)).toBe(false);
    });

    it('should send old prefix warning embed', async () => {
        const embed = { title: 'old prefix warning' };
        vi.spyOn(FormatUtils, 'commandMention').mockResolvedValue('/help');
        vi.spyOn(Lang, 'getEmbed').mockReturnValue(embed as any);
        vi.spyOn(MessageUtils, 'send').mockResolvedValue({} as any);

        await trigger.execute(mockMessage, mockData);

        expect(FormatUtils.commandMention).toHaveBeenCalledWith(mockMessage.client, 'help');
        expect(Lang.getEmbed).toHaveBeenCalledWith(
            'validation',
            'embeds.oldPrefixUsed',
            'en-US',
            expect.objectContaining({
                HELP_COMMAND: '/help',
                IMAGE: expect.stringContaining('someonecookedhere.jpg'),
            })
        );
        expect(MessageUtils.send).toHaveBeenCalledWith(mockMessage.channel, embed);
    });
});
