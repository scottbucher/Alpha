import { ApplicationCommand, EmbedBuilder, Locale } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HelpCommand } from '../../src/commands/chat/index.js';
import { HelpOption } from '../../src/enums/index.js';
import { EventData } from '../../src/models/internal-models.js';
import { ClientUtils, InteractionUtils } from '../../src/utils/index.js';
import { createMockCommandInteraction, createMockEntityManager } from '../helpers/test-mocks.js';

describe('HelpCommand', () => {
    let command: HelpCommand;
    let mockIntr: any;
    let data: EventData;

    beforeEach(() => {
        vi.restoreAllMocks();

        vi.spyOn(InteractionUtils, 'send').mockResolvedValue(undefined);
        // Longest possible command ids, so mentions are as long as they can be
        vi.spyOn(ClientUtils, 'findAppCommand').mockImplementation(
            async (_client, name) =>
                ({ name, id: '12345678901234567890' }) as unknown as ApplicationCommand
        );

        command = new HelpCommand();
        mockIntr = createMockCommandInteraction();
        data = new EventData(Locale.EnglishUS, Locale.EnglishUS, createMockEntityManager());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should keep every XP help field within the Discord field value limit', async () => {
        mockIntr.options.getString.mockReturnValue(HelpOption.XP);

        await command.execute(mockIntr, data);

        let embed = vi.mocked(InteractionUtils.send).mock.calls[0][1] as EmbedBuilder;
        let fields = embed.data.fields;
        expect(fields.length).toBeGreaterThan(0);
        expect(fields.some(field => field.value.includes(':12345678901234567890>'))).toBe(true);
        expect(fields.some(field => field.value.includes('{{'))).toBe(false);
        for (let field of fields) {
            expect(field.value.length).toBeLessThanOrEqual(1024);
        }
    });
});
