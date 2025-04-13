import { afterEach, describe, expect, it, vi } from 'vitest';

import { RandomUtils } from '../../src/utils/index.js';
import { mockRandomValues } from '../helpers/test-utils.js';

// Mock any configs that might be loaded
vi.mock('../../config/config.json', () => ({}));
vi.mock('../../config/debug.json', () => ({}));
vi.mock('../../lang/logs.json', () => ({}));

describe('RandomUtils', () => {
    // After each test, restore all mocks
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('intFromInterval', () => {
        it('should return a number within the specified range', () => {
            // Test with a range of values
            for (let i = 0; i < 100; i++) {
                const min = 5;
                const max = 10;
                const result = RandomUtils.intFromInterval(min, max);

                expect(result).toBeGreaterThanOrEqual(min);
                expect(result).toBeLessThanOrEqual(max);
                expect(Number.isInteger(result)).toBe(true);
            }
        });

        it('should use Math.random correctly', () => {
            // Use our shared mock utility to set Math.random to 0.5
            const cleanup = mockRandomValues(0.5);

            const result = RandomUtils.intFromInterval(1, 10);

            // With Math.random() = 0.5, we expect it to return the middle value
            // 1 + Math.floor(0.5 * (10 - 1 + 1)) = 1 + Math.floor(5) = 1 + 5 = 6
            expect(result).toBe(6);

            // Clean up the mock
            cleanup();
        });

        it('should handle min equal to max', () => {
            const result = RandomUtils.intFromInterval(5, 5);
            expect(result).toBe(5);
        });

        it('should handle negative ranges', () => {
            // Use our shared mock utility
            const cleanup = mockRandomValues(0.5);

            const result = RandomUtils.intFromInterval(-10, -5);

            // With Math.random() = 0.5, and range of -10 to -5 (6 numbers)
            // -10 + Math.floor(0.5 * (-5 - -10 + 1)) = -10 + Math.floor(0.5 * 6) = -10 + 3 = -7
            expect(result).toBe(-7);

            // Clean up the mock
            cleanup();
        });
    });

    describe('shuffle', () => {
        it('should maintain the same elements after shuffling', () => {
            const original = [1, 2, 3, 4, 5];
            const shuffled = RandomUtils.shuffle([...original]);

            // Check that no elements were added or removed
            expect(shuffled.length).toBe(original.length);
            original.forEach(item => {
                expect(shuffled).toContain(item);
            });
        });

        it('should shuffle elements based on Math.random', () => {
            // Use our shared mock utility with predictable sequence of random values
            const cleanup = mockRandomValues(0.5, 0.1, 0.9, 0.3);

            const original = [1, 2, 3, 4];
            const shuffled = RandomUtils.shuffle([...original]);

            // With our mocked random sequence, we can predict the shuffle outcome
            expect(shuffled).not.toEqual(original);

            // Clean up the mock
            cleanup();
        });

        it('should handle empty arrays', () => {
            const result = RandomUtils.shuffle([]);
            expect(result).toEqual([]);
        });

        it('should handle single-element arrays', () => {
            const result = RandomUtils.shuffle([1]);
            expect(result).toEqual([1]);
        });

        it('should return the input array reference', () => {
            const input = [1, 2, 3];
            const result = RandomUtils.shuffle(input);
            expect(result).toBe(input); // Same reference
        });
    });

    describe('friendlyId', () => {
        it('should generate a string of the specified length', () => {
            const size = 10;
            const id = RandomUtils.friendlyId(size);
            expect(id.length).toBe(size);
        });

        it('should only contain lowercase letters and numbers', () => {
            const id = RandomUtils.friendlyId(20);
            expect(id).toMatch(/^[a-z0-9]+$/);
        });

        it('should generate different IDs on subsequent calls', () => {
            const id1 = RandomUtils.friendlyId(15);
            const id2 = RandomUtils.friendlyId(15);
            expect(id1).not.toBe(id2);
        });
    });
});
