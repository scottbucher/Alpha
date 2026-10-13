import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Collection, GuildMember, VoiceState } from 'discord.js';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GuildData, GuildUserData } from '../../src/database/entities/index.js';
import { LangCode } from '../../src/enums/index.js';
import { GiveVoiceXpJob } from '../../src/jobs/give-voice-xp-job.js';
import { LevelUpService, Logger, MilestoneService } from '../../src/services/index.js';
import {
    DatabaseUtils,
    ExperienceUtils,
    GuildUserDataCache,
    StatisticsUtils,
    TimeUtils,
} from '../../src/utils/index.js';
import {
    createMockClient,
    createMockEntityManager,
    createMockGuildData,
    createMockGuildMember,
    createMockOrm,
} from '../helpers/test-mocks.js';
import { assertNonNull } from '../helpers/test-utils.js';

const require = createRequire(import.meta.url);
const Config = require('../../config/config.json');

// Access the static method to clear cache for testing
const clearGuildUserDataCache = (): void => GuildUserDataCache.clear();

describe('GiveVoiceXpJob', () => {
    let giveVoiceXpJob: GiveVoiceXpJob;
    let mockClient: any;
    let mockOrm: MikroORM<MongoDriver>;
    let mockEntityManager: EntityManager<MongoDriver>;
    let mockLevelUpService: LevelUpService;
    let mockMilestoneService: MilestoneService;
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

    vi.mock('../../src/utils/statistics-utils.js', () => ({
        StatisticsUtils: {
            queueVoiceMinutesForGuild: vi.fn(),
            flushVoiceMinutesForGuild: vi.fn().mockResolvedValue(undefined),
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

        // Setup milestone service
        mockMilestoneService = {
            handleMilestonesForGuild: vi.fn().mockResolvedValue(undefined),
        } as unknown as MilestoneService;

        // Create job instance
        giveVoiceXpJob = new GiveVoiceXpJob(
            mockClient,
            mockOrm,
            mockLevelUpService,
            mockMilestoneService
        );

        // Setup XP multiplier
        ExperienceUtils.setMultiplierCache('guild123', 1);

        // Reset mocks
        vi.clearAllMocks();

        // Init cache with mocked ORM for cache-backed reads
        GuildUserDataCache.init(mockOrm);

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
        vi.restoreAllMocks();
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
            ['user123'],
            undefined,
            true
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
            expect.arrayContaining(['user123']),
            undefined,
            true
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
            expect.arrayContaining(['user123', 'disconnected123']),
            undefined,
            true
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

    it('should queue and flush daily voice stats', async () => {
        await giveVoiceXpJob.run();

        expect(StatisticsUtils.queueVoiceMinutesForGuild).toHaveBeenCalled();
        expect(StatisticsUtils.flushVoiceMinutesForGuild).toHaveBeenCalledWith(
            mockEntityManager,
            'guild123',
            true
        );
    });

    it('should queue stats with expected payload', async () => {
        await giveVoiceXpJob.run();

        const dayString = TimeUtils.getNowForGuild(mockGuildData).toISODate();

        expect(StatisticsUtils.queueVoiceMinutesForGuild).toHaveBeenCalledWith(
            'guild123',
            expect.objectContaining({
                dayString,
                minutesIncrement: Config.jobs.giveVoiceXp.minutesPerRun,
                startingXp: 95,
                createdIso: expect.any(String),
            })
        );
    });

    describe('Milestones', () => {
        it('should call the milestone service with the XP before and after the grant', async () => {
            await giveVoiceXpJob.run();

            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledTimes(1);
            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledWith(
                mockGuild,
                mockGuildData,
                [{ userId: 'user123', oldXp: 95, newXp: 100 }]
            );
        });

        it('should call the milestone service when nobody leveled up', async () => {
            mockGuildUserDatas[0].experience = 10;

            await giveVoiceXpJob.run();

            expect(mockLevelUpService.handleLevelUpsForGuild).not.toHaveBeenCalled();
            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledWith(
                mockGuild,
                mockGuildData,
                [{ userId: 'user123', oldXp: 10, newXp: 15 }]
            );
        });

        it('should include every member granted XP in one call per guild', async () => {
            const secondMember = createMockGuildMember('user456', 'SecondUser');
            mockVoiceStates.set(
                'user456',
                createMockVoiceState(secondMember, 'voice123', 'Test Voice Channel')
            );
            mockGuildUserDatas.push({
                userDiscordId: 'user456',
                guildDiscordId: 'guild123',
                experience: 500,
            } as unknown as GuildUserData);

            await giveVoiceXpJob.run();

            const milestoneCalls = vi.mocked(mockMilestoneService.handleMilestonesForGuild).mock
                .calls;
            expect(milestoneCalls).toHaveLength(1);
            expect(milestoneCalls[0][2]).toEqual([
                {
                    userId: 'user123',
                    oldXp: 95,
                    newXp: mockGuildUserDatas[0].experience,
                },
                {
                    userId: 'user456',
                    oldXp: 500,
                    newXp: mockGuildUserDatas[1].experience,
                },
            ]);
        });

        it('should handle level ups before milestones after persisting', async () => {
            const callOrder: string[] = [];
            vi.mocked(mockEntityManager.persistAndFlush).mockImplementation(async () => {
                callOrder.push('persist');
            });
            vi.mocked(mockLevelUpService.handleLevelUpsForGuild).mockImplementation(async () => {
                callOrder.push('levelUp');
            });
            vi.mocked(mockMilestoneService.handleMilestonesForGuild).mockImplementation(
                async () => {
                    callOrder.push('milestone');
                }
            );

            await giveVoiceXpJob.run();

            expect(callOrder).toEqual(['persist', 'levelUp', 'milestone']);
        });

        it('should pass freshly loaded guild data to the level up and milestone services', async () => {
            const freshGuildData = createMockGuildData('guilddata123', 'guild123');
            vi.mocked(mockEntityManager.findOne).mockResolvedValue(freshGuildData);

            await giveVoiceXpJob.run();

            expect(mockEntityManager.findOne).toHaveBeenCalledWith(GuildData, {
                discordId: 'guild123',
            });
            expect(mockLevelUpService.handleLevelUpsForGuild).toHaveBeenCalledWith(
                mockGuild,
                freshGuildData,
                [{ userId: 'user123', oldLevel: 0, newLevel: 1 }]
            );
            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledWith(
                mockGuild,
                freshGuildData,
                [{ userId: 'user123', oldXp: 95, newXp: 100 }]
            );
            expect(
                vi.mocked(mockMilestoneService.handleMilestonesForGuild).mock.calls[0][1]
            ).not.toBe(mockGuildData);
        });

        it('should fall back to the cached guild data when the guild data cannot be loaded', async () => {
            vi.mocked(mockEntityManager.findOne).mockResolvedValue(null);

            await giveVoiceXpJob.run();

            expect(vi.mocked(mockLevelUpService.handleLevelUpsForGuild).mock.calls[0][1]).toBe(
                mockGuildData
            );
            expect(vi.mocked(mockMilestoneService.handleMilestonesForGuild).mock.calls[0][1]).toBe(
                mockGuildData
            );
        });

        it('should not load guild data when no XP was granted', async () => {
            mockGuildUserDatas.length = 0;

            await giveVoiceXpJob.run();

            expect(mockEntityManager.findOne).not.toHaveBeenCalled();
            expect(mockLevelUpService.handleLevelUpsForGuild).not.toHaveBeenCalled();
            expect(mockMilestoneService.handleMilestonesForGuild).not.toHaveBeenCalled();
        });

        it('should use the XP at grant time when it changes during the awaits', async () => {
            // Simulate message XP updating the shared cached entity while the multiplier is fetched
            vi.spyOn(ExperienceUtils, 'getXpMultiplier').mockImplementation(async () => {
                mockGuildUserDatas[0].experience = 98;
                return 1;
            });

            await giveVoiceXpJob.run();

            expect(mockGuildUserDatas[0].experience).toBe(103);
            expect(mockLevelUpService.handleLevelUpsForGuild).toHaveBeenCalledWith(
                mockGuild,
                mockGuildData,
                [{ userId: 'user123', oldLevel: 0, newLevel: 1 }]
            );
            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledWith(
                mockGuild,
                mockGuildData,
                [{ userId: 'user123', oldXp: 98, newXp: 103 }]
            );
            // Daily stats keep the XP from before the awaits
            expect(StatisticsUtils.queueVoiceMinutesForGuild).toHaveBeenCalledWith(
                'guild123',
                expect.objectContaining({ startingXp: 95 })
            );
        });

        it('should log level up errors and still handle milestones and other guilds', async () => {
            const levelUpError = new Error('Unknown Member');
            vi.mocked(mockLevelUpService.handleLevelUpsForGuild).mockRejectedValue(levelUpError);
            const loggerErrorSpy = vi.spyOn(Logger, 'error').mockResolvedValue(undefined);

            const secondMember = createMockGuildMember('user456', 'SecondUser');
            const secondVoiceStates = new Collection<string, VoiceState>();
            secondVoiceStates.set(
                'user456',
                createMockVoiceState(secondMember, 'voice456', 'Second Voice Channel')
            );
            const secondGuild = {
                id: 'guild456',
                name: 'Second Guild',
                voiceStates: { cache: secondVoiceStates },
                afkChannel: null,
                fetch: vi.fn().mockReturnThis(),
            };
            mockClient.guilds.cache.set('guild456', secondGuild);
            const secondGuildData = createMockGuildData('guilddata456', 'guild456');
            vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockImplementation((_em, guild) =>
                Promise.resolve(
                    guild.id === 'guild456'
                        ? {
                              GuildUserData: [
                                  {
                                      userDiscordId: 'user456',
                                      guildDiscordId: 'guild456',
                                      experience: 95,
                                  } as unknown as GuildUserData,
                              ],
                              GuildData: secondGuildData,
                          }
                        : { GuildUserData: mockGuildUserDatas, GuildData: mockGuildData }
                )
            );
            vi.mocked(mockEntityManager.findOne).mockResolvedValue(null);

            await expect(giveVoiceXpJob.run()).resolves.toBeUndefined();

            expect(mockLevelUpService.handleLevelUpsForGuild).toHaveBeenCalledTimes(2);
            expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('guild123'),
                levelUpError
            );
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('guild456'),
                levelUpError
            );
            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledWith(
                mockGuild,
                mockGuildData,
                [{ userId: 'user123', oldXp: 95, newXp: 100 }]
            );
            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledWith(
                secondGuild,
                secondGuildData,
                [{ userId: 'user456', oldXp: 95, newXp: 100 }]
            );
        });

        it('should log guild data reload errors and fall back to the cached guild data', async () => {
            const reloadError = new Error('Mongo connection lost');
            const loggerErrorSpy = vi.spyOn(Logger, 'error').mockResolvedValue(undefined);

            const secondMember = createMockGuildMember('user456', 'SecondUser');
            const secondVoiceStates = new Collection<string, VoiceState>();
            secondVoiceStates.set(
                'user456',
                createMockVoiceState(secondMember, 'voice456', 'Second Voice Channel')
            );
            const secondGuild = {
                id: 'guild456',
                name: 'Second Guild',
                voiceStates: { cache: secondVoiceStates },
                afkChannel: null,
                fetch: vi.fn().mockReturnThis(),
            };
            mockClient.guilds.cache.set('guild456', secondGuild);
            const secondGuildData = createMockGuildData('guilddata456', 'guild456');
            vi.mocked(DatabaseUtils.getOrCreateDataForGuild).mockImplementation((_em, guild) =>
                Promise.resolve(
                    guild.id === 'guild456'
                        ? {
                              GuildUserData: [
                                  {
                                      userDiscordId: 'user456',
                                      guildDiscordId: 'guild456',
                                      experience: 95,
                                  } as unknown as GuildUserData,
                              ],
                              GuildData: secondGuildData,
                          }
                        : { GuildUserData: mockGuildUserDatas, GuildData: mockGuildData }
                )
            );
            vi.mocked(mockEntityManager.findOne).mockRejectedValue(reloadError);

            await expect(giveVoiceXpJob.run()).resolves.toBeUndefined();

            expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('guild123'),
                reloadError
            );
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('guild456'),
                reloadError
            );
            expect(mockLevelUpService.handleLevelUpsForGuild).toHaveBeenCalledWith(
                mockGuild,
                mockGuildData,
                [{ userId: 'user123', oldLevel: 0, newLevel: 1 }]
            );
            expect(mockLevelUpService.handleLevelUpsForGuild).toHaveBeenCalledWith(
                secondGuild,
                secondGuildData,
                [{ userId: 'user456', oldLevel: 0, newLevel: 1 }]
            );
            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledWith(
                mockGuild,
                mockGuildData,
                [{ userId: 'user123', oldXp: 95, newXp: 100 }]
            );
            expect(mockMilestoneService.handleMilestonesForGuild).toHaveBeenCalledWith(
                secondGuild,
                secondGuildData,
                [{ userId: 'user456', oldXp: 95, newXp: 100 }]
            );
        });

        it('should not call the milestone service for guilds with no valid voice states', async () => {
            mockVoiceStates.clear();

            await giveVoiceXpJob.run();

            expect(mockMilestoneService.handleMilestonesForGuild).not.toHaveBeenCalled();
        });
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
            const cachedDataAfterMessage = await GuildUserDataCache.get(mockGuild, ['user123']);
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
            const finalCachedData = await GuildUserDataCache.get(mockGuild, ['user123']);
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
            const cachedData = await GuildUserDataCache.get(mockGuild, ['user123']);
            if (cachedData) {
                // Force expiration by setting expiresAt to past
                (cachedData as any).expiresAt = Date.now() - 1000;
            }

            // Verify cache is expired (get should repopulate it)
            const refreshedCache = await GuildUserDataCache.get(mockGuild, ['user123']);
            expect(refreshedCache).not.toBeNull();

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
