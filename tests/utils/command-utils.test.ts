import { GuildChannel } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from '../../src/commands/index.js';
import { EventDataType } from '../../src/enums/index.js';
import { CommandUtils } from '../../src/utils/command-utils.js';
import {
    createMockCommand,
    createMockCommandInteraction,
    createMockGuildChannel,
} from '../helpers/test-mocks.js';

// Mock dependencies
vi.mock('../../src/utils/index.js', () => ({
    InteractionUtils: {
        send: vi.fn().mockResolvedValue({}),
    },
    FormatUtils: {
        duration: vi.fn().mockReturnValue('5 seconds'),
    },
}));

// TODO: This is a hack to get around the fact that GuildChannel is not a class in discord.js, we
// need to mock it so that instanceof checks pass.
// Mock the GuildChannel class for proper instanceof checks in tests
vi.mock('discord.js', async importOriginal => {
    const original = await importOriginal<typeof import('discord.js')>();

    // Create a proper GuildChannel constructor that allows instanceof checks
    const GuildChannelMock = function () {} as any;
    GuildChannelMock.prototype = Object.create(Object.prototype);

    return {
        ...original,
        GuildChannel: GuildChannelMock,
    };
});

describe('CommandUtils', () => {
    // Test findCommand method
    describe('findCommand', () => {
        let mockCommands: Command[];

        beforeEach(() => {
            // Create mock commands using the helper
            mockCommands = [
                createMockCommand({ names: ['test'] }),
                createMockCommand({ names: ['user', 'info'] }),
                createMockCommand({ names: ['user', 'avatar'] }),
            ] as unknown as Command[];
        });

        it('should find a command with exact match', () => {
            const result = CommandUtils.findCommand(mockCommands, ['test']);
            expect(result).toBe(mockCommands[0]);
        });

        it('should find a nested command with exact match', () => {
            const result = CommandUtils.findCommand(mockCommands, ['user', 'info']);
            expect(result).toBe(mockCommands[1]);
        });

        it('should return undefined if no match found', () => {
            const result = CommandUtils.findCommand(mockCommands, ['nonexistent']);
            expect(result).toBeUndefined();
        });
    });

    // Test runChecks method
    describe('runChecks', () => {
        let mockCommand: Command & {
            cooldown: { take: ReturnType<typeof vi.fn>; amount: number; interval: number };
            requireEventData: EventDataType[];
        };
        let mockInteraction: any;
        let mockEventData: any;

        beforeEach(() => {
            // Create a mock command with cooldown using helper
            const cmdMock = createMockCommand({
                requireClientPerms: ['ViewChannel', 'SendMessages'], // Use correct permission names
                cooldown: {
                    take: vi.fn(),
                    amount: 1,
                    interval: 5000,
                },
                requireEventData: [],
            });

            // Explicitly type the mock command to include the cooldown property
            mockCommand = cmdMock as unknown as Command & {
                cooldown: {
                    take: ReturnType<typeof vi.fn>;
                    amount: number;
                    interval: number;
                };
            };

            // Create a mock interaction using helper
            mockInteraction = createMockCommandInteraction({
                user: { id: '123456789012345678' },
                client: { user: { id: '987654321098765432' } },
                channel: createMockGuildChannel({
                    permissionsFor: vi.fn().mockReturnValue({
                        has: vi.fn().mockReturnValue(true),
                    }),
                }),
            });

            // Create mock event data
            mockEventData = { lang: 'en-US' };
        });

        it('should pass checks when all requirements are met', async () => {
            // Mock cooldown.take to return false (not limited)
            mockCommand.cooldown.take.mockReturnValue(false);

            const result = await CommandUtils.runChecks(
                mockCommand,
                mockInteraction,
                mockEventData
            );

            expect(result).toBe(true);
            expect(mockCommand.cooldown.take).toHaveBeenCalledWith('123456789012345678');
        });

        it('should fail and send message when on cooldown', async () => {
            // Mock the imported InteractionUtils.send function
            const { InteractionUtils } = await import('../../src/utils/index.js');

            // Mock cooldown.take to return true (is limited)
            mockCommand.cooldown.take.mockReturnValue(true);

            const result = await CommandUtils.runChecks(
                mockCommand,
                mockInteraction,
                mockEventData
            );

            expect(result).toBe(false);
            expect(mockCommand.cooldown.take).toHaveBeenCalledWith('123456789012345678');
            expect(InteractionUtils.send).toHaveBeenCalled();
        });

        it('should fail when missing client permissions', async () => {
            // Mock the imported InteractionUtils.send function
            const { InteractionUtils } = await import('../../src/utils/index.js');

            // Create a mock channel that will properly pass instanceof GuildChannel checks
            const mockChannel = createMockGuildChannel({
                permissionsFor: vi.fn().mockReturnValue({
                    has: vi.fn().mockReturnValue(false),
                }),
            });

            // Set prototype to GuildChannel.prototype to pass instanceof check
            Object.setPrototypeOf(mockChannel, GuildChannel.prototype);

            // Assign the channel to the interaction
            mockInteraction.channel = mockChannel;

            // Set require permissions and ensure cooldown doesn't interfere
            mockCommand.requireClientPerms = ['ViewChannel', 'SendMessages'];
            mockCommand.cooldown.take.mockReturnValue(false);

            // Run test
            const result = await CommandUtils.runChecks(
                mockCommand,
                mockInteraction,
                mockEventData
            );

            // Verify the result
            expect(result).toBe(false);
            expect(InteractionUtils.send).toHaveBeenCalled();
        });
    });
});
