/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/typedef */
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Collection, GuildMember, VoiceState } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GuildData, GuildUserData } from '../../src/database/entities/index.js';
import { LangCode } from '../../src/enums/index.js';
import { GiveVoiceXpJob } from '../../src/jobs/give-voice-xp-job.js';
import { LevelUpService } from '../../src/services/index.js';
import { DatabaseUtils, ExperienceUtils, GuildUserDataCache } from '../../src/utils/index.js';
import {
    createMockClient,
    createMockEntityManager,
    createMockGuildData,
    createMockGuildMember,
    createMockOrm,
} from '../helpers/test-mocks.js';
import { assertNonNull } from '../helpers/test-utils.js';

// Access the static method to clear cache for testing
const clearGuildUserDataCache = () => GuildUserDataCache.clear();

describe('GiveVoiceXpJob', () => {
    let giveVoiceXpJob: GiveVoiceXpJob;
    let mockClient: any;
    let mockOrm: MikroORM<MongoDriver>;
    let mockEntityManager: EntityManager<MongoDriver>;
    let mockLevelUpService: LevelUpService;
    let mockGuild: any;
    let mockVoiceStates: Collection<string, VoiceState>;
    let mockGuildUserDatas: GuildUserData[];
    let mockGuildData: any;

    // Helper function to create a mock voice state
    const createMockVoiceState = (
        member: GuildMember,
        channelId: string,
        channelName: string
    ): VoiceState => {
        return {
            member: member,
            channel: { id: channelId, name: channelName },
            channelId: channelId,
            selfDeaf: false,
        } as unknown as VoiceState;
    };

    // Even though I dislike mocking any utils, we already heavily mock the database utils in it's own test file
    // And this simplifies the tests a lot
    vi.mock('../../src/utils/database-utils.js', () => ({
        DatabaseUtils: {
            getOrCreateDataForGuild: vi.fn(),
        },
    }));

    beforeEach(() => {
        // Setup common mocks using the shared helpers
        mockClient = createMockClient();
        mockGuildData = createMockGuildData('guilddata123', 'guild123');

        // Create mock guild with voice capabilities
        mockVoiceStates = new Collection<string, VoiceState>();
        const mockMember = createMockGuildMember('user123', 'TestUser');
        mockVoiceStates.set(
            'user123',
            createMockVoiceState(mockMember, 'voice123', 'Test Voice Channel')
        );

        // Create mock guild with voice states
        mockGuild = {
            id: 'guild123',
            name: 'Test Guild',
            voiceStates: {
                cache: mockVoiceStates,
            },
            afkChannel: null,
            fetch: vi.fn().mockReturnThis(),
        };

        // Add guild to client
        mockClient.guilds.cache.set('guild123', mockGuild);

        // Setup entity manager and ORM
        mockEntityManager = createMockEntityManager();
        mockOrm = createMockOrm(mockEntityManager);

        // Setup database mocks
        mockGuildUserDatas = [
            {
                userDiscordId: 'user123',
                guildDiscordId: 'guild123',
                experience: 95, // Just below level 1
            } as unknown as GuildUserData,
        ];

        // Configure guild data for testing
        mockGuildData.levelingSettings = {
            channelDiscordId: 'channel123',
        };
        mockGuildData.settings = {
            language: LangCode.EN_US,
        };

        // Setup entity manager behavior
        mockEntityManager.findOne = vi.fn().mockImplementation((entity, query) => {
            if (entity === GuildData && query.discordId === 'guild123') {
                return Promise.resolve(mockGuildData);
            }
            return Promise.resolve(null);
        });

        // Setup level up service
        mockLevelUpService = {
            handleLevelUpsForGuild: vi.fn().mockResolvedValue(undefined),
        } as unknown as LevelUpService;

        // Create job instance
        giveVoiceXpJob = new GiveVoiceXpJob(mockClient, mockOrm, mockLevelUpService);

        // Setup XP multiplier
        ExperienceUtils.setMultiplierCache('guild123', 1);

        // Reset mocks
        vi.clearAllMocks();

        // Setup database utils
        vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockImplementation(() =>
            Promise.resolve({
                GuildUserData: mockGuildUserDatas,
                GuildData: mockGuildData,
            })
        );

        // Clear the cache before each test
        clearGuildUserDataCache();
    });

    afterEach(() => {
        vi.clearAllMocks();
        // Clear the cache after each test
        clearGuildUserDataCache();
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
        const regularMember = createMockGuildMember('user123', 'TestUser');
        const botMember = createMockGuildMember('bot456', 'BotUser');
        botMember.user.bot = true;
        const afkMember = createMockGuildMember('afkuser789', 'AfkUser');

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
            afkChannel: afkChannel,
            fetch: vi.fn().mockReturnThis(),
        };

        // Update the client with the test guild
        mockClient.guilds.cache.set('guild123', testGuild);

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

        // Run the job
        await giveVoiceXpJob.run();

        // Verify that the getOrCreateDataForGuild was called
        expect(mockGetOrCreateDataForGuild).toHaveBeenCalled();

        // Verify that DatabaseUtils was called with the correct user IDs
        expect(DatabaseUtils.getOrCreateDataForGuild).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.arrayContaining(['user123'])
        );

        // Verify that bot and AFK users were filtered out
        const calls = vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mock.calls;
        if (calls.length > 0) {
            const userIds = calls[0][2];
            expect(userIds).not.toContain('bot456');
            expect(userIds).not.toContain('afkuser789');
        }
    });

    it('should handle empty voice channels', async () => {
        // Create a guild with no voice states
        const emptyGuild = {
            id: 'emptyguild',
            name: 'Empty Guild',
            voiceStates: {
                cache: new Collection(),
            },
            fetch: vi.fn().mockReturnThis(),
        };

        // Add the empty guild to the client
        mockClient.guilds.cache.set('emptyguild', emptyGuild);

        // Mock the database utils
        vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockClear();

        // Run the job
        await giveVoiceXpJob.run();

        // We should never call DatabaseUtils for guilds with no voice users
        const calls = vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mock.calls;
        for (const call of calls) {
            expect(call[1].id).not.toBe('emptyguild');
        }
    });

    it('should apply XP multiplier from event', async () => {
        // Set multiplier
        ExperienceUtils.setMultiplierCache('guild123', 2);

        // Run the job
        await giveVoiceXpJob.run();

        // Verify multiplier was applied (95 + 5*2 = 105)
        const xpAfter = mockGuildUserDatas[0].experience;
        expect(xpAfter).toBe(105);
    });

    it('should handle disconnected members', async () => {
        // Add disconnected member to voice states
        const disconnectedVoiceState = createMockVoiceState(
            { id: 'disconnected123', user: { id: 'disconnected123', bot: false } } as any,
            'voice123',
            'Test Voice Channel'
        );
        mockVoiceStates.set('disconnected123', disconnectedVoiceState);

        // Run the job
        await giveVoiceXpJob.run();

        // Verify both user IDs were included in the database call
        expect(DatabaseUtils.getOrCreateDataForGuild).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.arrayContaining(['user123', 'disconnected123'])
        );
    });

    it('should handle voice states without channels', async () => {
        // Create voice state without a channel
        const memberWithoutChannel = createMockGuildMember('nochannel123', 'NoChannelUser');
        mockVoiceStates.set('nochannel123', {
            member: memberWithoutChannel,
            channel: null,
        } as unknown as VoiceState);

        // Run the job
        await giveVoiceXpJob.run();

        // Verify user with no channel is filtered out
        const calls = vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mock.calls;
        if (calls.length > 0) {
            const userIds = calls[0][2];
            expect(userIds).not.toContain('nochannel123');
        }
    });

    describe('XP Cache Integration', () => {
        it('should preserve message XP when voice XP job runs after message XP is granted', async () => {
            // Setup: Create initial cache entry (simulating voice XP job having cached data)
            const initialExperience = 100;
            const initialGuildUserData = {
                userDiscordId: 'user123',
                guildDiscordId: 'guild123',
                experience: initialExperience,
                lastGivenMessageXp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
            } as unknown as GuildUserData;

            const mockGuildDataForCache = createMockGuildData('guilddata123', 'guild123');
            GuildUserDataCache.set('guild123', mockGuildDataForCache, [initialGuildUserData]);

            // Step 1: Simulate message XP being granted (this should update the cache)
            const messageXpGranted = 20;
            const guildUserDataAfterMessage = {
                ...initialGuildUserData,
                experience: initialExperience + messageXpGranted,
                lastGivenMessageXp: new Date().toISOString(),
            } as unknown as GuildUserData;

            // Simulate the generic trigger updating the cache
            GuildUserDataCache.updateUserData('guild123', 'user123', guildUserDataAfterMessage);

            // Verify cache was updated
            const cachedDataAfterMessage = GuildUserDataCache.get('guild123');
            expect(cachedDataAfterMessage).not.toBeNull();
            assertNonNull(cachedDataAfterMessage);
            expect(cachedDataAfterMessage.guildUserDatas[0].experience).toBe(
                initialExperience + messageXpGranted
            );

            // Step 2: Simulate voice XP job running (should use updated cache, not stale data)
            // Mock database utils to return the updated data (simulating fresh fetch if cache wasn't used)
            vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockImplementation(() =>
                Promise.resolve({
                    GuildUserData: [guildUserDataAfterMessage],
                    GuildData: mockGuildDataForCache,
                })
            );

            // Run voice XP job
            await giveVoiceXpJob.run();

            // Step 3: Verify that voice XP was added to the updated experience, not the stale cached value
            // The voice XP job should have:
            // 1. Retrieved cached data (which has message XP)
            // 2. Added voice XP to that cached data
            // 3. Saved the result

            // Get the final experience from the persisted data
            const persistCalls = (mockEntityManager.persistAndFlush as any).mock.calls;
            expect(persistCalls.length).toBeGreaterThan(0);

            const persistedGuildUserDatas = persistCalls[persistCalls.length - 1][0];
            expect(persistedGuildUserDatas.length).toBeGreaterThan(0);

            const finalGuildUserData = persistedGuildUserDatas.find(
                (gud: any) => gud.userDiscordId === 'user123'
            );
            expect(finalGuildUserData).toBeDefined();
            assertNonNull(finalGuildUserData);

            // Verify the final experience includes both message XP and voice XP
            // Should be: initialExperience + messageXpGranted + voiceXpGranted
            const voiceXpGranted = 5; // Base voice XP
            const expectedFinalExperience = initialExperience + messageXpGranted + voiceXpGranted;
            expect(finalGuildUserData.experience).toBe(expectedFinalExperience);

            // Verify cache was also updated with the final value
            const finalCachedData = GuildUserDataCache.get('guild123');
            expect(finalCachedData).not.toBeNull();
            assertNonNull(finalCachedData);
            const cachedUserData = finalCachedData.guildUserDatas.find(
                (gud: any) => gud.userDiscordId === 'user123'
            );
            expect(cachedUserData).toBeDefined();
            assertNonNull(cachedUserData);
            expect(cachedUserData.experience).toBe(expectedFinalExperience);
        });

        it('should handle voice XP job running when cache has expired after message XP', async () => {
            // Setup: Create cache entry that will be expired
            const initialExperience = 100;
            const initialGuildUserData = {
                userDiscordId: 'user123',
                guildDiscordId: 'guild123',
                experience: initialExperience,
            } as unknown as GuildUserData;

            const mockGuildDataForCache = createMockGuildData('guilddata123', 'guild123');
            GuildUserDataCache.set('guild123', mockGuildDataForCache, [initialGuildUserData]);

            // Simulate message XP being granted
            const messageXpGranted = 20;
            const guildUserDataAfterMessage = {
                ...initialGuildUserData,
                experience: initialExperience + messageXpGranted,
            } as unknown as GuildUserData;

            GuildUserDataCache.updateUserData('guild123', 'user123', guildUserDataAfterMessage);

            // Manually expire the cache by manipulating the expiresAt time
            // (In real scenario, this would happen naturally after 5 minutes)
            const cachedData = GuildUserDataCache.get('guild123');
            if (cachedData) {
                // Force expiration by setting expiresAt to past
                (cachedData as any).expiresAt = Date.now() - 1000;
            }

            // Verify cache is expired
            expect(GuildUserDataCache.get('guild123')).toBeNull();

            // Mock database to return the updated data (with message XP)
            vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockImplementation(() =>
                Promise.resolve({
                    GuildUserData: [guildUserDataAfterMessage],
                    GuildData: mockGuildDataForCache,
                })
            );

            // Run voice XP job (should fetch fresh data from DB, not use expired cache)
            await giveVoiceXpJob.run();

            // Verify voice XP was added to the fresh data (which includes message XP)
            const persistCalls = (mockEntityManager.persistAndFlush as any).mock.calls;
            expect(persistCalls.length).toBeGreaterThan(0);

            const persistedGuildUserDatas = persistCalls[persistCalls.length - 1][0];
            const finalGuildUserData = persistedGuildUserDatas.find(
                (gud: any) => gud.userDiscordId === 'user123'
            );

            expect(finalGuildUserData).toBeDefined();
            assertNonNull(finalGuildUserData);

            const voiceXpGranted = 5;
            const expectedFinalExperience = initialExperience + messageXpGranted + voiceXpGranted;
            expect(finalGuildUserData.experience).toBe(expectedFinalExperience);
        });
    });
});
