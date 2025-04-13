/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/typedef */
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Client, Collection, Guild, GuildMember, Role, TextChannel } from 'discord.js';
import { vi } from 'vitest';

import { EventData, GuildData } from '../../src/database/entities/index.js';

/**
 * Creates a mock Discord client with basic functionality
 */
export function createMockClient(): Client {
    const mockGuilds = new Collection<string, Guild>();
    const mockGuild = createMockGuild('guild123', 'Test Guild');
    mockGuilds.set('guild123', mockGuild);

    return {
        guilds: {
            cache: mockGuilds,
            fetch: vi.fn().mockImplementation((id: string) => {
                if (id === 'guild123') {
                    return Promise.resolve(mockGuild);
                }
                return Promise.resolve(null);
            }),
        },
    } as unknown as Client;
}

/**
 * Creates a mock Guild with the specified ID and name
 */
export function createMockGuild(id: string, name: string): Guild {
    const mockChannel = createMockTextChannel('channel123', 'test-channel');
    const mockRoles = new Map<string, Role>();
    const mockRole1 = { id: 'role1', toString: () => '@Role1' } as unknown as Role;
    const mockRole2 = { id: 'role2', toString: () => '@Role2' } as unknown as Role;
    mockRoles.set('role1', mockRole1);
    mockRoles.set('role2', mockRole2);

    const mockMember = createMockGuildMember('user123', 'TestUser');

    return {
        id,
        name,
        iconURL: vi.fn().mockReturnValue('https://example.com/icon.png'),
        channels: {
            fetch: vi.fn().mockResolvedValue(mockChannel),
        },
        roles: {
            cache: mockRoles,
            fetch: vi.fn().mockResolvedValue(mockRoles),
        },
        members: {
            fetch: vi.fn().mockResolvedValue(mockMember),
        },
    } as unknown as Guild;
}

/**
 * Creates a mock TextChannel with the specified ID and name
 */
export function createMockTextChannel(id: string, name: string): TextChannel {
    return {
        id,
        name,
        send: vi.fn().mockResolvedValue(undefined),
    } as unknown as TextChannel;
}

/**
 * Creates a mock GuildMember with the specified ID and username
 */
export function createMockGuildMember(id: string, username: string): GuildMember {
    return {
        id,
        user: { id, username },
    } as unknown as GuildMember;
}

/**
 * Creates a mock GuildData with basic configuration
 */
export function createMockGuildData(id: string, discordId: string): GuildData {
    const mockEventDatas: EventData[] = [];

    return {
        id,
        discordId,
        eventSettings: {
            channelDiscordId: 'channel123',
        },
        generalSettings: {
            timeZone: 'UTC',
        },
        levelingSettings: {
            channelDiscordId: 'channel123',
        },
        eventDatas: {
            getItems: vi.fn().mockReturnValue(mockEventDatas),
            add: vi.fn(),
            init: vi.fn(),
        },
        levelingRewardDatas: {
            getItems: vi.fn().mockReturnValue([]),
            init: vi.fn(),
        },
    } as unknown as GuildData;
}

/**
 * Creates a mock EntityManager with basic functionality
 */
export function createMockEntityManager(): EntityManager<MongoDriver> {
    return {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(),
        persist: vi.fn(),
        persistAndFlush: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
        getReference: vi.fn(),
    } as unknown as EntityManager<MongoDriver>;
}

/**
 * Creates a mock MikroORM instance with basic functionality
 */
export function createMockOrm(entityManager?: EntityManager<MongoDriver>): MikroORM<MongoDriver> {
    const mockEm = entityManager || createMockEntityManager();

    return {
        em: {
            fork: vi.fn().mockReturnValue(mockEm),
        },
    } as unknown as MikroORM<MongoDriver>;
}

/**
 * Creates a mock EventData instance
 */
export function createMockEventData(
    guildData: any,
    eventType: any,
    startTime: string,
    endTime: string
): EventData {
    const event = new EventData(guildData, eventType, startTime, endTime);
    event.xpProperties = {
        multiplier: 2,
    };
    event.timeProperties = {
        hasAnnounced: false,
        hasStarted: false,
        hasEnded: false,
        isActive: false,
        startTime,
        endTime,
    };
    return event;
}

/**
 * Utility to reset all mocks
 */
export function resetAllMocks(): void {
    vi.clearAllMocks();
}
