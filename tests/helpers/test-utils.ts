import { vi } from 'vitest';

import { createMockEventData } from './test-mocks.js';
import { EventType } from '../../src/enums/index.js';

/**
 * Creates a date that is a specified time relative to now
 * @param days Days to add (or subtract with negative values)
 * @param hours Hours to add (or subtract with negative values)
 * @param minutes Minutes to add (or subtract with negative values)
 * @returns Date object
 */
export function createRelativeDate(days: number = 0, hours: number = 0, minutes: number = 0): Date {
    const now = new Date();
    const result = new Date(now);

    if (days !== 0) {
        result.setDate(result.getDate() + days);
    }

    if (hours !== 0) {
        result.setHours(result.getHours() + hours);
    }

    if (minutes !== 0) {
        result.setMinutes(result.getMinutes() + minutes);
    }

    return result;
}

/**
 * Creates an XP event that is about to start (started recently or will start soon)
 * @param guildData
 * @param hoursOffset How many hours in the past/future the event starts
 * @param durationDays How many days the event lasts
 * @returns EventData object
 */
export function createUpcomingXpEvent(
    guildData: any,
    hoursOffset: number = -1,
    durationDays: number = 2
): any {
    const startTime = createRelativeDate(0, hoursOffset);
    const endTime = new Date(startTime);
    endTime.setDate(endTime.getDate() + durationDays);

    return createMockEventData(
        guildData,
        EventType.INCREASED_XP_WEEKEND,
        startTime.toISOString(),
        endTime.toISOString()
    );
}

/**
 * Mocks Math.random to return specific values in sequence
 * Useful for testing random number generation
 * @param values The values to return in sequence
 */
export function mockRandomValues(...values: number[]): () => void {
    let index = 0;
    const originalRandom = Math.random;

    Math.random = vi.fn().mockImplementation(() => {
        const result = values[index % values.length];
        index++;
        return result;
    });

    // Return a cleanup function
    return () => {
        Math.random = originalRandom;
    };
}

export function assertNonNull<T>(value: T | null | undefined): asserts value is T {
    if (!value) {
        throw new Error('Value should be defined');
    }
}
