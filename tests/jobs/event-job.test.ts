/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/typedef */
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Client, Collection, Guild, TextChannel } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventData, GuildData } from '../../src/database/entities/index.js';
import { EventType } from '../../src/enums/index.js';
import { EventJob } from '../../src/jobs/event-job.js';
import { Logger } from '../../src/services/index.js';
import { ClientUtils, ExperienceUtils } from '../../src/utils/index.js';

// Mock utilities
vi.mock('../../src/utils/index.js', async () => {
    const actual = await vi.importActual('../../src/utils/index.js');
    return {
        ...actual,
        ClientUtils: {
            getConfiguredTextChannelIfExists: vi.fn().mockResolvedValue(undefined),
        },
    };
});

describe('EventJob', () => {
    let eventJob: EventJob;
    let mockClient: Client;
    let mockOrm: MikroORM<MongoDriver>;
    let mockEntityManager: EntityManager<MongoDriver>;
    let mockGuild: Guild;
    let mockGuildData: GuildData;
    let mockEventDatas: EventData[];
    let mockChannel: TextChannel;

    beforeEach(() => {
        // === Setup Discord Client Mock ===
        const mockGuilds = new Collection<string, Guild>();
        mockGuild = {
            id: 'guild123',
            name: 'Test Guild',
            iconURL: vi.fn().mockReturnValue('https://example.com/icon.png'),
        } as unknown as Guild;
        mockGuilds.set('guild123', mockGuild);

        mockClient = {
            guilds: {
                cache: mockGuilds,
                fetch: vi.fn().mockImplementation((id: string) => {
                    if (id === 'guild123') {
                        return Promise.resolve(mockGuild);
                    }
                }),
            },
        } as unknown as Client;

        // === Setup Text Channel Mock ===
        mockChannel = {
            send: vi.fn().mockResolvedValue(undefined),
        } as unknown as TextChannel;

        // === Setup Database Mocks ===
        // Guild data mock
        mockGuildData = {
            id: 'guilddata123',
            discordId: 'guild123',
            eventSettings: {
                channelDiscordId: 'channel123',
            },
            eventDatas: {
                getItems: vi.fn().mockReturnValue(mockEventDatas || []),
                add: vi.fn(),
                init: vi.fn(),
            },
        } as unknown as GuildData;

        // Event data mock
        mockEventDatas = [];

        // === Setup Entity Manager Mock ===
        mockEntityManager = {
            find: vi.fn().mockResolvedValue([mockGuildData]),
            findOne: vi.fn(),
            persist: vi.fn(),
            flush: vi.fn().mockResolvedValue(undefined),
            getReference: vi.fn().mockImplementation((entity, id) => {
                if (entity === GuildData && id === 'guilddata123') {
                    return { id: 'guilddata123' };
                }
                return null;
            }),
        } as unknown as EntityManager<MongoDriver>;

        // === Setup ORM Mock ===
        mockOrm = {
            em: {
                fork: vi.fn().mockReturnValue(mockEntityManager),
            },
        } as unknown as MikroORM<MongoDriver>;

        // === Create Job Instance ===
        eventJob = new EventJob(mockClient, mockOrm);

        // Reset all mocks before each test

        // Reset all mocks
        vi.clearAllMocks();

        // Setup ClientUtils mock to return the leveling channel
        vi.mocked(ClientUtils.getConfiguredTextChannelIfExists).mockResolvedValue(mockChannel);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should announce an upcoming XP event', async () => {
        // Setup event that should be announced
        const now = new Date();
        const startTime = new Date(now);
        startTime.setDate(startTime.getDate() + 14); // 2 weeks from now
        const endTime = new Date(startTime);
        endTime.setDate(endTime.getDate() + 2); // 2 days duration

        const event = new EventData(
            { id: 'guilddata123' } as any,
            EventType.INCREASED_XP_WEEKEND,
            startTime.toISOString(),
            endTime.toISOString()
        );
        event.xpProperties.multiplier = 2;
        event.timeProperties.hasAnnounced = false;
        event.timeProperties.hasStarted = false;
        event.timeProperties.hasEnded = false;
        event.timeProperties.isActive = false;

        mockEventDatas = [event];
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue(mockEventDatas);

        await eventJob.run();

        // Verify event was marked as announced
        expect(event.timeProperties.hasAnnounced).toBe(true);
        expect(mockEntityManager.flush).toHaveBeenCalled();
    });

    it('should start an XP event when the time comes', async () => {
        // Setup event that should start
        const now = new Date();
        const startTime = new Date(now);
        startTime.setHours(startTime.getHours() - 1); // Started 1 hour ago
        const endTime = new Date(startTime);
        endTime.setDate(endTime.getDate() + 2); // 2 days duration

        const event = new EventData(
            { id: 'guilddata123' } as any,
            EventType.INCREASED_XP_WEEKEND,
            startTime.toISOString(),
            endTime.toISOString()
        );
        event.xpProperties.multiplier = 2;
        event.timeProperties.hasAnnounced = true;
        event.timeProperties.hasStarted = false;
        event.timeProperties.hasEnded = false;
        event.timeProperties.isActive = false;

        mockEventDatas = [event];
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue(mockEventDatas);

        await eventJob.run();

        // Verify event was marked as started and active
        expect(event.timeProperties.hasStarted).toBe(true);
        expect(event.timeProperties.isActive).toBe(true);
        expect(mockEntityManager.flush).toHaveBeenCalled();
    });

    it('should end an XP event when the time comes', async () => {
        // Setup event that should end
        const now = new Date();
        const startTime = new Date(now);
        startTime.setDate(startTime.getDate() - 3); // Started 3 days ago
        const endTime = new Date(now);
        endTime.setHours(endTime.getHours() - 1); // Ended 1 hour ago

        const event = new EventData(
            { id: 'guilddata123' } as any,
            EventType.INCREASED_XP_WEEKEND,
            startTime.toISOString(),
            endTime.toISOString()
        );
        event.xpProperties.multiplier = 2;
        event.timeProperties.hasAnnounced = true;
        event.timeProperties.hasStarted = true;
        event.timeProperties.hasEnded = false;
        event.timeProperties.isActive = true;

        mockEventDatas = [event];
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue(mockEventDatas);

        await eventJob.run();

        // Verify event was marked as ended and inactive
        expect(event.timeProperties.hasEnded).toBe(true);
        expect(event.timeProperties.isActive).toBe(false);
        expect(mockEntityManager.flush).toHaveBeenCalled();
    });

    it('should update multiplier cache when events change', async () => {
        // Setup active event with multiplier
        const now = new Date();
        const startTime = new Date(now);
        startTime.setHours(startTime.getHours() - 1); // Started 1 hour ago
        const endTime = new Date(startTime);
        endTime.setDate(endTime.getDate() + 2); // 2 days duration

        const event = new EventData(
            { id: 'guilddata123' } as any,
            EventType.INCREASED_XP_WEEKEND,
            startTime.toISOString(),
            endTime.toISOString()
        );
        event.xpProperties.multiplier = 3;
        event.timeProperties.hasAnnounced = true;
        event.timeProperties.hasStarted = false; // Will be started by the job
        event.timeProperties.hasEnded = false;
        event.timeProperties.isActive = false;

        mockEventDatas = [event];
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue(mockEventDatas);

        // Spy on ExperienceUtils
        const setMultiplierSpy = vi.spyOn(ExperienceUtils, 'setMultiplierCache');

        await eventJob.run();

        // Verify multiplier cache was updated
        expect(setMultiplierSpy).toHaveBeenCalledWith('guild123', 3);
    });

    it('should handle missing guild gracefully', async () => {
        // Setup event data
        mockEventDatas = [
            new EventData(
                { id: 'guilddata123' } as any,
                EventType.INCREASED_XP_WEEKEND,
                new Date().toISOString(),
                new Date().toISOString()
            ),
        ];
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue(mockEventDatas);

        // Mock guild fetch to return empty collection
        vi.spyOn(mockClient.guilds, 'fetch').mockImplementation(
            () => Promise.resolve(new Collection()) as any
        );

        // Spy on Logger
        const loggerSpy = vi.spyOn(Logger, 'error');

        await eventJob.run();

        // Verify error was logged
        expect(loggerSpy).toHaveBeenCalled();
    });

    it('should handle invalid event times gracefully', async () => {
        // Setup event with invalid times
        const event = new EventData(
            { id: 'guilddata123' } as any,
            EventType.INCREASED_XP_WEEKEND,
            'invalid-date',
            'invalid-date'
        );
        mockEventDatas = [event];
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue(mockEventDatas);

        // Spy on Logger
        const loggerSpy = vi.spyOn(Logger, 'error');

        await eventJob.run();

        // Verify error was logged
        expect(loggerSpy).toHaveBeenCalled();
    });

    it('should handle multiple active events and use highest multiplier', async () => {
        // Setup multiple active events with different multipliers
        const now = new Date();
        const startTime = new Date(now);
        startTime.setHours(startTime.getHours() - 1); // Started 1 hour ago
        const endTime = new Date(startTime);
        endTime.setDate(endTime.getDate() + 2); // 2 days duration

        const event1 = new EventData(
            { id: 'guilddata123' } as any,
            EventType.INCREASED_XP_WEEKEND,
            startTime.toISOString(),
            endTime.toISOString()
        );
        event1.xpProperties.multiplier = 2;
        event1.timeProperties.hasStarted = true;
        event1.timeProperties.isActive = true;

        const event2 = new EventData(
            { id: 'guilddata123' } as any,
            EventType.INCREASED_XP_WEEKEND,
            startTime.toISOString(),
            endTime.toISOString()
        );
        event2.xpProperties.multiplier = 4;
        event2.timeProperties.hasStarted = false; // Will be started by the job
        event2.timeProperties.isActive = false;

        mockEventDatas = [event1, event2];
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue(mockEventDatas);

        // Spy on ExperienceUtils
        const setMultiplierSpy = vi.spyOn(ExperienceUtils, 'setMultiplierCache');

        await eventJob.run();

        // Verify highest multiplier was used
        expect(setMultiplierSpy).toHaveBeenCalledWith('guild123', 4);
    });
});
