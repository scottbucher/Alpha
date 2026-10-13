import { Locale } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsCommand } from '../../src/commands/chat/index.js';
import { EventData } from '../../src/models/internal-models.js';
import { Lang } from '../../src/services/index.js';
import { InteractionUtils } from '../../src/utils/index.js';
import {
    createMockCommandInteraction,
    createMockEntityManager,
    createMockGuild,
    createMockGuildData,
} from '../helpers/test-mocks.js';

describe('SettingsCommand', () => {
    let command: SettingsCommand;
    let mockIntr: any;
    let mockGuildData: any;
    let data: EventData;

    function getSettingsVariables(): any {
        let call = vi
            .mocked(Lang.getEmbed)
            .mock.calls.find(([, location]) => location === 'embeds.settings');
        return call[3];
    }

    beforeEach(() => {
        vi.restoreAllMocks();

        vi.spyOn(InteractionUtils, 'send').mockResolvedValue(undefined);
        vi.spyOn(Lang, 'getEmbed');

        let guild = createMockGuild();
        guild.channels.resolve = vi.fn((id: string) =>
            ['levelingChannel', 'milestoneChannel'].includes(id)
                ? { toString: () => `<#${id}>` }
                : null
        );
        mockIntr = createMockCommandInteraction({ guild });
        mockIntr.client.user.displayAvatarURL = vi.fn().mockReturnValue('');

        mockGuildData = createMockGuildData('guilddata123', 'guild123');
        mockGuildData.generalSettings.language = Locale.EnglishUS;
        mockGuildData.welcomeSettings = {};
        mockGuildData.levelingSettings = { channelDiscordId: 'levelingChannel' };
        mockGuildData.quoteSettings = {};
        mockGuildData.pollSettings = {};
        mockGuildData.milestoneSettings = { xpMilestones: [] };
        data = new EventData(
            Locale.EnglishUS,
            Locale.EnglishUS,
            createMockEntityManager(),
            mockGuildData
        );

        command = new SettingsCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should show the configured milestone channel', async () => {
        mockGuildData.milestoneSettings.channelDiscordId = 'milestoneChannel';

        await command.execute(mockIntr, data);

        expect(getSettingsVariables().MILESTONE_CHANNEL).toBe('<#milestoneChannel>');
    });

    it('should show the leveling channel fallback when no milestone channel is set', async () => {
        await command.execute(mockIntr, data);

        expect(getSettingsVariables().MILESTONE_CHANNEL).toBe(
            Lang.getRef('info', 'terms.levelingChannelFallback', Locale.EnglishUS, {
                CHANNEL: '<#levelingChannel>',
            })
        );
    });

    it('should show not set when no milestone or leveling channel is set', async () => {
        mockGuildData.levelingSettings = {};

        await command.execute(mockIntr, data);

        expect(getSettingsVariables().MILESTONE_CHANNEL).toBe(
            Lang.getRef('info', 'terms.notSet', Locale.EnglishUS)
        );
    });
});
