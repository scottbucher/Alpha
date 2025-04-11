import { ApplicationCommand, Client, Guild, Locale } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';

import { ClientUtils } from '../../src/utils/client-utils.js';
import { FormatUtils } from '../../src/utils/index.js';

describe('FormatUtils', () => {
    describe('roleMention', () => {
        it('should return @here for @here mentions', () => {
            const mockGuild = { id: '123456789012345678' } as Guild;
            const result = FormatUtils.roleMention(mockGuild, '@here');
            expect(result).toBe('@here');
        });

        it('should return @everyone for guild id mentions', () => {
            const mockGuild = { id: '123456789012345678' } as Guild;
            const result = FormatUtils.roleMention(mockGuild, '123456789012345678');
            expect(result).toBe('@everyone');
        });

        it('should format regular role mentions', () => {
            const mockGuild = { id: '123456789012345678' } as Guild;
            const result = FormatUtils.roleMention(mockGuild, '987654321098765432');
            expect(result).toBe('<@&987654321098765432>');
        });
    });

    describe('channelMention', () => {
        it('should format channel mentions', () => {
            const result = FormatUtils.channelMention('123456789012345678');
            expect(result).toBe('<#123456789012345678>');
        });
    });

    describe('userMention', () => {
        it('should format user mentions', () => {
            const result = FormatUtils.userMention('123456789012345678');
            expect(result).toBe('<@!123456789012345678>');
        });
    });

    describe('commandMention', () => {
        it('should format simple command mentions', async () => {
            const mockClient = {
                application: {
                    commands: {
                        fetch: vi.fn().mockResolvedValue([
                            {
                                name: 'test',
                                id: '123456789012345678',
                            },
                        ]),
                    },
                },
            } as unknown as Client;

            // Mock ClientUtils.findAppCommand implementation
            vi.spyOn(ClientUtils, 'findAppCommand').mockResolvedValue({
                name: 'test',
                id: '123456789012345678',
            } as ApplicationCommand);

            const result = await FormatUtils.commandMention(mockClient, 'test');
            expect(result).toBe('</test:123456789012345678>');
        });

        it('should format command mentions with subcommands', async () => {
            const mockClient = {
                application: {
                    commands: {
                        fetch: vi.fn().mockResolvedValue([
                            {
                                name: 'user',
                                id: '123456789012345678',
                            },
                        ]),
                    },
                },
            } as unknown as Client;

            // Mock ClientUtils.findAppCommand implementation
            vi.spyOn(ClientUtils, 'findAppCommand').mockResolvedValue({
                name: 'edit',
                id: '123456789012345678',
            } as ApplicationCommand);

            const result = await FormatUtils.commandMention(mockClient, 'edit', ['channel']);
            expect(result).toBe('</edit channel:123456789012345678>');
        });
    });

    describe('duration', () => {
        it('should format hours correctly', () => {
            const result = FormatUtils.duration(3600000, Locale.EnglishUS);
            expect(result).toBe('1 hour');
        });

        it('should format minutes correctly', () => {
            const result = FormatUtils.duration(60000, Locale.EnglishUS);
            expect(result).toBe('1 minute');
        });

        it('should format seconds correctly', () => {
            const result = FormatUtils.duration(5000, Locale.EnglishUS);
            expect(result).toBe('5 seconds');
        });
    });

    describe('fileSize', () => {
        it('should format bytes to KB correctly', () => {
            const result = FormatUtils.fileSize(1024);
            expect(result).toBe('1.02 kB');
        });

        it('should format bytes to MB correctly', () => {
            const result = FormatUtils.fileSize(1048576);
            expect(result).toBe('1.05 MB');
        });

        it('should handle small byte values', () => {
            const result = FormatUtils.fileSize(100);
            expect(result).toBe('100.00 B');
        });
    });
});
