import { NewsChannel, TextChannel, VoiceChannel } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientUtils, PermissionUtils } from '../../src/utils/index.js';
import { createMockGuild } from '../helpers/test-mocks.js';

describe('ClientUtils', () => {
    describe('getConfiguredTextChannelIfExists', () => {
        let mockGuild: any;
        let canSendSpy: any;

        // Create channels from the real prototypes so instanceof checks pass
        function createChannel(channelClass: { prototype: object }, id: string): any {
            return Object.assign(Object.create(channelClass.prototype), { id });
        }

        beforeEach(() => {
            mockGuild = createMockGuild('guild123', 'Test Guild');
            canSendSpy = vi.spyOn(PermissionUtils, 'canSend').mockReturnValue(true);
        });

        afterEach(() => {
            canSendSpy.mockRestore();
        });

        it('should return a configured text channel the bot can send to', async () => {
            const channel = createChannel(TextChannel, 'textChannel');
            mockGuild.channels.fetch = vi.fn().mockResolvedValue(channel);

            const result = await ClientUtils.getConfiguredTextChannelIfExists(
                mockGuild,
                'textChannel'
            );

            expect(result).toBe(channel);
            expect(mockGuild.channels.fetch).toHaveBeenCalledWith('textChannel');
            expect(canSendSpy).toHaveBeenCalledWith(channel, true);
        });

        it('should return a configured news channel the bot can send to', async () => {
            const channel = createChannel(NewsChannel, 'newsChannel');
            mockGuild.channels.fetch = vi.fn().mockResolvedValue(channel);

            const result = await ClientUtils.getConfiguredTextChannelIfExists(
                mockGuild,
                'newsChannel'
            );

            expect(result).toBe(channel);
            expect(canSendSpy).toHaveBeenCalledWith(channel, true);
        });

        it('should return null when the bot cannot send to the channel', async () => {
            canSendSpy.mockReturnValue(false);
            mockGuild.channels.fetch = vi
                .fn()
                .mockResolvedValue(createChannel(NewsChannel, 'newsChannel'));

            const result = await ClientUtils.getConfiguredTextChannelIfExists(
                mockGuild,
                'newsChannel'
            );

            expect(result).toBeNull();
        });

        it('should return null for channels that are not text or news channels', async () => {
            mockGuild.channels.fetch = vi
                .fn()
                .mockResolvedValue(createChannel(VoiceChannel, 'voiceChannel'));

            const result = await ClientUtils.getConfiguredTextChannelIfExists(
                mockGuild,
                'voiceChannel'
            );

            expect(result).toBeNull();
            expect(canSendSpy).not.toHaveBeenCalled();
        });

        it('should return null without fetching when no channel is configured', async () => {
            mockGuild.channels.fetch = vi.fn();

            const result = await ClientUtils.getConfiguredTextChannelIfExists(mockGuild);

            expect(result).toBeNull();
            expect(mockGuild.channels.fetch).not.toHaveBeenCalled();
        });
    });
});
