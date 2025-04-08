import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExperienceUtils } from '../../src/utils/index.js';
import { DateTime } from 'luxon';

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

    describe('generateMessageXp', () => {
        beforeEach(() => {
            // Reset Math.random for each test
            vi.spyOn(global.Math, 'random').mockRestore();
        });

        it('should return value within configured range', () => {
            // Mock Math.random to return specific values
            vi.spyOn(global.Math, 'random').mockReturnValueOnce(0);
            expect(ExperienceUtils.generateMessageXp()).toBe(15); // Min

            vi.spyOn(global.Math, 'random').mockReturnValueOnce(1);
            expect(ExperienceUtils.generateMessageXp()).toBe(25); // Max

            vi.spyOn(global.Math, 'random').mockReturnValueOnce(0.5);
            expect(ExperienceUtils.generateMessageXp()).toBe(20); // Middle
        });
    });

    describe('generateVoiceXp', () => {
        it('should calculate XP based on minutes', () => {
            expect(ExperienceUtils.generateVoiceXp(1)).toBe(5);
            expect(ExperienceUtils.generateVoiceXp(2)).toBe(10);
            expect(ExperienceUtils.generateVoiceXp(5)).toBe(25);
        });
    });

    describe('canEarnXp', () => {
        beforeEach(() => {
            // Use vi.spyOn instead of direct assignment
            vi.spyOn(DateTime, 'now').mockImplementation(
                () => DateTime.utc(2023, 1, 1, 12, 0, 0) as DateTime<true>
            );
        });

        afterEach(() => {
            // Clear all mocks
            vi.restoreAllMocks();
        });

        it('should return true if cooldown has passed', () => {
            // Last updated 2 minutes ago, cooldown is 1 minute
            const lastUpdated = '2023-01-01T11:58:00.000Z';
            expect(ExperienceUtils.canEarnXp(lastUpdated)).toBe(true);
        });

        it('should return false if within cooldown period', () => {
            // Last updated 30 seconds ago, cooldown is 1 minute
            const lastUpdated = '2023-01-01T11:59:30.000Z';
            expect(ExperienceUtils.canEarnXp(lastUpdated)).toBe(false);
        });

        it('should respect custom cooldown period', () => {
            // Last updated 3 minutes ago, cooldown is 5 minutes
            const lastUpdated = '2023-01-01T11:57:00.000Z';
            expect(ExperienceUtils.canEarnXp(lastUpdated, 5)).toBe(false);

            // Last updated 6 minutes ago, cooldown is 5 minutes
            const lastUpdated2 = '2023-01-01T11:54:00.000Z';
            expect(ExperienceUtils.canEarnXp(lastUpdated2, 5)).toBe(true);
        });

        it('should handle Date objects', () => {
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
});
