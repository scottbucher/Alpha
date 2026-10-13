/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/typedef */
import { Collection, EmbedBuilder } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger, MilestoneService } from '../../src/services/index.js';
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
            giveRole: vi.fn(),
        },
        MessageUtils: {
            send: vi.fn().mockResolvedValue(undefined),
        },
        ClientUtils: {
            getConfiguredTextChannelIfExists: vi.fn().mockResolvedValue(null),
        },
    };
});

describe('MilestoneService', () => {
    let milestoneService: MilestoneService;
    let mockGuild: any;
    let mockGuildData: any;
    let mockMilestoneChannel: any;
    let mockLevelingChannel: any;
    let mockMember: any;
    let mockRoles: Collection<string, any>;
    let loggerErrorSpy: any;

    function mockChannels(channels: { [id: string]: any }) {
        vi.mocked(ClientUtils.getConfiguredTextChannelIfExists).mockImplementation(
            async (_guild, discordId) => {
                const channel = channels[discordId];
                if (channel instanceof Error) {
                    throw channel;
                }
                return channel ?? null;
            }
        );
    }

    function getSentMessage(callIndex = 0): { content: string; embeds: EmbedBuilder[] } {
        return vi.mocked(MessageUtils.send).mock.calls[callIndex][1] as any;
    }

    beforeEach(() => {
        vi.clearAllMocks();

        mockGuild = createMockGuild('guild123', 'Test Guild');
        mockGuildData = createMockGuildData('guilddata123', 'guild123');
        mockMilestoneChannel = createMockTextChannel('milestoneChannel', 'milestones');
        mockLevelingChannel = createMockTextChannel('levelingChannel', 'level-ups');
        mockMember = createMockGuildMember('user123', 'TestUser');

        mockRoles = new Collection();
        mockRoles.set('role1', { id: 'role1', toString: () => '@Role1' });
        mockRoles.set('role2', { id: 'role2', toString: () => '@Role2' });
        mockGuild.roles.fetch = vi.fn().mockResolvedValue(mockRoles);
        mockGuild.members.fetch = vi.fn().mockResolvedValue(mockMember);

        mockGuildData.levelingSettings = { channelDiscordId: 'levelingChannel' };
        mockGuildData.milestoneSettings = {
            channelDiscordId: 'milestoneChannel',
            xpMilestones: [{ xp: 100000 }],
        };

        mockChannels({
            milestoneChannel: mockMilestoneChannel,
            levelingChannel: mockLevelingChannel,
        });
        vi.mocked(ActionUtils.giveRole).mockImplementation(async member => member);
        loggerErrorSpy = vi.spyOn(Logger, 'error').mockResolvedValue(undefined);

        milestoneService = new MilestoneService();
    });

    afterEach(() => {
        vi.clearAllMocks();
        loggerErrorSpy.mockRestore();
    });

    it('should do nothing when no milestone was crossed', async () => {
        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 1000, newXp: 1020 },
        ]);

        expect(ClientUtils.getConfiguredTextChannelIfExists).not.toHaveBeenCalled();
        expect(mockGuild.roles.fetch).not.toHaveBeenCalled();
        expect(mockGuild.members.fetch).not.toHaveBeenCalled();
        expect(MessageUtils.send).not.toHaveBeenCalled();
    });

    it('should do nothing when the guild has no milestone settings', async () => {
        mockGuildData.milestoneSettings = undefined;

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(ClientUtils.getConfiguredTextChannelIfExists).not.toHaveBeenCalled();
        expect(MessageUtils.send).not.toHaveBeenCalled();
    });

    it('should announce the milestone in the milestone channel', async () => {
        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(ClientUtils.getConfiguredTextChannelIfExists).toHaveBeenCalledTimes(1);
        expect(ClientUtils.getConfiguredTextChannelIfExists).toHaveBeenCalledWith(
            mockGuild,
            'milestoneChannel'
        );
        expect(MessageUtils.send).toHaveBeenCalledTimes(1);
        expect(vi.mocked(MessageUtils.send).mock.calls[0][0]).toBe(mockMilestoneChannel);

        const message = getSentMessage();
        expect(message.content).toBe('<@!user123>');
        expect(message.embeds).toHaveLength(1);
        expect(message.embeds[0].data.title).toBe('🎉 XP Milestone Reached!');
        expect(message.embeds[0].data.description).toBe(
            "<@!user123> just passed **100,000 XP**! They're now level **34**."
        );

        // No roles configured, so no role lookups
        expect(mockGuild.roles.fetch).not.toHaveBeenCalled();
        expect(mockGuild.members.fetch).not.toHaveBeenCalled();
        expect(ActionUtils.giveRole).not.toHaveBeenCalled();
    });

    it('should fall back to the leveling channel when the milestone channel is not set', async () => {
        mockGuildData.milestoneSettings.channelDiscordId = undefined;

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(ClientUtils.getConfiguredTextChannelIfExists).toHaveBeenCalledTimes(1);
        expect(ClientUtils.getConfiguredTextChannelIfExists).toHaveBeenCalledWith(
            mockGuild,
            'levelingChannel'
        );
        expect(vi.mocked(MessageUtils.send).mock.calls[0][0]).toBe(mockLevelingChannel);
    });

    it('should fall back to the leveling channel when the milestone channel is unavailable', async () => {
        mockChannels({ levelingChannel: mockLevelingChannel });

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(MessageUtils.send).toHaveBeenCalledTimes(1);
        expect(vi.mocked(MessageUtils.send).mock.calls[0][0]).toBe(mockLevelingChannel);
    });

    it('should fall back to the leveling channel when fetching the milestone channel throws', async () => {
        mockChannels({
            milestoneChannel: new Error('Unknown Channel'),
            levelingChannel: mockLevelingChannel,
        });

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(MessageUtils.send).toHaveBeenCalledTimes(1);
        expect(vi.mocked(MessageUtils.send).mock.calls[0][0]).toBe(mockLevelingChannel);
    });

    it('should still grant roles but not send a message when no channel is available', async () => {
        mockChannels({});
        mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100000, roleDiscordId: 'role1' }];

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(ActionUtils.giveRole).toHaveBeenCalledTimes(1);
        expect(ActionUtils.giveRole).toHaveBeenCalledWith(mockMember, mockRoles.get('role1'));
        expect(MessageUtils.send).not.toHaveBeenCalled();
    });

    it('should grant all crossed milestone roles and announce the highest milestone', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [
            { xp: 100000, roleDiscordId: 'role1' },
            { xp: 100005, roleDiscordId: 'role2' },
            { xp: 200000, roleDiscordId: 'role2' },
        ];

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(mockGuild.roles.fetch).toHaveBeenCalledTimes(1);
        expect(mockGuild.members.fetch).toHaveBeenCalledTimes(1);
        expect(mockGuild.members.fetch).toHaveBeenCalledWith('user123');
        expect(ActionUtils.giveRole).toHaveBeenCalledTimes(2);
        expect(ActionUtils.giveRole).toHaveBeenNthCalledWith(1, mockMember, mockRoles.get('role1'));
        expect(ActionUtils.giveRole).toHaveBeenNthCalledWith(2, mockMember, mockRoles.get('role2'));

        expect(MessageUtils.send).toHaveBeenCalledTimes(1);
        const message = getSentMessage();
        expect(message.content).toBe('<@!user123>');
        expect(message.embeds[0].data.description).toBe(
            [
                "<@!user123> just passed **100,005 XP**! They're now level **34**.",
                '',
                "They've earned the @Role1 and @Role2 roles!",
            ].join('\n')
        );
    });

    it('should use the singular role wording for one role', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100000, roleDiscordId: 'role1' }];

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(getSentMessage().embeds[0].data.description).toContain(
            "They've earned the @Role1 role!"
        );
    });

    it('should skip roles that no longer exist', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [
            { xp: 100000, roleDiscordId: 'deletedRole' },
        ];

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(mockGuild.roles.fetch).toHaveBeenCalledTimes(1);
        expect(mockGuild.members.fetch).not.toHaveBeenCalled();
        expect(ActionUtils.giveRole).not.toHaveBeenCalled();
        expect(getSentMessage().embeds[0].data.description).toBe(
            "<@!user123> just passed **100,000 XP**! They're now level **34**."
        );
    });

    it('should not give a role the member already has but still mention it', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100000, roleDiscordId: 'role1' }];
        mockMember.roles.cache.set('role1', mockRoles.get('role1'));

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(ActionUtils.giveRole).not.toHaveBeenCalled();
        expect(getSentMessage().embeds[0].data.description).toContain('@Role1 role');
    });

    it('should log and not mention roles that could not be given', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100000, roleDiscordId: 'role1' }];
        vi.mocked(ActionUtils.giveRole).mockResolvedValue(undefined);

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
        expect(loggerErrorSpy.mock.calls[0][0]).toContain('role1');
        expect(getSentMessage().embeds[0].data.description).not.toContain('@Role1');
    });

    it('should announce the interval milestone', async () => {
        mockGuildData.milestoneSettings = { xpInterval: 1000000, xpMilestones: [] };

        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user123', oldXp: 1999990, newXp: 2000010.5 },
        ]);

        expect(getSentMessage().embeds[0].data.description).toBe(
            "<@!user123> just passed **2,000,000 XP**! They're now level **101**."
        );
    });

    it('should only announce for users who crossed a milestone', async () => {
        await milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
            { userId: 'user456', oldXp: 50, newXp: 70 },
            { userId: 'user123', oldXp: 99990, newXp: 100010 },
        ]);

        expect(MessageUtils.send).toHaveBeenCalledTimes(1);
        expect(getSentMessage().content).toBe('<@!user123>');
    });

    it('should continue with other users when one user fails', async () => {
        vi.mocked(MessageUtils.send).mockRejectedValueOnce(new Error('Send failed'));

        await expect(
            milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
                { userId: 'user456', oldXp: 99990, newXp: 100010 },
                { userId: 'user123', oldXp: 99995, newXp: 100015 },
            ])
        ).resolves.toBeUndefined();

        expect(MessageUtils.send).toHaveBeenCalledTimes(2);
        expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should not throw when an error occurs', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100000, roleDiscordId: 'role1' }];
        mockGuild.roles.fetch = vi.fn().mockRejectedValue(new Error('Discord down'));

        await expect(
            milestoneService.handleMilestonesForGuild(mockGuild, mockGuildData, [
                { userId: 'user123', oldXp: 99990, newXp: 100010 },
            ])
        ).resolves.toBeUndefined();

        expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
        expect(MessageUtils.send).not.toHaveBeenCalled();
    });
});
