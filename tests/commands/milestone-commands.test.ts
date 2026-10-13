/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Locale } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    MilestoneAddCommand,
    MilestoneIntervalCommand,
    MilestoneListCommand,
    MilestoneRemoveCommand,
} from '../../src/commands/chat/index.js';
import { EventData } from '../../src/models/internal-models.js';
import { Lang } from '../../src/services/index.js';
import { FormatUtils, InteractionUtils, ValidationUtils } from '../../src/utils/index.js';
import {
    createMockCommandInteraction,
    createMockEntityManager,
    createMockGuild,
    createMockGuildData,
} from '../helpers/test-mocks.js';

describe('Milestone commands', () => {
    let mockIntr: any;
    let mockGuildData: any;
    let mockEm: any;
    let data: EventData;
    let role1: any;

    function setOptions(options: { xp?: number; role?: any }) {
        mockIntr.options.getInteger.mockImplementation(name =>
            name === 'xp' ? (options.xp ?? null) : null
        );
        mockIntr.options.getRole.mockImplementation(name =>
            name === 'role' ? (options.role ?? null) : null
        );
    }

    function expectSentSuccess(location: string, variables?: object) {
        expect(Lang.getSuccessEmbed).toHaveBeenCalledOnce();
        let [type, sentLocation, langCode, sentVariables] = vi.mocked(Lang.getSuccessEmbed).mock
            .calls[0];
        expect([type, sentLocation, langCode]).toEqual(['results', location, Locale.EnglishUS]);
        if (variables) {
            expect(sentVariables).toEqual(expect.objectContaining(variables));
        }
        expect(Lang.getErrorEmbed).not.toHaveBeenCalled();
        expect(InteractionUtils.send).toHaveBeenCalledWith(
            mockIntr,
            vi.mocked(Lang.getSuccessEmbed).mock.results[0].value
        );
    }

    function expectSentError(location: string, variables?: object) {
        expect(Lang.getErrorEmbed).toHaveBeenCalledOnce();
        let [type, sentLocation, langCode, sentVariables] = vi.mocked(Lang.getErrorEmbed).mock
            .calls[0];
        expect([type, sentLocation, langCode]).toEqual(['validation', location, Locale.EnglishUS]);
        if (variables) {
            expect(sentVariables).toEqual(expect.objectContaining(variables));
        }
        expect(Lang.getSuccessEmbed).not.toHaveBeenCalled();
        expect(InteractionUtils.send).toHaveBeenCalledWith(
            mockIntr,
            vi.mocked(Lang.getErrorEmbed).mock.results[0].value
        );
        expect(mockEm.persistAndFlush).not.toHaveBeenCalled();
    }

    beforeEach(() => {
        vi.restoreAllMocks();

        vi.spyOn(InteractionUtils, 'send').mockResolvedValue(undefined);
        vi.spyOn(FormatUtils, 'commandMention').mockResolvedValue('</claim_rewards:123>');
        vi.spyOn(ValidationUtils, 'validateRole').mockImplementation(
            async (_intr, _data, role) => role as any
        );
        vi.spyOn(Lang, 'getSuccessEmbed');
        vi.spyOn(Lang, 'getErrorEmbed');

        mockIntr = createMockCommandInteraction({ guild: createMockGuild() });
        mockGuildData = createMockGuildData('guilddata123', 'guild123');
        mockGuildData.milestoneSettings = { xpMilestones: [] };
        mockEm = createMockEntityManager();
        data = new EventData(Locale.EnglishUS, Locale.EnglishUS, mockEm, mockGuildData);
        role1 = { id: 'role1', toString: () => '<@&role1>' };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('MilestoneAddCommand', () => {
        let command: MilestoneAddCommand;

        beforeEach(() => {
            command = new MilestoneAddCommand();
        });

        it('should add a new milestone and keep milestones sorted', async () => {
            mockGuildData.milestoneSettings.xpMilestones = [{ xp: 50_000 }, { xp: 1_000_000 }];
            setOptions({ xp: 100_000 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones.map(m => m.xp)).toEqual([
                50_000, 100_000, 1_000_000,
            ]);
            expect(mockGuildData.milestoneSettings.xpMilestones[1].roleDiscordId).toBeUndefined();
            expect(mockEm.persistAndFlush).toHaveBeenCalledWith(mockGuildData);
            expectSentSuccess('successEmbeds.milestoneAdded', {
                XP: (100_000).toLocaleString(),
            });
        });

        it('should add a new milestone with a role', async () => {
            setOptions({ xp: 2_000_000, role: role1 });

            await command.execute(mockIntr, data);

            expect(ValidationUtils.validateRole).toHaveBeenCalledWith(mockIntr, data, role1);
            expect(mockGuildData.milestoneSettings.xpMilestones).toEqual([
                expect.objectContaining({ xp: 2_000_000, roleDiscordId: 'role1' }),
            ]);
            expect(mockEm.persistAndFlush).toHaveBeenCalledWith(mockGuildData);
            expectSentSuccess('successEmbeds.milestoneAddedWithRole', {
                XP: (2_000_000).toLocaleString(),
                ROLE: '<@&role1>',
                CMD_CLAIM_REWARDS: '</claim_rewards:123>',
            });
        });

        it('should create milestone settings for guilds without them', async () => {
            mockGuildData.milestoneSettings = undefined;
            setOptions({ xp: 100_000 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones).toEqual([
                expect.objectContaining({ xp: 100_000 }),
            ]);
            expect(mockEm.persistAndFlush).toHaveBeenCalledWith(mockGuildData);
            expectSentSuccess('successEmbeds.milestoneAdded');
        });

        it("should update an existing milestone's role", async () => {
            mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100_000 }];
            setOptions({ xp: 100_000, role: role1 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones).toEqual([
                { xp: 100_000, roleDiscordId: 'role1' },
            ]);
            expect(mockEm.persistAndFlush).toHaveBeenCalledWith(mockGuildData);
            expectSentSuccess('successEmbeds.milestoneRoleUpdated', {
                XP: (100_000).toLocaleString(),
                ROLE: '<@&role1>',
            });
        });

        it('should error when the milestone already exists and no role is given', async () => {
            mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100_000, roleDiscordId: 'r' }];
            setOptions({ xp: 100_000 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones).toEqual([
                { xp: 100_000, roleDiscordId: 'r' },
            ]);
            expectSentError('errorEmbeds.milestoneAlreadyExists', {
                XP: (100_000).toLocaleString(),
            });
        });

        it('should error when the milestone limit is reached', async () => {
            mockGuildData.milestoneSettings.xpMilestones = Array.from({ length: 25 }, (_, i) => ({
                xp: (i + 1) * 1_000,
            }));
            setOptions({ xp: 1_000_000 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones).toHaveLength(25);
            expectSentError('errorEmbeds.milestoneLimitReached', { MAX: '25' });
        });

        it('should still allow updating a role when the milestone limit is reached', async () => {
            mockGuildData.milestoneSettings.xpMilestones = Array.from({ length: 25 }, (_, i) => ({
                xp: (i + 1) * 1_000,
            }));
            setOptions({ xp: 1_000, role: role1 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones[0].roleDiscordId).toBe('role1');
            expectSentSuccess('successEmbeds.milestoneRoleUpdated');
        });

        it('should do nothing when the role is invalid', async () => {
            vi.mocked(ValidationUtils.validateRole).mockResolvedValue(null);
            setOptions({ xp: 100_000, role: role1 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones).toEqual([]);
            expect(mockEm.persistAndFlush).not.toHaveBeenCalled();
            expect(InteractionUtils.send).not.toHaveBeenCalled();
        });
    });

    describe('MilestoneRemoveCommand', () => {
        let command: MilestoneRemoveCommand;

        beforeEach(() => {
            command = new MilestoneRemoveCommand();
        });

        it('should remove an existing milestone', async () => {
            mockGuildData.milestoneSettings.xpMilestones = [
                { xp: 100_000 },
                { xp: 1_000_000, roleDiscordId: 'role1' },
            ];
            setOptions({ xp: 1_000_000 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones).toEqual([{ xp: 100_000 }]);
            expect(mockEm.persistAndFlush).toHaveBeenCalledWith(mockGuildData);
            expectSentSuccess('successEmbeds.milestoneRemoved', {
                XP: (1_000_000).toLocaleString(),
            });
        });

        it('should error when the milestone does not exist', async () => {
            mockGuildData.milestoneSettings.xpMilestones = [{ xp: 100_000 }];
            setOptions({ xp: 200_000 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpMilestones).toEqual([{ xp: 100_000 }]);
            expectSentError('errorEmbeds.milestoneDoesNotExist', {
                XP: (200_000).toLocaleString(),
            });
        });

        it('should error for guilds without milestone settings', async () => {
            mockGuildData.milestoneSettings = undefined;
            setOptions({ xp: 100_000 });

            await command.execute(mockIntr, data);

            expectSentError('errorEmbeds.milestoneDoesNotExist');
        });
    });

    describe('MilestoneIntervalCommand', () => {
        let command: MilestoneIntervalCommand;

        beforeEach(() => {
            command = new MilestoneIntervalCommand();
        });

        it('should set the interval', async () => {
            setOptions({ xp: 1_000_000 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpInterval).toBe(1_000_000);
            expect(mockEm.persistAndFlush).toHaveBeenCalledWith(mockGuildData);
            expectSentSuccess('successEmbeds.milestoneIntervalSet', {
                XP: (1_000_000).toLocaleString(),
            });
        });

        it('should clear the interval when no xp is given', async () => {
            mockGuildData.milestoneSettings.xpInterval = 1_000_000;
            setOptions({});

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings.xpInterval).toBeUndefined();
            expect(mockEm.persistAndFlush).toHaveBeenCalledWith(mockGuildData);
            expectSentSuccess('successEmbeds.milestoneIntervalCleared');
        });

        it('should set the interval for guilds without milestone settings', async () => {
            mockGuildData.milestoneSettings = undefined;
            setOptions({ xp: 500_000 });

            await command.execute(mockIntr, data);

            expect(mockGuildData.milestoneSettings).toEqual(
                expect.objectContaining({ xpMilestones: [], xpInterval: 500_000 })
            );
            expectSentSuccess('successEmbeds.milestoneIntervalSet');
        });
    });

    describe('MilestoneListCommand', () => {
        let command: MilestoneListCommand;

        function getListVariables() {
            let call = vi
                .mocked(Lang.getEmbed)
                .mock.calls.find(([, location]) => location === 'embeds.milestoneList');
            return call[3];
        }

        beforeEach(() => {
            command = new MilestoneListCommand();
            vi.spyOn(Lang, 'getEmbed');
            mockIntr.guild.channels.resolve = vi.fn(id =>
                ['milestoneChannel', 'levelingChannel'].includes(id)
                    ? { toString: () => `<#${id}>` }
                    : null
            );
            mockGuildData.levelingSettings = { channelDiscordId: 'levelingChannel' };
        });

        it('should send the empty embed when nothing is configured', async () => {
            mockGuildData.milestoneSettings = undefined;

            await command.execute(mockIntr, data);

            expect(Lang.getEmbed).toHaveBeenCalledWith(
                'info',
                'embeds.milestoneListEmpty',
                Locale.EnglishUS,
                expect.any(Object)
            );
            expect(InteractionUtils.send).toHaveBeenCalledOnce();
        });

        it('should list milestones, the interval, and the milestone channel', async () => {
            mockGuildData.milestoneSettings = {
                channelDiscordId: 'milestoneChannel',
                xpMilestones: [{ xp: 2_000_000 }, { xp: 100_000, roleDiscordId: 'role1' }],
                xpInterval: 1_000_000,
            };

            await command.execute(mockIntr, data);

            let variables = getListVariables();
            expect(variables.MILESTONES.split('\n')).toEqual([
                `**${(100_000).toLocaleString()} XP**: <@&role1>`,
                `**${(2_000_000).toLocaleString()} XP**`,
            ]);
            expect(variables.INTERVAL).toContain((1_000_000).toLocaleString());
            expect(variables.CHANNEL).toBe('<#milestoneChannel>');
        });

        it('should show the leveling channel fallback and no interval', async () => {
            mockGuildData.milestoneSettings = { xpMilestones: [{ xp: 100_000 }] };

            await command.execute(mockIntr, data);

            let variables = getListVariables();
            expect(variables.INTERVAL).toBe(Lang.getRef('info', 'terms.none', Locale.EnglishUS));
            expect(variables.CHANNEL).toContain('<#levelingChannel>');
            expect(variables.CHANNEL).not.toBe('<#levelingChannel>');
        });

        it('should show not set when no channel resolves', async () => {
            mockGuildData.levelingSettings = {};
            mockGuildData.milestoneSettings = { xpMilestones: [], xpInterval: 1_000_000 };

            await command.execute(mockIntr, data);

            let variables = getListVariables();
            expect(variables.MILESTONES).toBe(Lang.getRef('info', 'terms.none', Locale.EnglishUS));
            expect(variables.CHANNEL).toBe(Lang.getRef('info', 'terms.notSet', Locale.EnglishUS));
        });
    });
});
