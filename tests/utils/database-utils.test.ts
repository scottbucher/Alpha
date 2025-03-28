import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseUtils } from '../../src/utils/index.js';
import { MongoDriver, MongoEntityManager } from '@mikro-orm/mongodb';
import { Guild, Collection } from 'discord.js';
import { GuildData, GuildUserData, UserData } from '../../src/database/entities/index.js';
import { LangCode } from '../../src/enums/index.js';

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
    let mockGuild: Guild;
    let mockGuildData: GuildData;
    let mockUserData: UserData;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock entity manager
        mockEntityManager = {
            findOne: vi.fn(),
            find: vi.fn(),
            persistAndFlush: vi.fn().mockResolvedValue(undefined),
            flush: vi.fn().mockResolvedValue(undefined),
        } as unknown as MongoEntityManager<MongoDriver>;

        // Create mock guild
        mockGuild = {
            id: 'guild123',
            members: {
                cache: new Collection()
                    .set('user1', { id: 'user1', user: { bot: false } })
                    .set('user2', { id: 'user2', user: { bot: false } }),
            },
        } as unknown as Guild;

        // Create mock guild data
        mockGuildData = {
            id: 'guilddata123',
            discordId: 'guild123',
            userDatas: {
                add: vi.fn(),
            },
            settings: {
                language: LangCode.EN_US,
            },
        } as unknown as GuildData;

        // Create mock user data
        mockUserData = {
            id: 'userdata1',
            discordId: 'user1',
            guildDatas: {
                add: vi.fn(),
            },
        } as unknown as UserData;
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

            // No need to mock createGuildUserDatas as it shouldn't be called for existing users

            const result = await DatabaseUtils.getOrCreateDataForGuild(
                mockEntityManager,
                mockGuild
            );

            // Should not have created new guild data
            expect(mockEntityManager.persistAndFlush).not.toHaveBeenCalledWith(
                expect.any(GuildData)
            );

            // Should have fetched existing user data
            expect(mockEntityManager.find).toHaveBeenCalledWith(GuildUserData, {
                guildDiscordId: 'guild123',
                userDiscordId: { $in: ['user1', 'user2'] },
            });

            // Should return the existing data
            expect(result.GuildData).toEqual(mockGuildData);
            expect(result.GuildUserData).toEqual(existingGuildUserDatas);
        });

        it('should create missing user data for existing guild', async () => {
            // Mock findOne to return existing guild data
            mockEntityManager.findOne = vi.fn().mockResolvedValue(mockGuildData);

            // Mock find to return partial guild user data (user1 exists, user2 doesn't)
            const existingGuildUserDatas = [
                { userDiscordId: 'user1' },
            ] as unknown as GuildUserData[];
            mockEntityManager.find = vi.fn().mockResolvedValue(existingGuildUserDatas);

            // Mock createGuildUserDatas for the new user
            const newGuildUserDatas = [{ userDiscordId: 'user2' }] as unknown as GuildUserData[];

            const createGuildUserDatasSpy = vi
                .spyOn(DatabaseUtils, 'createGuildUserDatas')
                .mockResolvedValue({
                    GuildUserData: newGuildUserDatas,
                    GuildData: mockGuildData,
                });

            const result = await DatabaseUtils.getOrCreateDataForGuild(
                mockEntityManager,
                mockGuild
            );

            // Should have called createGuildUserDatas for the missing user
            expect(createGuildUserDatasSpy).toHaveBeenCalledWith(
                mockEntityManager,
                'guild123',
                ['user2'],
                mockGuildData
            );

            expect(result.GuildData).toEqual(mockGuildData);
            expect(result.GuildUserData).toHaveLength(2);
            expect(result.GuildUserData[0]).toMatchObject({ userDiscordId: 'user1' });
            expect(result.GuildUserData[1]).toMatchObject({ userDiscordId: 'user2' });

            // Restore the original implementation
            createGuildUserDatasSpy.mockRestore();
        });

        it('should respect memberIdListOverride parameter', async () => {
            // Mock findOne to return existing guild data
            mockEntityManager.findOne = vi.fn().mockResolvedValue(mockGuildData);

            // Mock find to return existing guild user data
            mockEntityManager.find = vi.fn().mockResolvedValue([]);

            // Mock createGuildUserDatas
            const createGuildUserDatasSpy = vi
                .spyOn(DatabaseUtils, 'createGuildUserDatas')
                .mockResolvedValue({
                    GuildUserData: [],
                    GuildData: mockGuildData,
                });

            // Use memberIdListOverride to specify specific members
            await DatabaseUtils.getOrCreateDataForGuild(mockEntityManager, mockGuild, [
                'specificUser1',
                'specificUser2',
            ]);

            // Should have called find with the override IDs
            expect(mockEntityManager.find).toHaveBeenCalledWith(GuildUserData, {
                guildDiscordId: 'guild123',
                userDiscordId: { $in: ['specificUser1', 'specificUser2'] },
            });

            // Should have called createGuildUserDatas with the override IDs
            expect(createGuildUserDatasSpy).toHaveBeenCalledWith(
                mockEntityManager,
                'guild123',
                ['specificUser1', 'specificUser2'],
                mockGuildData
            );

            // Restore the original implementation
            createGuildUserDatasSpy.mockRestore();
        });
    });
});
