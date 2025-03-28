import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GiveVoiceXpJob } from '../../src/jobs/give-voice-xp-job.js';
import { Client, Collection, Guild, GuildMember, VoiceState } from 'discord.js';
import { MikroORM, EntityManager } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { GuildData, GuildUserData } from '../../src/database/entities/index.js';
import { LevelUpService } from '../../src/services/index.js';
import { DatabaseUtils } from '../../src/utils/index.js';
import { LangCode } from '../../src/enums/index.js';

// Mock DatabaseUtils
vi.mock('../../src/utils/index.js', () => ({
    DatabaseUtils: {
        getOrCreateDataForGuild: vi.fn(),
    },
}));

describe('GiveVoiceXpJob', () => {
    let giveVoiceXpJob: GiveVoiceXpJob;
    let mockClient: Client;
    let mockOrm: MikroORM<MongoDriver>;
    let mockEntityManager: EntityManager<MongoDriver>;
    let mockLevelUpService: LevelUpService;
    let mockGuild: Guild;
    let mockVoiceStates: Collection<string, VoiceState>;
    let mockGuildUserDatas: GuildUserData[];
    let mockGuildData: GuildData;

    // Helper function to create a mock guild member
    const createMockMember = (id: string, username: string, isBot = false): GuildMember => {
        return {
            id: id,
            user: { id: id, username: username, bot: isBot },
        } as unknown as GuildMember;
    };

    // Helper function to create a mock voice state
    const createMockVoiceState = (
        member: GuildMember,
        channelId: string,
        channelName: string
    ): VoiceState => {
        return {
            member: member,
            channel: { id: channelId, name: channelName },
        } as unknown as VoiceState;
    };

    beforeEach(() => {
        // === Setup Discord User/Member Mocks ===
        const mockMember = createMockMember('user123', 'TestUser');

        // === Setup Voice States ===
        mockVoiceStates = new Collection<string, VoiceState>();
        mockVoiceStates.set(
            'user123',
            createMockVoiceState(mockMember, 'voice123', 'Test Voice Channel')
        );

        // === Setup Guild Mock ===
        mockGuild = {
            id: 'guild123',
            name: 'Test Guild',
            voiceStates: {
                cache: mockVoiceStates,
            },
            afkChannel: null,
            fetch: vi.fn().mockReturnThis(),
        } as unknown as Guild;

        // === Setup Discord Client Mock ===
        const mockGuilds = new Collection<string, Guild>();
        mockGuilds.set('guild123', mockGuild);

        mockClient = {
            guilds: {
                cache: mockGuilds,
            },
        } as unknown as Client;

        // === Setup Database Mocks ===
        // Guild user data mock
        mockGuildUserDatas = [
            {
                userDiscordId: 'user123',
                guildDiscordId: 'guild123',
                experience: 95, // Just below level 1
            } as unknown as GuildUserData,
        ];

        // Guild data mock
        mockGuildData = {
            id: 'guilddata123',
            discordId: 'guild123',
            levelingSettings: {
                channelDiscordId: 'channel123',
            },
            settings: {
                language: LangCode.EN_US,
            },
        } as unknown as GuildData;

        // === Setup Entity Manager Mock ===
        mockEntityManager = {
            find: vi.fn(),
            findOne: vi.fn().mockImplementation((entity, query) => {
                if (entity === GuildData && query.discordId === 'guild123') {
                    return Promise.resolve(mockGuildData);
                }
                return Promise.resolve(null);
            }),
            persistAndFlush: vi.fn().mockResolvedValue(undefined),
            flush: vi.fn().mockResolvedValue(undefined),
        } as unknown as EntityManager<MongoDriver>;

        // === Setup ORM Mock ===
        mockOrm = {
            em: {
                fork: vi.fn().mockReturnValue(mockEntityManager),
            },
        } as unknown as MikroORM<MongoDriver>;

        // === Setup LevelUpService Mock ===
        mockLevelUpService = {
            handleLevelUpsForGuild: vi.fn().mockResolvedValue(undefined),
        } as unknown as LevelUpService;

        // === Create Job Instance ===
        giveVoiceXpJob = new GiveVoiceXpJob(mockClient, mockOrm, mockLevelUpService);

        // Reset all mocks before each test
        vi.clearAllMocks();

        // Setup DatabaseUtils mock return value for getOrCreateDataForGuild
        vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockResolvedValue({
            GuildUserData: mockGuildUserDatas,
            GuildData: mockGuildData,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should award XP to users in voice channels', async () => {
        await giveVoiceXpJob.run();

        // Verify getOrCreateDataForGuild was called with the correct parameters
        expect(DatabaseUtils.getOrCreateDataForGuild).toHaveBeenCalledWith(
            mockEntityManager,
            mockGuild,
            ['user123']
        );

        // Verify XP was added and data persisted
        expect(mockGuildUserDatas[0].experience).toBe(100); // 95 + 5 = 100
        expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();

        // User should have leveled up (from 0 to 1)
        expect(mockLevelUpService.handleLevelUpsForGuild).toHaveBeenCalledWith(
            mockGuild,
            mockGuildData,
            [{ userId: 'user123', oldLevel: 0, newLevel: 1 }]
        );
    });

    it('should filter out bots and users in AFK channels', async () => {
        // Create voice states with bot and AFK users
        const regularMember = createMockMember('user123', 'TestUser');
        const botMember = createMockMember('bot456', 'BotUser', true);
        const afkMember = createMockMember('afkuser789', 'AfkUser');

        // Create an AFK channel
        const afkChannel = { id: 'afk789', name: 'AFK Channel' };

        // Create voice states collection
        const voiceStates = new Collection<string, VoiceState>();

        // Add regular user voice state
        voiceStates.set(
            'user123',
            createMockVoiceState(regularMember, 'voice123', 'Test Voice Channel')
        );

        // Add bot user voice state
        voiceStates.set(
            'bot456',
            createMockVoiceState(botMember, 'voice123', 'Test Voice Channel')
        );

        // Add AFK user voice state
        voiceStates.set('afkuser789', {
            member: afkMember,
            channel: afkChannel,
        } as unknown as VoiceState);

        // Create a test guild with the special voice states
        const testGuild = {
            id: 'guild123',
            name: 'Test Guild',
            voiceStates: {
                cache: voiceStates,
            },
            afkChannel: afkChannel as any,
            fetch: vi.fn().mockReturnThis(),
        } as unknown as Guild;

        // Create a test client with the test guild
        const testGuilds = new Collection<string, Guild>();
        testGuilds.set('guild123', testGuild);

        const testClient = {
            guilds: {
                cache: testGuilds,
            },
        } as unknown as Client;

        // Mock database utils with a custom implementation for this test
        const mockGetOrCreateDataForGuild = vi.fn().mockImplementation((em, guild, userIds) => {
            // Only regular users should be passed
            expect(userIds).toContain('user123');
            expect(userIds).not.toContain('bot456');
            expect(userIds).not.toContain('afkuser789');

            return Promise.resolve({
                GuildUserData: [
                    {
                        userDiscordId: 'user123',
                        guildDiscordId: 'guild123',
                        experience: 95,
                    } as unknown as GuildUserData,
                ],
                GuildData: mockGuildData,
            });
        });

        vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockImplementation(
            mockGetOrCreateDataForGuild
        );

        // Create a test entity manager
        const testEntityManager = {
            persistAndFlush: vi.fn().mockResolvedValue(undefined),
            flush: vi.fn().mockResolvedValue(undefined),
        } as unknown as EntityManager<MongoDriver>;

        // Create a test ORM with the test entity manager
        const testOrm = {
            em: {
                fork: vi.fn().mockReturnValue(testEntityManager),
            },
        } as unknown as MikroORM<MongoDriver>;

        // Create a test job instance
        const testJob = new GiveVoiceXpJob(testClient, testOrm, mockLevelUpService);

        await testJob.run();

        // Verify getOrCreateDataForGuild was called
        expect(mockGetOrCreateDataForGuild).toHaveBeenCalledTimes(1);

        // Verify it was called only with 'user123' (not bot or AFK users)
        const getOrCreateCall = mockGetOrCreateDataForGuild.mock.calls[0];
        const userIdsParam = getOrCreateCall[2];

        expect(userIdsParam).toEqual(['user123']);
        expect(userIdsParam).not.toContain('bot456');
        expect(userIdsParam).not.toContain('afkuser789');

        // Verify XP was allocated
        expect(testEntityManager.persistAndFlush).toHaveBeenCalled();
    });

    it('should create user data for users without existing records', async () => {
        // Create new mock data for this test
        const newUserData = {
            userDiscordId: 'user123',
            guildDiscordId: 'guild123',
            experience: 0,
        } as unknown as GuildUserData;

        // Mock DatabaseUtils.getOrCreateDataForGuild to simulate creating new user data
        vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockImplementation(
            (em, guild, userIds) => {
                expect(userIds).toContain('user123');
                return Promise.resolve({
                    GuildUserData: [newUserData],
                    GuildData: mockGuildData,
                });
            }
        );

        // Create a test entity manager
        const testEntityManager = {
            persistAndFlush: vi.fn().mockResolvedValue(undefined),
            flush: vi.fn().mockResolvedValue(undefined),
        } as unknown as EntityManager<MongoDriver>;

        // Create a test ORM
        const testOrm = {
            em: {
                fork: vi.fn().mockReturnValue(testEntityManager),
            },
        } as unknown as MikroORM<MongoDriver>;

        // Create a test job instance
        const testJob = new GiveVoiceXpJob(mockClient, testOrm, mockLevelUpService);

        await testJob.run();

        // Verify getOrCreateDataForGuild was called with correct parameters
        expect(DatabaseUtils.getOrCreateDataForGuild).toHaveBeenCalledWith(
            testEntityManager,
            mockGuild,
            ['user123']
        );

        // Verify XP was added to the newly created user data
        expect(testEntityManager.persistAndFlush).toHaveBeenCalled();
    });

    it('should handle multiple users in voice channels', async () => {
        // Add another user in voice
        const mockMember2 = createMockMember('user456', 'TestUser2');

        // Add second user to voice states
        mockVoiceStates.set(
            'user456',
            createMockVoiceState(mockMember2, 'voice123', 'Test Voice Channel')
        );

        // Add data for second user
        const mockGuildUserData2 = {
            userDiscordId: 'user456',
            guildDiscordId: 'guild123',
            experience: 50,
        } as unknown as GuildUserData;

        // Update the mock data to include both users
        const updatedGuildUserDatas = [mockGuildUserDatas[0], mockGuildUserData2];

        // Update the DatabaseUtils mock for this test
        vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockResolvedValue({
            GuildUserData: updatedGuildUserDatas,
            GuildData: mockGuildData,
        });

        await giveVoiceXpJob.run();

        // Verify getOrCreateDataForGuild was called with both user IDs
        expect(DatabaseUtils.getOrCreateDataForGuild).toHaveBeenCalledWith(
            mockEntityManager,
            mockGuild,
            ['user123', 'user456']
        );

        // Verify XP was added to both users
        expect(updatedGuildUserDatas[0].experience).toBe(100); // 95 + 5 = 100
        expect(updatedGuildUserDatas[1].experience).toBe(55); // 50 + 5 = 55

        // Only user123 leveled up
        expect(mockLevelUpService.handleLevelUpsForGuild).toHaveBeenCalledWith(
            mockGuild,
            mockGuildData,
            [{ userId: 'user123', oldLevel: 0, newLevel: 1 }]
        );
    });
});
