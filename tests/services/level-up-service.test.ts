/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/typedef */
import { MongoDriver, MongoEntityManager } from '@mikro-orm/mongodb';
import { Guild, GuildMember, Role, TextChannel } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GuildData, LevelingRewardData } from '../../src/database/entities/index.js';
import { LangCode } from '../../src/enums/index.js';
import { LevelUpService } from '../../src/services/index.js';
import { ActionUtils, MessageUtils } from '../../src/utils/index.js';

// Mock utilities
vi.mock('../../src/utils/index.js', () => ({
    ActionUtils: {
        giveRole: vi.fn().mockResolvedValue(undefined),
    },
    FormatUtils: {
        userMention: vi.fn().mockImplementation(userId => `<@${userId}>`),
        joinWithAnd: vi.fn().mockImplementation(items => items.join(' and ')),
    },
    MessageUtils: {
        send: vi.fn().mockResolvedValue(undefined),
    },
    PermissionUtils: {
        canSend: vi.fn().mockResolvedValue(true),
    },
}));

describe('LevelUpService', () => {
    let levelUpService: LevelUpService;
    let mockEntityManager: MongoEntityManager<MongoDriver>;
    let mockGuild: Guild;
    let mockGuildData: GuildData;
    let mockLevelingChannel: TextChannel;
    let mockRoles: Map<string, Role>;
    let mockMember: GuildMember;
    let mockMember2: GuildMember;

    beforeEach(() => {
        // Create mocks
        mockRoles = new Map();
        const role1 = { id: 'role1', toString: () => '@Role1' } as unknown as Role;
        const role2 = { id: 'role2', toString: () => '@Role2' } as unknown as Role;
        mockRoles.set('role1', role1);
        mockRoles.set('role2', role2);

        mockLevelingChannel = {
            id: 'channel123',
            name: 'level-ups',
        } as unknown as TextChannel;

        mockMember = {
            id: 'user123',
            user: { id: 'user123', username: 'TestUser' },
        } as unknown as GuildMember;

        mockMember2 = {
            id: 'user456',
            user: { id: 'user456', username: 'TestUser2' },
        } as unknown as GuildMember;

        mockGuild = {
            id: 'guild123',
            name: 'Test Guild',
            channels: {
                fetch: vi.fn().mockResolvedValue(mockLevelingChannel),
            },
            roles: {
                fetch: vi.fn().mockResolvedValue(mockRoles),
            },
            members: {
                fetch: vi.fn().mockResolvedValue(mockMember),
            },
        } as unknown as Guild;

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

        mockEntityManager = {
            find: vi.fn(),
            findOne: vi.fn(),
            persistAndFlush: vi.fn(),
        } as unknown as MongoEntityManager<MongoDriver>;

        // Properly mock the find method with jest.Mock type
        (mockEntityManager.find as any) = vi.fn().mockResolvedValue([]);

        levelUpService = new LevelUpService();

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should handle users leveling up with no rewards', async () => {
        // Mock find to return empty array (no rewards for these levels)
        (mockEntityManager.find as any).mockResolvedValue([]);

        const leveledUpUsers = [{ userId: 'user123', oldLevel: 0, newLevel: 1 }];

        await levelUpService.handleLevelUpsForGuild(mockGuild, mockGuildData, leveledUpUsers);

        // Verify channel was fetched
        expect(mockGuild.channels.fetch).toHaveBeenCalledWith('channel123');

        // Verify roles were fetched
        expect(mockGuild.roles.fetch).toHaveBeenCalled();

        // Verify we looked for rewards
        expect(mockEntityManager.find).toHaveBeenCalledWith(LevelingRewardData, {
            guildDiscordId: 'guild123',
            level: { $in: [1] },
        });

        // Verify message was sent - matching the actual implementation
        expect(MessageUtils.send).toHaveBeenCalledWith(
            mockLevelingChannel,
            "**Congratulations** <@user123> you've reached level __**1**__!"
        );

        // Verify no role assignments happened
        expect(ActionUtils.giveRole).not.toHaveBeenCalled();
    });

    it('should assign roles when users level up with rewards', async () => {
        // Mock level up rewards
        const mockRewards = [
            {
                level: 2,
                roleDiscordIds: ['role1', 'role2'],
            } as unknown as LevelingRewardData,
        ];

        (mockEntityManager.find as any).mockResolvedValue(mockRewards);

        const leveledUpUsers = [{ userId: 'user123', oldLevel: 1, newLevel: 2 }];

        await levelUpService.handleLevelUpsForGuild(mockGuild, mockGuildData, leveledUpUsers);

        // Verify member was fetched
        expect(mockGuild.members.fetch).toHaveBeenCalledWith('user123');

        // Verify roles were assigned
        expect(ActionUtils.giveRole).toHaveBeenCalledTimes(2);
        expect(ActionUtils.giveRole).toHaveBeenCalledWith(mockMember, mockRoles.get('role1'));
        expect(ActionUtils.giveRole).toHaveBeenCalledWith(mockMember, mockRoles.get('role2'));

        // Verify level up message with roles was sent - matching the actual implementation
        expect(MessageUtils.send).toHaveBeenCalledWith(
            mockLevelingChannel,
            "**Congratulations** <@user123> you've reached level __**2**__ and have unlocked the following roles: @Role1 and @Role2!"
        );
    });

    it('should handle multiple users leveling up', async () => {
        // Looking at the implementation, we only call members.fetch if there are roles for that level
        // So we'll configure the test to match that behavior by providing roles only for level 3

        // Mock level up rewards for level 3 only
        const mockRewards = [
            {
                level: 3,
                roleDiscordIds: ['role1'],
            } as unknown as LevelingRewardData,
        ];

        (mockEntityManager.find as any).mockResolvedValue(mockRewards);

        // Prepare a mock for guild.members.fetch that can handle multiple users
        const fetchMemberMock = vi.fn();
        fetchMemberMock.mockImplementation(userId => {
            if (userId === 'user123') {
                return Promise.resolve(mockMember);
            } else if (userId === 'user456') {
                return Promise.resolve(mockMember2);
            }
            return Promise.resolve(null);
        });

        // Replace the actual fetch method
        mockGuild.members.fetch = fetchMemberMock;

        const leveledUpUsers = [
            { userId: 'user123', oldLevel: 2, newLevel: 3 }, // This user gets a role (level 3)
            { userId: 'user456', oldLevel: 1, newLevel: 2 }, // This user doesn't get a role (level 2)
        ];

        // Spy directly on the LevelUpService
        await levelUpService.handleLevelUpsForGuild(mockGuild, mockGuildData, leveledUpUsers);

        // In the implementation, members.fetch is only called for users who get roles
        // Only the first user (level 3) gets roles, so fetch should only be called once
        expect(fetchMemberMock).toHaveBeenCalledTimes(1);
        expect(fetchMemberMock).toHaveBeenCalledWith('user123');

        // Verify roles were assigned only to the user who reached level 3
        expect(ActionUtils.giveRole).toHaveBeenCalledTimes(1);
        expect(ActionUtils.giveRole).toHaveBeenCalledWith(mockMember, mockRoles.get('role1'));

        // Verify messages were sent for both users
        expect(MessageUtils.send).toHaveBeenCalledTimes(2);

        // Check the message content for each user
        expect(MessageUtils.send).toHaveBeenNthCalledWith(
            1,
            mockLevelingChannel,
            "**Congratulations** <@user123> you've reached level __**3**__ and have unlocked the following roles: @Role1!"
        );
        expect(MessageUtils.send).toHaveBeenNthCalledWith(
            2,
            mockLevelingChannel,
            "**Congratulations** <@user456> you've reached level __**2**__!"
        );
    });
});
