import { describe, it, expect, vi } from 'vitest';
import { RegexUtils } from '../../src/utils/index.js';

describe('RegexUtils', () => {
    describe('discordId', () => {
        it('should extract a valid Discord ID', () => {
            const input = 'User ID: 123456789012345678';
            const result = RegexUtils.discordId(input);
            expect(result).toBe('123456789012345678');
        });

        it('should return undefined for invalid Discord ID', () => {
            const input = 'User ID: 12345';
            const result = RegexUtils.discordId(input);
            expect(result).toBeUndefined();
        });
    });
});
