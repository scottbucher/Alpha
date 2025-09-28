import { GuildMember } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExperienceUtils } from '../../src/utils/index.js';
import { mockRandomValues } from '../helpers/test-utils.js';

// Mock GuildMember factory
function createMockGuildMember(options: { premiumSince?: Date | null } = {}): GuildMember {
    return {
        premiumSince: options.premiumSince || null,
    } as GuildMember;
}

describe('ExperienceUtils', () => {
    describe('getXpForNextLevel', () => {
        it('should return correct XP for level 0', () => {
            expect(ExperienceUtils.getXpForNextLevel(0)).toBe(100);
        });

        it('should return correct XP for level 1', () => {
            expect(ExperienceUtils.getXpForNextLevel(1)).toBe(155);
        });

        it('should return correct XP for level 5', () => {
            expect(ExperienceUtils.getXpForNextLevel(5)).toBe(475);
        });

        it('should return correct XP for level 45', () => {
            expect(ExperienceUtils.getXpForNextLevel(45)).toBe(12475);
        });

        it('should return correct XP for level 115', () => {
            expect(ExperienceUtils.getXpForNextLevel(115)).toBe(71975);
        });
    });

    describe('getLevelFromXp', () => {
        it('should return level 0 for 0 XP', () => {
            expect(ExperienceUtils.getLevelFromXp(0)).toBe(0);
        });

        it('should return level 0 for negative XP', () => {
            expect(ExperienceUtils.getLevelFromXp(-10)).toBe(0);
        });

        it('should return level 0 for 99 XP', () => {
            expect(ExperienceUtils.getLevelFromXp(99)).toBe(0);
        });

        it('should return level 1 for 100 XP', () => {
            expect(ExperienceUtils.getLevelFromXp(100)).toBe(1);
        });

        it('should return level 1 for 254 XP', () => {
            expect(ExperienceUtils.getLevelFromXp(268375)).toBe(50);
        });

        it('should return level 2 for 255 XP', () => {
            expect(ExperienceUtils.getLevelFromXp(1899250)).toBe(100);
        });

        it('should return correct level for high XP value', () => {
            expect(ExperienceUtils.getLevelFromXp(4675)).toBe(10);
        });

        it('should return correct level for real world example', () => {
            expect(ExperienceUtils.getLevelFromXp(1035374)).toBe(80);
        });

        it('should produce consistent results with getTotalXpForLevel', () => {
            // For various levels, check that level calculation works with total XP
            for (let level = 1; level <= 20; level++) {
                const totalXp = ExperienceUtils.getTotalXpForLevel(level);
                expect(ExperienceUtils.getLevelFromXp(totalXp)).toBe(level);
            }
        });
    });

    describe('getTotalXpForLevel', () => {
        it('should return 0 XP for level 0', () => {
            expect(ExperienceUtils.getTotalXpForLevel(0)).toBe(0);
        });

        it('should return 100 XP for level 1', () => {
            expect(ExperienceUtils.getTotalXpForLevel(1)).toBe(100);
        });

        it('should return 255 XP for level 2', () => {
            expect(ExperienceUtils.getTotalXpForLevel(2)).toBe(255);
        });

        it('should return 349525 XP for level 55', () => {
            expect(ExperienceUtils.getTotalXpForLevel(55)).toBe(349525);
        });

        it('should return 1076455 XP for level 82', () => {
            expect(ExperienceUtils.getTotalXpForLevel(82)).toBe(1076455);
        });
    });

    describe('getXpProgressInCurrentLevel', () => {
        it('should return 0 for exact level boundaries', () => {
            // At exactly level 1 (100 XP total), progress should be 0
            expect(ExperienceUtils.getXpProgressInCurrentLevel(100)).toBe(0);
        });

        it('should return correct progress within a level', () => {
            // Level 1 just started (100 XP) + 50 more XP = 50 progress
            expect(ExperienceUtils.getXpProgressInCurrentLevel(150)).toBe(50);
        });

        it('should return 0 for level 0', () => {
            expect(ExperienceUtils.getXpProgressInCurrentLevel(0)).toBe(0);
        });

        it('should return correct amount for real world example', () => {
            expect(ExperienceUtils.getXpProgressInCurrentLevel(1035374)).toBe(31974);
        });
    });

    describe('getXpNeededForNextLevel', () => {
        it('should return full level XP when at level boundary', () => {
            // At level 1 (100 XP), need 155 more to reach level 2
            expect(ExperienceUtils.getXpNeededForNextLevel(100)).toBe(155);
        });

        it('should return remaining XP when partially through level', () => {
            // At level 1 (100 XP) + 55 progress = 155 XP total
            // Need 155 - 55 = 100 more to reach level 2
            expect(ExperienceUtils.getXpNeededForNextLevel(155)).toBe(100);
        });
    });

    describe('generateBaseMessageXp', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should return value within configured range', () => {
            // Use our shared random value mocking utility
            const cleanup = mockRandomValues(0, 1, 0.5);

            // Test min value
            expect(ExperienceUtils.generateBaseMessageXp()).toBe(15);

            // Test max value
            expect(ExperienceUtils.generateBaseMessageXp()).toBe(25);

            // Test middle value
            expect(ExperienceUtils.generateBaseMessageXp()).toBe(20);

            // Clean up the mock
            cleanup();
        });
    });

    describe('generateMessageXp', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should apply guild member multipliers', () => {
            const cleanup = mockRandomValues(0.5); // Middle value (20 base XP)

            // Regular member (no premium)
            const regularMember = createMockGuildMember();
            expect(ExperienceUtils.generateMessageXp(regularMember)).toBe(20);

            // Premium member (boosting)
            const premiumMember = createMockGuildMember({
                premiumSince: new Date('2023-01-01'),
            });
            expect(ExperienceUtils.generateMessageXp(premiumMember)).toBe(24); // 20 * 1.2

            cleanup();
        });

        it('should apply base multiplier along with guild member multipliers', () => {
            const cleanup = mockRandomValues(0.5); // 20 base XP

            const premiumMember = createMockGuildMember({
                premiumSince: new Date('2023-01-01'),
            });

            // With 2x base multiplier: 20 * 1.2 * 2 = 48
            expect(ExperienceUtils.generateMessageXp(premiumMember, 2)).toBe(48);

            cleanup();
        });
    });

    describe('generateBaseVoiceXp', () => {
        it('should calculate base XP with member bonuses', () => {
            expect(ExperienceUtils.generateBaseVoiceXp(1)).toBe(5); // No bonus for single member
            expect(ExperienceUtils.generateBaseVoiceXp(2)).toBe(7); // 5 + 2 bonus
            expect(ExperienceUtils.generateBaseVoiceXp(3)).toBe(8); // 5 + 3 bonus
            expect(ExperienceUtils.generateBaseVoiceXp(5)).toBe(10); // 5 + 5 bonus (max)
            expect(ExperienceUtils.generateBaseVoiceXp(10)).toBe(10); // 5 + 5 bonus (capped at 5)
        });
    });

    describe('generateVoiceXp', () => {
        it('should calculate XP based on minutes and member count', () => {
            const regularMember = createMockGuildMember();

            // Single minute, various member counts
            expect(ExperienceUtils.generateVoiceXp(regularMember, 1, 1)).toBe(5); // No bonus
            expect(ExperienceUtils.generateVoiceXp(regularMember, 2, 1)).toBe(7); // +2 bonus
            expect(ExperienceUtils.generateVoiceXp(regularMember, 5, 1)).toBe(10); // +5 bonus (max)

            // Multiple minutes
            expect(ExperienceUtils.generateVoiceXp(regularMember, 2, 2)).toBe(14); // 7 * 2 minutes
            expect(ExperienceUtils.generateVoiceXp(regularMember, 2, 5)).toBe(35); // 7 * 5 minutes
        });

        it('should apply guild member multipliers', () => {
            const premiumMember = createMockGuildMember({
                premiumSince: new Date('2023-01-01'),
            });

            // Premium member gets 1.2x multiplier: 7 * 1.2 = 8 (rounded)
            expect(ExperienceUtils.generateVoiceXp(premiumMember, 2, 1)).toBe(8);

            // With base multiplier: 7 * 1.2 * 2 = 16.8 rounded to 17
            expect(ExperienceUtils.generateVoiceXp(premiumMember, 2, 1, 2)).toBe(17);
        });
    });

    describe('canEarnXp', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should return true if cooldown has passed', () => {
            // Mock current date/time
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-01-01T12:00:00.000Z'));

            // Last updated 2 minutes ago, cooldown is 1 minute
            const lastUpdated = '2023-01-01T11:58:00.000Z';
            expect(ExperienceUtils.canEarnXp(lastUpdated)).toBe(true);
        });

        it('should return false if within cooldown period', () => {
            // Mock current date/time
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-01-01T12:00:00.000Z'));

            // Last updated 30 seconds ago, cooldown is 1 minute
            const lastUpdated = '2023-01-01T11:59:30.000Z';
            expect(ExperienceUtils.canEarnXp(lastUpdated)).toBe(false);
        });

        it('should respect custom cooldown period', () => {
            // Mock current date/time
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-01-01T12:00:00.000Z'));

            // Last updated 3 minutes ago, cooldown is 5 minutes
            const lastUpdated = '2023-01-01T11:57:00.000Z';
            expect(ExperienceUtils.canEarnXp(lastUpdated, 5)).toBe(false);

            // Last updated 6 minutes ago, cooldown is 5 minutes
            const lastUpdated2 = '2023-01-01T11:54:00.000Z';
            expect(ExperienceUtils.canEarnXp(lastUpdated2, 5)).toBe(true);
        });

        it('should handle Date objects', () => {
            // Mock current date/time
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-01-01T12:00:00.000Z'));

            // Last updated 30 seconds ago
            const lastUpdated = new Date('2023-01-01T11:59:30.000Z');
            expect(ExperienceUtils.canEarnXp(lastUpdated)).toBe(false);

            // Last updated 2 minutes ago
            const lastUpdated2 = new Date('2023-01-01T11:58:00.000Z');
            expect(ExperienceUtils.canEarnXp(lastUpdated2)).toBe(true);
        });
    });

    describe('hasLeveledUp', () => {
        it('should return true when crossing level boundary', () => {
            // 99 XP is level 0, 100 XP is level 1
            expect(ExperienceUtils.hasLeveledUp(99, 100)).toBe(true);
        });

        it('should return false when staying in same level', () => {
            // Both 50 XP and 90 XP are level 0
            expect(ExperienceUtils.hasLeveledUp(50, 90)).toBe(false);
        });

        it('should return true when skipping multiple levels', () => {
            // 99 XP is level 0, 300 XP is level 2
            expect(ExperienceUtils.hasLeveledUp(99, 300)).toBe(true);
        });

        it('should return false when XP decreases', () => {
            expect(ExperienceUtils.hasLeveledUp(200, 100)).toBe(false);
        });
    });

    describe('getLevelProgressPercentage', () => {
        it('should return 0% at level boundary', () => {
            // Exactly level 1 (100 XP)
            expect(ExperienceUtils.getLevelProgressPercentage(100)).toBe(0);
        });

        it('should return correct percentage through level', () => {
            // Level 1 requires 155 XP
            // At 100 + 77.5 = 177.5 XP, should be 50% through level 1
            expect(ExperienceUtils.getLevelProgressPercentage(177)).toBe(49);

            // At 100 + 155 = 255 XP, should be 0% to level 3
            expect(ExperienceUtils.getLevelProgressPercentage(255)).toBe(0);
        });

        it('should not exceed 100%', () => {
            // 254 is just under level 2, should be close to 100%
            expect(ExperienceUtils.getLevelProgressPercentage(254)).toBe(99);
        });

        it('should return correct for real world example', () => {
            // 254 is just under level 2, should be close to 100%
            expect(ExperienceUtils.getLevelProgressPercentage(1035374)).toBe(88);
        });
    });

    describe('getGuildMemberNitroMultiplier', () => {
        it('should return 1.2 for premium members', () => {
            const premiumMember = createMockGuildMember({
                premiumSince: new Date('2023-01-01'),
            });
            expect(ExperienceUtils.getGuildMemberNitroMultiplier(premiumMember)).toBe(1.2);
        });

        it('should return 1.0 for non-premium members', () => {
            const regularMember = createMockGuildMember();
            expect(ExperienceUtils.getGuildMemberNitroMultiplier(regularMember)).toBe(1.0);

            const nullPremiumMember = createMockGuildMember({ premiumSince: null });
            expect(ExperienceUtils.getGuildMemberNitroMultiplier(nullPremiumMember)).toBe(1.0);
        });
    });

    describe('getVoiceXpForMultipleUsersInVoiceChannel', () => {
        it('should return 0 for less than 2 members', () => {
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(0)).toBe(0);
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(1)).toBe(0);
        });

        it('should return member count for 2-5 members', () => {
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(2)).toBe(2);
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(3)).toBe(3);
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(4)).toBe(4);
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(5)).toBe(5);
        });

        it('should cap at 5 XP for more than 5 members', () => {
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(6)).toBe(5);
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(10)).toBe(5);
            expect(ExperienceUtils.getVoiceXpForMultipleUsersInVoiceChannel(100)).toBe(5);
        });
    });

    describe('getXpMultiplierForGuildMember', () => {
        it('should combine nitro multiplier with base multiplier', () => {
            const regularMember = createMockGuildMember();
            const premiumMember = createMockGuildMember({
                premiumSince: new Date('2023-01-01'),
            });

            // Regular member with default multiplier
            expect(ExperienceUtils.getXpMultiplierForGuildMember(regularMember)).toBe(1.0);

            // Premium member with default multiplier
            expect(ExperienceUtils.getXpMultiplierForGuildMember(premiumMember)).toBe(1.2);

            // Regular member with 2x base multiplier
            expect(ExperienceUtils.getXpMultiplierForGuildMember(regularMember, 2)).toBe(2.0);

            // Premium member with 2x base multiplier: 1.2 * 2 = 2.4
            expect(ExperienceUtils.getXpMultiplierForGuildMember(premiumMember, 2)).toBe(2.4);
        });
    });
});
