/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/typedef */
import { ChannelType, Collection, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { vi } from 'vitest';

import { EventData } from '../../src/database/entities/index.js';

/**
 * Creates a mock Discord.js User that correctly passes instanceof checks
 * @param id - The user ID
 * @param username - The username
 * @param overrides - Properties to override in the mock
 * @returns Mock User
 */
export function createMockUser(id = 'user123', username = 'TestUser', overrides = {}): any {
    // Create base object with properties we need
    const baseUser = {
        id,
        username,
        discriminator: '0000',
        tag: `${username}#0000`,
        displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png'),
        bot: false,
        system: false,
        flags: { bitfield: 0 },
        createdAt: new Date(),
        createdTimestamp: Date.now(),
        // Common methods
        send: vi.fn().mockResolvedValue({}),
        fetch: vi.fn().mockImplementation(function () {
            return Promise.resolve(this);
        }),
        toString: vi.fn().mockReturnValue(`<@${id}>`),
    };

    // Add overrides
    Object.assign(baseUser, overrides);

    // Create a properly structured mock
    return {
        ...baseUser,
        constructor: { name: 'User' },
    };
}

/**
 * Creates a mock Discord.js Guild with basic functionality
 * @param id - The guild ID
 * @param name - The guild name
 * @returns Mock Guild object
 */
export function createMockGuild(id = 'guild123', name = 'Test Guild'): any {
    // Create roles map
    const roles = new Collection();
    const role1 = { id: 'role1', name: 'Role 1', toString: () => '@Role1' };
    const role2 = { id: 'role2', name: 'Role 2', toString: () => '@Role2' };
    roles.set('role1', role1);
    roles.set('role2', role2);

    return {
        id,
        name,
        createdAt: new Date('2020-01-01T00:00:00Z'),
        iconURL: vi.fn().mockReturnValue('https://example.com/icon.png'),
        channels: {
            cache: new Collection(),
            fetch: vi.fn().mockResolvedValue(null),
        },
        roles: {
            cache: roles,
            fetch: vi.fn().mockResolvedValue(roles),
        },
        members: {
            cache: new Collection(),
            fetch: vi.fn().mockResolvedValue(null),
        },
        voiceStates: {
            cache: new Collection(),
        },
        fetch: vi.fn().mockImplementation(function () {
            return Promise.resolve(this);
        }),
    };
}

/**
 * Creates a mock GuildMember with the specified properties
 * @param id - The member ID
 * @param username - The member's username
 * @param overrides - Additional properties to override
 * @returns Mock GuildMember object
 */
export function createMockGuildMember(id = 'user123', username = 'TestUser', overrides = {}): any {
    // Create a mock user first
    const mockUser = createMockUser(id, username);

    // Create base object with properties we need
    const baseMember = {
        id: mockUser.id,
        user: mockUser,
        guild: { id: 'guild123', name: 'Test Guild' },
        displayName: mockUser.username,
        nickname: null,
        roles: {
            cache: new Map(),
            highest: { position: 1, id: '222333444555666777' },
            add: vi.fn().mockResolvedValue({}),
            remove: vi.fn().mockResolvedValue({}),
        },
        permissions: new PermissionsBitField(PermissionFlagsBits.SendMessages),
        permissionsIn: vi
            .fn()
            .mockReturnValue(new PermissionsBitField(PermissionFlagsBits.SendMessages)),
        joinedAt: new Date(),
        voice: {
            channelId: null,
            channel: null,
            mute: false,
            deaf: false,
        },
        presence: {
            status: 'online',
            activities: [],
        },
        manageable: true,
        kickable: true,
        bannable: true,
        moderatable: true,
        communicationDisabledUntil: null,
        // Common methods
        kick: vi.fn().mockResolvedValue({}),
        ban: vi.fn().mockResolvedValue({}),
        timeout: vi.fn().mockResolvedValue({}),
        edit: vi.fn().mockResolvedValue({}),
        fetch: vi.fn().mockImplementation(function () {
            return Promise.resolve(this);
        }),
        send: vi.fn().mockResolvedValue({}),
    };

    // Add overrides
    Object.assign(baseMember, overrides);

    // Create a properly structured mock
    return {
        ...baseMember,
        constructor: { name: 'GuildMember' },
    };
}

/**
 * Creates a mock TextChannel with basic functionality
 * @param id - The channel ID
 * @param name - The channel name
 * @returns Mock TextChannel object
 */
export function createMockTextChannel(id = 'channel123', name = 'test-channel'): any {
    return {
        id,
        name,
        type: ChannelType.GuildText,
        guild: { id: 'guild123', name: 'Test Guild' },
        send: vi.fn().mockResolvedValue({}),
        permissionsFor: vi.fn().mockReturnValue({
            has: vi.fn().mockReturnValue(true),
        }),
        constructor: { name: 'TextChannel' },
    };
}

/**
 * Creates a mock Discord.js GuildChannel that correctly passes instanceof checks
 * @param overrides - Properties to override in the mock
 * @returns Mock GuildChannel
 */
export function createMockGuildChannel(overrides = {}): any {
    // Create base object with properties we need
    const baseChannel = {
        id: '444555666777888999',
        name: 'test-channel',
        guild: { id: 'guild123', name: 'Test Guild' },
        client: {
            user: { id: '987654321098765432' },
        },
        type: ChannelType.GuildText,
        permissionsFor: vi.fn().mockReturnValue({
            has: vi.fn().mockReturnValue(true),
        }),
    };

    // Add overrides
    Object.assign(baseChannel, overrides);

    // Create a properly structured mock
    return {
        ...baseChannel,
        constructor: { name: 'GuildChannel' },
    };
}

/**
 * Creates a mock Discord.js ThreadChannel
 * @param overrides - Properties to override in the mock
 * @returns Mock ThreadChannel
 */
export function createMockThreadChannel(overrides = {}): any {
    // Create base object with properties we need
    const baseChannel = {
        id: '444555666777888999',
        name: 'test-thread',
        guild: { id: 'guild123', name: 'Test Guild' },
        client: {
            user: { id: '987654321098765432' },
        },
        type: ChannelType.PublicThread,
        permissionsFor: vi.fn().mockReturnValue({
            has: vi.fn().mockReturnValue(true),
        }),
    };

    // Add overrides
    Object.assign(baseChannel, overrides);

    // Create a properly structured mock
    return {
        ...baseChannel,
        constructor: { name: 'ThreadChannel' },
    };
}

/**
 * Creates a mock Command object
 * @param overrides - Properties to override in the mock
 * @returns Mock Command object
 */
export function createMockCommand(overrides = {}): any {
    return {
        names: ['test'],
        deferType: 'HIDDEN',
        requireClientPerms: [],
        execute: vi.fn().mockResolvedValue({}),
        cooldown: {
            take: vi.fn().mockReturnValue(false),
            amount: 1,
            interval: 5000,
        },
        ...overrides,
    };
}

/**
 * Creates a mock CommandInteraction
 * @param overrides - Properties to override in the mock
 * @returns Mock CommandInteraction object
 */
export function createMockCommandInteraction(overrides = {}): any {
    // Create a mock guild member first to ensure consistent user data
    const mockMember = createMockGuildMember();

    return {
        id: '987612345678901234',
        user: mockMember.user,
        member: mockMember,
        client: {
            user: {
                id: '987654321098765432',
                username: 'TestBot',
            },
        },
        guild: mockMember.guild,
        channel: createMockGuildChannel(),
        commandName: 'test',
        options: {
            getString: vi.fn(),
            getUser: vi.fn(),
            getInteger: vi.fn(),
            getBoolean: vi.fn(),
            getSubcommand: vi.fn(),
            getSubcommandGroup: vi.fn(),
        },
        reply: vi.fn().mockResolvedValue({}),
        editReply: vi.fn().mockResolvedValue({}),
        deferReply: vi.fn().mockResolvedValue({}),
        followUp: vi.fn().mockResolvedValue({}),
        deferred: false,
        replied: false,
        ...overrides,
    };
}

/**
 * Creates a mock Discord client with basic functionality
 */
export function createMockClient(): any {
    const mockGuilds = new Collection();
    const mockGuild = createMockGuild('guild123', 'Test Guild');
    mockGuilds.set('guild123', mockGuild);

    return {
        guilds: {
            cache: mockGuilds,
            fetch: vi.fn().mockImplementation(id => {
                if (id === 'guild123') {
                    return Promise.resolve(mockGuild);
                }
                return Promise.resolve(null);
            }),
        },
    };
}

/**
 * Creates a mock EntityManager with basic functionality
 */
export function createMockEntityManager(): any {
    return {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(),
        persist: vi.fn(),
        persistAndFlush: vi.fn().mockResolvedValue(undefined),
        flush: vi.fn().mockResolvedValue(undefined),
        getReference: vi.fn(),
    };
}

/**
 * Creates a mock MikroORM instance with basic functionality
 */
export function createMockOrm(entityManager?: any): any {
    const mockEm = entityManager || createMockEntityManager();

    return {
        em: {
            fork: vi.fn().mockReturnValue(mockEm),
        },
    };
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
 * Creates a mock GuildData with basic functionality
 */
export function createMockGuildData(id: string, discordId: string): any {
    const mockEventDatas: any[] = [];

    return {
        id,
        discordId,
        eventSettings: {
            channelDiscordId: 'channel123',
        },
        generalSettings: {
            timeZone: 'UTC',
        },
        eventDatas: {
            getItems: vi.fn().mockReturnValue(mockEventDatas),
            add: vi.fn(),
            init: vi.fn(),
        },
        userDatas: {
            add: vi.fn(),
        },
    };
}

/**
 * Utility to reset all mocks
 */
export function resetAllMocks(): void {
    vi.clearAllMocks();
}
