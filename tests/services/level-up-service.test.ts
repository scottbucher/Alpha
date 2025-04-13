/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/typedef */
import { MongoDriver, MongoEntityManager } from '@mikro-orm/mongodb';
import { TextChannel } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LevelingRewardData } from '../../src/database/entities/index.js';
import { LangCode } from '../../src/enums/index.js';
import { LevelUpService } from '../../src/services/index.js';
import { ActionUtils, ClientUtils, MessageUtils } from '../../src/utils/index.js';
import {
    createMockGuild,
    createMockGuildData,
    createMockGuildMember,
    createMockTextChannel,
} from '../helpers/test-mocks.js';

// Mock utilities
vi.mock('../../src/utils/index.js', async () => {
    const actual = await vi.importActual('../../src/utils/index.js');
    return {
        ...actual,
        ActionUtils: {
            giveRole: vi.fn().mockResolvedValue(undefined),
        },
        MessageUtils: {
            send: vi.fn().mockResolvedValue(undefined),
        },
        PermissionUtils: {
            canSend: vi.fn().mockResolvedValue(true),
        },
        ClientUtils: {
            getConfiguredTextChannelIfExists: vi.fn().mockResolvedValue(undefined),
        },
    };
});

describe('LevelUpService', () => {
    let levelUpService: LevelUpService;
    let _mockEntityManager: MongoEntityManager<MongoDriver>;
    let mockGuild: any;
    let mockGuildData: any;
    let mockLevelingChannel: TextChannel;
    let mockRoles: Map<string, any>;
    let mockMember: any;
    let mockMember2: any;

    beforeEach(() => {
        // Create mocks using the shared helpers
        mockGuild = createMockGuild('guild123', 'Test Guild');
        mockGuildData = createMockGuildData('guilddata123', 'guild123');
        mockLevelingChannel = createMockTextChannel('channel123', 'level-ups');
        mockMember = createMockGuildMember('user123', 'TestUser');
        mockMember2 = createMockGuildMember('user456', 'TestUser2');

        // Setup roles map
        mockRoles = new Map();
        const role1 = { id: 'role1', toString: () => '@Role1' };
        const role2 = { id: 'role2', toString: () => '@Role2' };
        mockRoles.set('role1', role1);
        mockRoles.set('role2', role2);

        // Setup guild with our specific mock needs
        mockGuild.roles.cache = mockRoles;
        mockGuild.roles.fetch = vi.fn().mockResolvedValue(mockRoles);
        mockGuild.members.fetch = vi.fn().mockResolvedValue(mockMember);
        mockGuild.channels.fetch = vi.fn().mockResolvedValue(mockLevelingChannel);

        // Configure guild data for testing
        mockGuildData.levelingSettings = {
            channelDiscordId: 'channel123',
        };
        mockGuildData.settings = {
            language: LangCode.EN_US,
        };
        mockGuildData.levelingRewardDatas = {
            init: vi.fn(),
            getItems: vi.fn().mockReturnValue([]),
        };

        // Setup entity manager
        _mockEntityManager = {
            find: vi.fn().mockResolvedValue([]),
            findOne: vi.fn(),
            persistAndFlush: vi.fn(),
        } as unknown as MongoEntityManager<MongoDriver>;

        levelUpService = new LevelUpService();

        // Reset all mocks
        vi.clearAllMocks();

        // Setup ClientUtils mock to return the leveling channel
        vi.mocked(ClientUtils.getConfiguredTextChannelIfExists).mockResolvedValue(
            mockLevelingChannel
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should handle users leveling up with no rewards', async () => {
        // Mock find to return empty array (no rewards for these levels)
        mockGuildData.levelingRewardDatas.getItems = vi.fn().mockReturnValue([]);

        const leveledUpUsers = [{ userId: 'user123', oldLevel: 0, newLevel: 1 }];

        await levelUpService.handleLevelUpsForGuild(mockGuild, mockGuildData, leveledUpUsers);

        // Verify getItems was called
        expect(mockGuildData.levelingRewardDatas.getItems).toHaveBeenCalled();

        // Verify we looked for rewards
        expect(mockGuildData.levelingRewardDatas.init).toHaveBeenCalled();
        expect(mockGuildData.levelingRewardDatas.getItems).toHaveBeenCalled();

        // Verify message was sent - matching the actual implementation
        expect(MessageUtils.send).toHaveBeenCalledWith(
            mockLevelingChannel,
            "**Congratulations** <@!user123> you've reached level __**1**__!"
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

        mockGuildData.levelingRewardDatas.getItems = vi.fn().mockReturnValue(mockRewards);

        const leveledUpUsers = [{ userId: 'user123', oldLevel: 1, newLevel: 2 }];

        await levelUpService.handleLevelUpsForGuild(mockGuild, mockGuildData, leveledUpUsers);

        // Verify member was fetched
        expect(mockGuild.members.fetch).toHaveBeenCalledWith('user123');

        // Verify we looked for rewards
        expect(mockGuildData.levelingRewardDatas.init).toHaveBeenCalled();
        expect(mockGuildData.levelingRewardDatas.getItems).toHaveBeenCalled();

        // Verify roles were assigned
        expect(ActionUtils.giveRole).toHaveBeenCalledTimes(2);
        expect(ActionUtils.giveRole).toHaveBeenCalledWith(mockMember, mockRoles.get('role1'));
        expect(ActionUtils.giveRole).toHaveBeenCalledWith(mockMember, mockRoles.get('role2'));

        // Verify level up message with roles was sent - matching the actual implementation
        expect(MessageUtils.send).toHaveBeenCalledWith(
            mockLevelingChannel,
            "**Congratulations** <@!user123> you've reached level __**2**__ and have unlocked the following roles: @Role1 and @Role2!"
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

        mockGuildData.levelingRewardDatas.getItems = vi.fn().mockReturnValue(mockRewards);

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

        // Verify we looked for rewards
        expect(mockGuildData.levelingRewardDatas.init).toHaveBeenCalled();
        expect(mockGuildData.levelingRewardDatas.getItems).toHaveBeenCalled();

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
            "**Congratulations** <@!user123> you've reached level __**3**__ and have unlocked the following roles: @Role1!"
        );
        expect(MessageUtils.send).toHaveBeenNthCalledWith(
            2,
            mockLevelingChannel,
            "**Congratulations** <@!user456> you've reached level __**2**__!"
        );
    });
});
