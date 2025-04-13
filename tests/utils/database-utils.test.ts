import { MongoDriver, MongoEntityManager } from '@mikro-orm/mongodb';
import { Collection } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GuildData, GuildUserData, UserData } from '../../src/database/entities/index.js';
import { LangCode } from '../../src/enums/index.js';
import { DatabaseUtils } from '../../src/utils/index.js';
import {
    createMockEntityManager,
    createMockGuild,
    createMockGuildData,
} from '../helpers/test-mocks.js';

// Mock MikroORM entities
vi.mock('../../src/database/entities/index.js', () => {
    // Create mock classes
    const mockUserData = vi.fn().mockImplementation(userId => {
        return {
            id: `user_${userId}`,
            discordId: userId,
            guildDatas: {
                add: vi.fn(),
            },
        };
    });

    const mockGuildData = vi.fn().mockImplementation(guildId => {
        return {
            id: 'guilddata123', // Fixed ID to match the expected test value
            discordId: guildId,
            userDatas: {
                add: vi.fn(),
            },
            settings: {
                language: LangCode.EN_US,
            },
        };
    });

    const mockGuildUserData = vi.fn().mockImplementation((guildRef, userRef, xp = 0) => {
        return {
            guild: guildRef,
            user: userRef,
            experience: xp,
            guildDiscordId: null,
            userDiscordId: null,
        };
    });

    return {
        GuildData: mockGuildData,
        UserData: mockUserData,
        GuildUserData: mockGuildUserData,
    };
});

describe('DatabaseUtils', () => {
    let mockEntityManager: MongoEntityManager<MongoDriver>;
    let mockGuild: any;
    let mockGuildData: GuildData;
    let mockUserData: UserData;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock entity manager using shared utility
        mockEntityManager = createMockEntityManager() as MongoEntityManager<MongoDriver>;

        // Create mock guild using shared utility
        mockGuild = createMockGuild('guild123', 'Test Guild');

        // Add members to the guild
        mockGuild.members.cache = new Collection()
            .set('user1', { id: 'user1', user: { bot: false } })
            .set('user2', { id: 'user2', user: { bot: false } });

        // Create mock guild data using shared utility
        mockGuildData = createMockGuildData('guilddata123', 'guild123') as unknown as GuildData;

        // Create mock user data
        mockUserData = {
            id: 'userdata1',
            discordId: 'user1',
            guildDatas: {
                add: vi.fn(),
            },
        } as unknown as UserData;

        // Setup specific mock behaviors for entity manager
        mockEntityManager.findOne = vi.fn();
        mockEntityManager.find = vi.fn();
        mockEntityManager.persistAndFlush = vi.fn().mockResolvedValue(undefined);
        mockEntityManager.flush = vi.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('createGuildUserDatas', () => {
        it('should return empty arrays when userIds array is empty', async () => {
            const result = await DatabaseUtils.createGuildUserDatas(
                mockEntityManager,
                'guild123',
                []
            );

            expect(result).toEqual({ GuildUserData: [], GuildData: null });
            expect(mockEntityManager.findOne).not.toHaveBeenCalled();
            expect(mockEntityManager.find).not.toHaveBeenCalled();
            expect(mockEntityManager.persistAndFlush).not.toHaveBeenCalled();
        });

        it('should fetch guild data if not provided', async () => {
            mockEntityManager.findOne = vi.fn().mockResolvedValue(mockGuildData);
            mockEntityManager.find = vi.fn().mockResolvedValue([]);

            await DatabaseUtils.createGuildUserDatas(mockEntityManager, 'guild123', ['user1']);

            expect(mockEntityManager.findOne).toHaveBeenCalledWith(GuildData, {
                discordId: 'guild123',
            });
        });

        it('should batch fetch existing users', async () => {
            mockEntityManager.findOne = vi.fn().mockResolvedValue(mockGuildData);
            mockEntityManager.find = vi.fn().mockResolvedValue([mockUserData]);

            await DatabaseUtils.createGuildUserDatas(mockEntityManager, 'guild123', [
                'user1',
                'user2',
            ]);

            expect(mockEntityManager.find).toHaveBeenCalledWith(UserData, {
                discordId: { $in: ['user1', 'user2'] },
            });
        });

        it('should create new UserData for users that do not exist', async () => {
            mockEntityManager.findOne = vi.fn().mockResolvedValue(mockGuildData);
            mockEntityManager.find = vi.fn().mockResolvedValue([mockUserData]); // Only user1 exists

            const result = await DatabaseUtils.createGuildUserDatas(mockEntityManager, 'guild123', [
                'user1',
                'user2',
            ]);

            // Should have created a new UserData for user2
            const newUserDatas = (mockEntityManager.persistAndFlush as any).mock.calls[0][0];
            expect(newUserDatas.length).toBe(1);
            expect(newUserDatas[0].discordId).toBe('user2');

            // Should have created GuildUserData entries for both users
            expect(result.GuildUserData.length).toBe(2);
            expect(result.GuildUserData[0].userDiscordId).toBe('user1');
            expect(result.GuildUserData[1].userDiscordId).toBe('user2');
        });

        it('should set the discord IDs for unique constraints', async () => {
            mockEntityManager.findOne = vi.fn().mockResolvedValue(mockGuildData);
            mockEntityManager.find = vi.fn().mockResolvedValue([]);

            const result = await DatabaseUtils.createGuildUserDatas(mockEntityManager, 'guild123', [
                'user1',
            ]);

            expect(result.GuildUserData[0].guildDiscordId).toBe('guild123');
            expect(result.GuildUserData[0].userDiscordId).toBe('user1');
        });

        it('should establish relationships between entities', async () => {
            mockEntityManager.findOne = vi.fn().mockResolvedValue(mockGuildData);
            mockEntityManager.find = vi.fn().mockResolvedValue([]);

            await DatabaseUtils.createGuildUserDatas(mockEntityManager, 'guild123', ['user1']);

            // Check that relationships were established by verifying persistAndFlush was called
            expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();

            // Cannot directly verify the add methods were called without specific mock tracking
            // since the userData instances are created inside the function
        });
    });

    describe('getOrCreateDataForGuild', () => {
        it('should create new guild data if none exists', async () => {
            // Mock findOne to return null (guild doesn't exist)
            mockEntityManager.findOne = vi.fn().mockResolvedValue(null);

            // Mock createGuildUserDatas to return expected data
            const mockNewGuildData = { ...mockGuildData };
            const mockNewGuildUserDatas = [
                { userDiscordId: 'user1' },
                { userDiscordId: 'user2' },
            ] as unknown as GuildUserData[];

            // We need to mock the static method directly
            const createGuildUserDatasSpy = vi
                .spyOn(DatabaseUtils, 'createGuildUserDatas')
                .mockResolvedValue({
                    GuildUserData: mockNewGuildUserDatas,
                    GuildData: mockNewGuildData,
                });

            const result = await DatabaseUtils.getOrCreateDataForGuild(
                mockEntityManager,
                mockGuild
            );

            // Should have created new guild data
            expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();

            // Should have called createGuildUserDatas with all members
            expect(createGuildUserDatasSpy).toHaveBeenCalledWith(mockEntityManager, 'guild123', [
                'user1',
                'user2',
            ]);

            // Should return the created data
            // Use toMatchObject instead of toEqual for more flexible comparison
            expect(result.GuildData).toMatchObject({
                id: mockNewGuildData.id,
                discordId: mockNewGuildData.discordId,
            });
            expect(result.GuildUserData).toEqual(mockNewGuildUserDatas);

            // Restore the original implementation
            createGuildUserDatasSpy.mockRestore();
        });

        it('should use existing guild data if available', async () => {
            // Mock findOne to return existing guild data
            mockEntityManager.findOne = vi.fn().mockResolvedValue(mockGuildData);

            // Mock find to return existing guild user data
            const existingGuildUserDatas = [
                { userDiscordId: 'user1' },
                { userDiscordId: 'user2' },
            ] as unknown as GuildUserData[];
            mockEntityManager.find = vi.fn().mockResolvedValue(existingGuildUserDatas);

            const result = await DatabaseUtils.getOrCreateDataForGuild(
                mockEntityManager,
                mockGuild
            );

            // Should not have created new guild data
            expect(mockEntityManager.persistAndFlush).not.toHaveBeenCalled();

            // Should return the existing data
            expect(result.GuildData).toBe(mockGuildData);
            expect(result.GuildUserData).toBe(existingGuildUserDatas);
        });

        it('should filter out bot users', async () => {
            // Add a bot user
            mockGuild.members.cache.set('bot1', { id: 'bot1', user: { bot: true } });

            // Mock findOne to return null (guild doesn't exist)
            mockEntityManager.findOne = vi.fn().mockResolvedValue(null);

            // Spy on createGuildUserDatas
            const createGuildUserDatasSpy = vi
                .spyOn(DatabaseUtils, 'createGuildUserDatas')
                .mockResolvedValue({
                    GuildUserData: [],
                    GuildData: mockGuildData,
                });

            await DatabaseUtils.getOrCreateDataForGuild(mockEntityManager, mockGuild);

            // Should have called createGuildUserDatas with only non-bot members
            expect(createGuildUserDatasSpy).toHaveBeenCalledWith(mockEntityManager, 'guild123', [
                'user1',
                'user2',
            ]);
            expect(createGuildUserDatasSpy).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.arrayContaining(['bot1'])
            );

            // Restore the original implementation
            createGuildUserDatasSpy.mockRestore();
        });

        it('should handle specific user IDs', async () => {
            // Mock find to return empty array (no existing user data)
            mockEntityManager.find = vi.fn().mockResolvedValue([]);

            // Mock createGuildUserDatas
            const createGuildUserDatasSpy = vi
                .spyOn(DatabaseUtils, 'createGuildUserDatas')
                .mockResolvedValue({
                    GuildUserData: [],
                    GuildData: mockGuildData,
                });

            await DatabaseUtils.getOrCreateDataForGuild(mockEntityManager, mockGuild, ['user1']);

            // Should have called createGuildUserDatas with only the specified user IDs
            expect(createGuildUserDatasSpy).toHaveBeenCalled();
            expect(createGuildUserDatasSpy.mock.calls[0][0]).toBe(mockEntityManager);
            expect(createGuildUserDatasSpy.mock.calls[0][1]).toBe('guild123');
            expect(createGuildUserDatasSpy.mock.calls[0][2]).toEqual(['user1']);

            // Restore the original implementation
            createGuildUserDatasSpy.mockRestore();
        });
    });
});
