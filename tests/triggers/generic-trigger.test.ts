import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventData } from '../../src/models/internal-models.js';
import { LevelUpService } from '../../src/services/index.js';
import { GenericTrigger } from '../../src/triggers/generic-trigger.js';
import { ExperienceUtils, GuildUserDataCache, StatisticsUtils, TimeUtils } from '../../src/utils/index.js';
import {
    createMockEntityManager,
    createMockGuildData,
    createMockGuildMember,
} from '../helpers/test-mocks.js';

describe('GenericTrigger', () => {
    let trigger: GenericTrigger;
    let mockLevelUpService: LevelUpService;
    let mockEm: any;
    let mockGuildData: any;
    let mockGuildUserData: any;
    let mockMember: any;
    let mockMessage: any;

    beforeEach(() => {
        mockLevelUpService = {
            handleLevelUpsForGuild: vi.fn().mockResolvedValue(undefined),
        } as unknown as LevelUpService;

        trigger = new GenericTrigger(mockLevelUpService);

        mockEm = createMockEntityManager();
        mockGuildData = createMockGuildData('guilddata123', 'guild123');
        mockGuildUserData = {
            userDiscordId: 'user123',
            guildDiscordId: 'guild123',
            experience: 10,
            lastGivenMessageXp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        };

        mockMember = createMockGuildMember('user123', 'TestUser');
        mockMessage = {
            guild: { id: 'guild123', name: 'Test Guild' },
            author: { id: 'user123', username: 'TestUser' },
            member: mockMember,
        };

        vi.spyOn(ExperienceUtils, 'canEarnXp').mockReturnValue(true);
        vi.spyOn(ExperienceUtils, 'generateMessageXp').mockReturnValue(5);
        vi.spyOn(ExperienceUtils, 'getXpMultiplier').mockResolvedValue(1);
        vi.spyOn(ExperienceUtils, 'hasLeveledUp').mockReturnValue(false);

        vi.spyOn(GuildUserDataCache, 'updateUserData').mockImplementation(() => undefined);
        vi.spyOn(StatisticsUtils, 'queueMessageStatsForGuild').mockImplementation(() => undefined);
        vi.spyOn(StatisticsUtils, 'flushMessageStatsForGuild').mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should award message XP and persist the user', async () => {
        const data = new EventData(
            'en-US' as any,
            'en-US' as any,
            mockEm,
            mockGuildData,
            undefined,
            mockGuildUserData
        );

        await trigger.execute(mockMessage, data);

        expect(mockGuildUserData.experience).toBe(15);
        expect(mockEm.persistAndFlush).toHaveBeenCalledWith(mockGuildUserData);
        expect(GuildUserDataCache.updateUserData).toHaveBeenCalledWith(
            'guild123',
            'user123',
            mockGuildUserData
        );
    });

    it('should queue and flush message stats for today', async () => {
        const fixedNow = DateTime.fromISO('2024-01-02T05:00:00Z');
        vi.spyOn(TimeUtils, 'getNowForGuild').mockReturnValue(fixedNow);

        const data = new EventData(
            'en-US' as any,
            'en-US' as any,
            mockEm,
            mockGuildData,
            undefined,
            mockGuildUserData
        );

        await trigger.execute(mockMessage, data);

        expect(StatisticsUtils.queueMessageStatsForGuild).toHaveBeenCalledWith(
            'guild123',
            expect.objectContaining({
                dayString: '2024-01-02',
                messagesIncrement: 1,
                startingXp: 10,
                createdIso: expect.any(String),
            })
        );
        expect(StatisticsUtils.flushMessageStatsForGuild).toHaveBeenCalledWith(
            mockEm,
            'guild123',
            true
        );
    });

    it('should not award XP when canEarnXp is false', async () => {
        vi.spyOn(ExperienceUtils, 'canEarnXp').mockReturnValue(false);

        const data = new EventData(
            'en-US' as any,
            'en-US' as any,
            mockEm,
            mockGuildData,
            undefined,
            mockGuildUserData
        );

        await trigger.execute(mockMessage, data);

        expect(mockGuildUserData.experience).toBe(10);
        expect(mockEm.persistAndFlush).not.toHaveBeenCalled();
        expect(StatisticsUtils.queueMessageStatsForGuild).not.toHaveBeenCalled();
        expect(GuildUserDataCache.updateUserData).not.toHaveBeenCalled();
    });

    it('should call level-up service when user levels up', async () => {
        vi.spyOn(ExperienceUtils, 'hasLeveledUp').mockReturnValue(true);
        vi.spyOn(ExperienceUtils, 'getLevelFromXp').mockReturnValueOnce(0).mockReturnValueOnce(1);

        const data = new EventData(
            'en-US' as any,
            'en-US' as any,
            mockEm,
            mockGuildData,
            undefined,
            mockGuildUserData
        );

        await trigger.execute(mockMessage, data);

        expect(mockLevelUpService.handleLevelUpsForGuild).toHaveBeenCalledWith(
            mockMessage.guild,
            mockGuildData,
            [{ userId: 'user123', oldLevel: 0, newLevel: 1 }]
        );
    });

    it('should use XP multiplier when generating message XP', async () => {
        vi.spyOn(ExperienceUtils, 'getXpMultiplier').mockResolvedValue(2);

        const data = new EventData(
            'en-US' as any,
            'en-US' as any,
            mockEm,
            mockGuildData,
            undefined,
            mockGuildUserData
        );

        await trigger.execute(mockMessage, data);

        expect(ExperienceUtils.generateMessageXp).toHaveBeenCalledWith(mockMember, 2);
    });
});
