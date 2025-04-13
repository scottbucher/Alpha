/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/typedef */
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Client, Collection, Guild } from 'discord.js';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventData, GuildData } from '../../src/database/entities/index.js';
import { EventType } from '../../src/enums/index.js';
import { GenerateXpEventsJob } from '../../src/jobs/generate-xp-events-job.js';
import { Logger } from '../../src/services/index.js';

describe('GenerateXpEventsJob', () => {
    let generateXpEventsJob: GenerateXpEventsJob;
    let mockClient: Client;
    let mockOrm: MikroORM<MongoDriver>;
    let mockEntityManager: EntityManager<MongoDriver>;
    let mockGuild: Guild;
    let mockGuildData: GuildData;
    let mockEventDatas: EventData[];

    beforeEach(() => {
        // === Setup Discord Client Mock ===
        const mockGuilds = new Collection<string, Guild>();
        mockGuild = {
            id: 'guild123',
            name: 'Test Guild',
        } as unknown as Guild;
        mockGuilds.set('guild123', mockGuild);

        mockClient = {
            guilds: {
                cache: mockGuilds,
            },
        } as unknown as Client;

        // === Setup Database Mocks ===
        // Guild data mock
        mockGuildData = {
            id: 'guilddata123',
            discordId: 'guild123',
            generalSettings: {
                timeZone: 'UTC',
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
        generateXpEventsJob = new GenerateXpEventsJob(mockClient, mockOrm);

        // Reset all mocks before each test
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should generate XP events for guilds with no existing events', async () => {
        // Setup empty event datas
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue([]);

        // Mock Math.random to always return a value less than 0.15 (to trigger event creation)
        const originalRandom = Math.random;
        Math.random = vi.fn().mockReturnValue(0.1);

        await generateXpEventsJob.run();

        // Verify guild was fetched
        expect(mockEntityManager.find).toHaveBeenCalledWith(
            GuildData,
            { discordId: { $in: ['guild123'] } },
            { populate: ['eventDatas'] }
        );

        // Verify events were created
        expect(mockEntityManager.persist).toHaveBeenCalledTimes(4); // 4 weekends

        // Verify database was flushed
        expect(mockEntityManager.flush).toHaveBeenCalled();

        // Restore Math.random
        Math.random = originalRandom;
    });

    it('should not generate events for weekends that already have events', async () => {
        // Setup existing events for all weekends
        const now = DateTime.now().setZone('UTC');
        const weekends = generateXpEventsJob['getNextWeekends'](now, 4);

        mockEventDatas = weekends.map(weekend => {
            const event = new EventData(
                { id: 'guilddata123' } as any,
                EventType.NO_INCREASED_XP_WEEKEND,
                weekend.start.toISO() ?? '',
                weekend.end.toISO() ?? ''
            );
            event.autoGenerated = true;
            return event;
        });

        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue(mockEventDatas);

        // Mock Math.random to always return a value less than 0.15 (to trigger event creation)
        const originalRandom = Math.random;
        Math.random = vi.fn().mockReturnValue(0.1);

        await generateXpEventsJob.run();

        // Verify guild was fetched
        expect(mockEntityManager.find).toHaveBeenCalledWith(
            GuildData,
            { discordId: { $in: ['guild123'] } },
            { populate: ['eventDatas'] }
        );

        // Verify no new events were created
        expect(mockEntityManager.persist).not.toHaveBeenCalled();

        // Verify database was flushed
        expect(mockEntityManager.flush).toHaveBeenCalled();

        // Restore Math.random
        Math.random = originalRandom;
    });

    it('should generate events with correct multipliers based on probability', async () => {
        // Setup empty event datas
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue([]);

        // Mock Math.random to return values that trigger different multipliers
        const originalRandom = Math.random;
        // First value (0.1) is for the event creation check (Math.random() < 0.15)
        // Second value (0.5) is for the multiplier determination (0.5 < 0.85 for 2x)
        // Third value (0.1) is for the event creation check
        // Fourth value (0.9) is for the multiplier determination (0.9 < 0.95 for 3x)
        // Fifth value (0.1) is for the event creation check
        // Sixth value (0.98) is for the multiplier determination (0.98 >= 0.95 for 4x)
        const randomValues = [0.1, 0.5, 0.1, 0.9, 0.1, 0.98];
        let randomIndex = 0;
        Math.random = vi.fn().mockImplementation(() => {
            return randomValues[randomIndex++ % randomValues.length];
        });

        await generateXpEventsJob.run();

        // Verify events were created with correct multipliers
        const persistCalls = vi.mocked(mockEntityManager.persist).mock.calls;

        // Check that at least one event was created with each multiplier
        const createdEvents = persistCalls.map(call => call[0] as EventData);
        const multipliers = createdEvents
            .filter(event => event.eventType === EventType.INCREASED_XP_WEEKEND)
            .map(event => event.xpProperties.multiplier);

        expect(multipliers).toContain(2);
        expect(multipliers).toContain(3);
        expect(multipliers).toContain(4);

        // Restore Math.random
        Math.random = originalRandom;
    });

    it('should handle errors gracefully', async () => {
        // Setup error in entity manager
        mockEntityManager.find = vi.fn().mockRejectedValue(new Error('Database error'));

        // Spy on Logger.error
        const loggerSpy = vi.spyOn(Logger, 'error');

        await generateXpEventsJob.run();

        // Verify error was logged
        expect(loggerSpy).toHaveBeenCalled();
    });

    it('should generate NO_INCREASED_XP_WEEKEND events when random value is >= 0.15', async () => {
        // Setup empty event datas
        mockGuildData.eventDatas.getItems = vi.fn().mockReturnValue([]);

        // Mock Math.random to always return a value >= 0.15 (to not trigger XP event)
        const originalRandom = Math.random;
        Math.random = vi.fn().mockReturnValue(0.2);

        await generateXpEventsJob.run();

        // Verify events were created
        expect(mockEntityManager.persist).toHaveBeenCalledTimes(4); // 4 weekends

        // Verify all created events are NO_INCREASED_XP_WEEKEND
        const persistCalls = vi.mocked(mockEntityManager.persist).mock.calls;
        const createdEvents = persistCalls.map(call => call[0] as EventData);

        const noEventCount = createdEvents.filter(
            event => event.eventType === EventType.NO_INCREASED_XP_WEEKEND
        ).length;

        expect(noEventCount).toBe(4);

        // Restore Math.random
        Math.random = originalRandom;
    });
});
