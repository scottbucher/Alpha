import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GuildData, GuildUserData, LevelingRewardData } from '../../src/database/entities/index.js';
import { EventDataType } from '../../src/enums/index.js';
import { Language } from '../../src/models/enum-helpers/language.js';
import { EventDataService } from '../../src/services/event-data-service.js';
import { ClientUtils, DatabaseUtils, GuildUserDataCache } from '../../src/utils/index.js';
import {
    createMockEntityManager,
    createMockGuild,
    createMockGuildData,
    createMockOrm,
    createMockUser,
} from '../helpers/test-mocks.js';

describe('EventDataService', () => {
    let service: EventDataService;
    let mockEm: any;
    let mockOrm: any;
    let mockGuild: any;
    let mockUser: any;
    let mockGuildData: any;

    beforeEach(() => {
        mockEm = createMockEntityManager();
        mockOrm = createMockOrm(mockEm);
        service = new EventDataService(mockOrm);

        mockGuild = createMockGuild('guild123', 'Test Guild');
        mockUser = createMockUser('user123', 'TestUser');
        mockGuildData = createMockGuildData('guilddata123', 'guild123');

        vi.spyOn(DatabaseUtils, 'getOrCreateDataForGuild').mockResolvedValue({
            GuildData: mockGuildData,
            GuildUserData: [],
        });
        vi.spyOn(DatabaseUtils, 'createGuildUserDatas').mockResolvedValue({
            GuildData: mockGuildData,
            GuildUserData: [
                {
                    userDiscordId: 'user123',
                    guildDiscordId: 'guild123',
                    experience: 0,
                } as unknown as GuildUserData,
            ],
        });
        vi.spyOn(GuildUserDataCache, 'get').mockResolvedValue({
            guildData: mockGuildData,
            guildUserDatas: [
                {
                    userDiscordId: 'user123',
                    guildDiscordId: 'guild123',
                    experience: 10,
                } as unknown as GuildUserData,
            ],
            expiresAt: Date.now() + 1000,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses cache when GUILD_USER_DATA is required', async () => {
        mockEm.findOne = vi.fn().mockResolvedValue(mockGuildData);

        const data = await service.create({
            guild: mockGuild,
            target: mockUser,
            requireEventData: [EventDataType.GUILD_USER_DATA],
        });

        expect(GuildUserDataCache.get).toHaveBeenCalledWith(mockGuild, ['user123']);
        expect(data.guildUserData?.userDiscordId).toBe('user123');
        expect(DatabaseUtils.createGuildUserDatas).not.toHaveBeenCalled();
    });

    it('creates guild user data when cache is missing the user', async () => {
        vi.spyOn(GuildUserDataCache, 'get').mockResolvedValue({
            guildData: mockGuildData,
            guildUserDatas: [],
            expiresAt: Date.now() + 1000,
        });

        const data = await service.create({
            guild: mockGuild,
            target: mockUser,
            requireEventData: [EventDataType.GUILD_USER_DATA],
        });

        expect(DatabaseUtils.createGuildUserDatas).toHaveBeenCalled();
        expect(data.guildUserData?.userDiscordId).toBe('user123');
    });

    it('populates levelingRewardDatas when requested', async () => {
        mockEm.findOne = vi.fn().mockResolvedValue(mockGuildData);

        await service.create({
            guild: mockGuild,
            target: mockUser,
            requireEventData: [
                EventDataType.GUILD_USER_DATA,
                EventDataType.LEVELING_REWARD_DATA,
            ],
        });

        expect(mockEm.findOne).toHaveBeenCalledWith(
            GuildData,
            { discordId: 'guild123' },
            { populate: ['levelingRewardDatas'] }
        );
    });

    it('fetches all guild user data when ALL_GUILD_USER_DATA is required', async () => {
        vi.spyOn(ClientUtils, 'getAllMemberIds').mockReturnValue(['user123', 'user456']);

        await service.create({
            guild: mockGuild,
            requireEventData: [EventDataType.ALL_GUILD_USER_DATA],
        });

        expect(DatabaseUtils.getOrCreateDataForGuild).toHaveBeenCalledWith(
            mockEm,
            mockGuild,
            ['user123', 'user456'],
            undefined
        );
    });

    it('does not call cache when GUILD_USER_DATA is not required', async () => {
        await service.create({
            guild: mockGuild,
            requireEventData: [EventDataType.ALL_GUILD_USER_DATA],
        });

        expect(GuildUserDataCache.get).not.toHaveBeenCalled();
    });

    it('throws when ALL_GUILD_USER_DATA is requested without a guild', async () => {
        await expect(
            service.create({
                requireEventData: [EventDataType.ALL_GUILD_USER_DATA],
            })
        ).rejects.toThrow('No guild provided');
    });

    it('throws when GUILD_USER_DATA is requested without a target', async () => {
        mockEm.findOne = vi.fn().mockResolvedValue(mockGuildData);

        await expect(
            service.create({
                guild: mockGuild,
                requireEventData: [EventDataType.GUILD_USER_DATA],
            })
        ).rejects.toThrow('No target user provided');
    });

    it('loads levelingRewardData by alias when args are provided', async () => {
        const mockReward = { alias: 'vip', guildDiscordId: 'guild123' };
        mockEm.findOne = vi
            .fn()
            .mockResolvedValueOnce(mockGuildData) // GuildData lookup
            .mockResolvedValueOnce(mockReward); // LevelingRewardData lookup

        const data = await service.create({
            guild: mockGuild,
            args: { levelingRewardAlias: 'vip' },
            requireEventData: [EventDataType.LEVELING_REWARD_DATA],
        });

        expect(mockEm.findOne).toHaveBeenCalledWith(LevelingRewardData, {
            alias: 'vip',
            guildDiscordId: 'guild123',
        });
        expect(data.levelingRewardDatas).toBe(mockReward);
    });

    it('flushes the entity manager when guild data is loaded', async () => {
        mockEm.findOne = vi.fn().mockResolvedValue(mockGuildData);
        mockEm.flush = vi.fn().mockResolvedValue(undefined);

        await service.create({
            guild: mockGuild,
            requireEventData: [EventDataType.GUILD_DATA],
        });

        expect(mockEm.flush).toHaveBeenCalled();
    });

    it('uses guild preferredLocale when enabled', async () => {
        mockEm.findOne = vi.fn().mockResolvedValue(mockGuildData);
        mockGuild.preferredLocale = Language.Default;

        const data = await service.create({
            guild: mockGuild,
            requireEventData: [EventDataType.GUILD_DATA],
        });

        expect(data.lang).toBe(Language.Default);
        expect(data.langGuild).toBe(Language.Default);
    });

    it('falls back to default locale when preferredLocale is not enabled', async () => {
        mockEm.findOne = vi.fn().mockResolvedValue(mockGuildData);
        mockGuild.preferredLocale = 'es-ES';

        const data = await service.create({
            guild: mockGuild,
            requireEventData: [EventDataType.GUILD_DATA],
        });

        expect(data.lang).toBe(Language.Default);
        expect(data.langGuild).toBe(Language.Default);
    });
});
