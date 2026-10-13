import { Collection, Locale } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaimRewardsCommand } from '../../src/commands/chat/index.js';
import { EventData } from '../../src/models/internal-models.js';
import { Lang } from '../../src/services/index.js';
import { ActionUtils, InteractionUtils } from '../../src/utils/index.js';
import {
    createMockCommandInteraction,
    createMockEntityManager,
    createMockGuild,
    createMockGuildData,
    createMockGuildMember,
} from '../helpers/test-mocks.js';

describe('ClaimRewardsCommand', () => {
    let command: ClaimRewardsCommand;
    let mockIntr: any;
    let mockGuild: any;
    let mockGuildData: any;
    let mockMember: any;
    let data: EventData;

    function getGivenRoleIds(): string[] {
        return vi.mocked(ActionUtils.giveRole).mock.calls.map(([, role]) => role.id);
    }

    beforeEach(() => {
        vi.restoreAllMocks();

        vi.spyOn(InteractionUtils, 'send').mockResolvedValue(undefined);
        vi.spyOn(ActionUtils, 'giveRole').mockImplementation(async member => member);
        vi.spyOn(Lang, 'getSuccessEmbed');
        vi.spyOn(Lang, 'getErrorEmbed');

        command = new ClaimRewardsCommand();

        mockGuild = createMockGuild();
        mockGuild.roles.cache.set('role3', { id: 'role3', toString: () => '@Role3' });
        mockMember = createMockGuildMember();
        mockMember.roles.cache = new Collection();
        mockGuild.members.fetch = vi.fn().mockResolvedValue(mockMember);
        mockIntr = createMockCommandInteraction({ guild: mockGuild });

        mockGuildData = createMockGuildData('guilddata123', 'guild123');
        mockGuildData.levelingRewardDatas = { getItems: vi.fn().mockReturnValue([]) };
        mockGuildData.milestoneSettings = { xpMilestones: [] };

        data = new EventData(
            Locale.EnglishUS,
            Locale.EnglishUS,
            createMockEntityManager(),
            mockGuildData,
            undefined,
            { experience: 150_000 } as any
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should give roles of milestones the member has reached', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [
            { xp: 100_000, roleDiscordId: 'role1' },
            { xp: 150_000, roleDiscordId: 'role2' },
            { xp: 200_000, roleDiscordId: 'role3' },
        ];

        await command.execute(mockIntr, data);

        expect(getGivenRoleIds()).toEqual(['role1', 'role2']);
        expect(Lang.getSuccessEmbed).toHaveBeenCalledWith(
            'results',
            'successEmbeds.rewardsClaimed',
            Locale.EnglishUS,
            expect.objectContaining({ ROLES_ADDED: expect.stringContaining('<@&role2>') })
        );
    });

    it('should combine level reward and milestone roles without duplicates', async () => {
        mockGuildData.levelingRewardDatas.getItems.mockReturnValue([
            { level: 1, roleDiscordIds: ['role1'] },
            { level: 1000, roleDiscordIds: ['role3'] },
        ]);
        mockGuildData.milestoneSettings.xpMilestones = [
            { xp: 1_000, roleDiscordId: 'role1' },
            { xp: 2_000, roleDiscordId: 'role2' },
            { xp: 5_000 },
        ];

        await command.execute(mockIntr, data);

        expect(getGivenRoleIds()).toEqual(['role1', 'role2']);
    });

    it('should skip roles that no longer exist and roles the member already has', async () => {
        mockMember.roles.cache.set('role1', { id: 'role1' });
        mockGuildData.milestoneSettings.xpMilestones = [
            { xp: 1_000, roleDiscordId: 'role1' },
            { xp: 2_000, roleDiscordId: 'deletedRole' },
            { xp: 3_000, roleDiscordId: 'role2' },
        ];

        await command.execute(mockIntr, data);

        expect(getGivenRoleIds()).toEqual(['role2']);
    });

    it('should send no rewards to claim when only deleted roles remain', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [
            { xp: 1_000, roleDiscordId: 'deletedRole' },
        ];

        await command.execute(mockIntr, data);

        expect(ActionUtils.giveRole).not.toHaveBeenCalled();
        expect(Lang.getErrorEmbed).toHaveBeenCalledWith(
            'validation',
            'errorEmbeds.noRewardsToClaim',
            Locale.EnglishUS
        );
    });

    it('should handle guilds without milestone settings', async () => {
        mockGuildData.milestoneSettings = undefined;
        mockGuildData.levelingRewardDatas.getItems.mockReturnValue([
            { level: 1, roleDiscordIds: ['role1'] },
        ]);

        await command.execute(mockIntr, data);

        expect(getGivenRoleIds()).toEqual(['role1']);
    });

    it('should only list the roles that were given', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [
            { xp: 100_000, roleDiscordId: 'role1' },
            { xp: 150_000, roleDiscordId: 'role2' },
        ];
        vi.mocked(ActionUtils.giveRole).mockImplementation(async (member, role) =>
            role.id === 'role1' ? undefined : member
        );

        await command.execute(mockIntr, data);

        expect(getGivenRoleIds()).toEqual(['role1', 'role2']);
        expect(Lang.getSuccessEmbed).toHaveBeenCalledWith(
            'results',
            'successEmbeds.rewardsClaimed',
            Locale.EnglishUS,
            { ROLES_ADDED: '<@&role2>' }
        );
    });

    it('should send rewards could not be given when no role could be given', async () => {
        mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100_000, roleDiscordId: 'role1' }];
        vi.mocked(ActionUtils.giveRole).mockResolvedValue(undefined);

        await command.execute(mockIntr, data);

        expect(getGivenRoleIds()).toEqual(['role1']);
        expect(Lang.getSuccessEmbed).not.toHaveBeenCalled();
        expect(Lang.getErrorEmbed).toHaveBeenCalledWith(
            'validation',
            'errorEmbeds.rewardsCouldNotBeGiven',
            Locale.EnglishUS
        );
        expect(Lang.getErrorEmbed).not.toHaveBeenCalledWith(
            'validation',
            'errorEmbeds.noRewardsToClaim',
            Locale.EnglishUS
        );
    });
});
