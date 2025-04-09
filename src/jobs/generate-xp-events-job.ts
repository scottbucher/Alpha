import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Client } from 'discord.js';
import { DateTime } from 'luxon';
import { createRequire } from 'node:module';

import { Job } from './index.js';
import { XpMultiplier } from '../database/entities/event-data.js';
import { EventData, GuildData } from '../database/entities/index.js';
import { EventType } from '../enums/index.js';
import { Logger } from '../services/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

export class GenerateXpEventsJob extends Job {
    public name = 'Generate XP Events';
    // Run every Sunday at 11:59 PM
    public schedule: string = Config.jobs.generateXpEvents.schedule;
    public log: boolean = Config.jobs.generateXpEvents.log;
    public runOnce: boolean = Config.jobs.generateXpEvents.runOnce;
    public initialDelaySecs: number = Config.jobs.generateXpEvents.initialDelaySecs;

    constructor(
        private client: Client,
        private orm: MikroORM<MongoDriver>
    ) {
        super();
    }

    public async run(): Promise<void> {
        let em = this.orm.em.fork();
        let guildIds = this.client.guilds.cache.map(guild => guild.id);

        try {
            // Get active Discord guilds

            // Get database guilds that are still active
            const guilds = await em.find(
                GuildData,
                { discordId: { $in: guildIds } },
                {
                    populate: ['eventDatas'],
                }
            );

            for (const guild of guilds) {
                try {
                    await this.generateEventsForGuild(guild, em);
                } catch (error) {
                    Logger.error(Logs.error.generateXpEventsError, {
                        guildId: guild.discordId,
                        error: error.message,
                    });
                }
            }

            await em.flush();
        } catch (error) {
            Logger.error(Logs.error.generateXpEventsJobError, {
                error: error.message,
            });
        }
    }

    private async generateEventsForGuild(guild: GuildData, em: any): Promise<void> {
        const timezone = guild.generalSettings.timeZone ?? 'UTC';
        let now = DateTime.now().setZone(timezone);

        // Get the next 4 weekends
        const weekends = this.getNextWeekends(now, 4);

        // Filter out weekends that already have any type of event
        const existingEvents = guild.eventDatas
            .getItems()
            .filter(
                event =>
                    (event.eventType === EventType.INCREASED_XP_WEEKEND ||
                        event.eventType === EventType.NO_INCREASED_XP_WEEKEND) &&
                    event.autoGenerated
            );

        const newWeekends = weekends.filter(
            weekend => !this.hasExistingEvent(existingEvents, weekend.start, weekend.end)
        );

        // Generate events for new weekends
        for (const weekend of newWeekends) {
            // 15% chance for an XP event
            if (Math.random() < 0.15) {
                // Determine multiplier based on probabilities
                const multiplier = this.determineMultiplier();

                const event = new EventData(
                    em.getReference(GuildData, guild.id),
                    EventType.INCREASED_XP_WEEKEND,
                    weekend.start.toISO(),
                    weekend.end.toISO()
                );

                event.autoGenerated = true;
                event.xpProperties.multiplier = multiplier;

                em.persist(event);
                guild.eventDatas.add(event);

                Logger.info(
                    Logs.info.xpEventGenerated
                        .replace('{MULTIPLIER}', multiplier.toString())
                        .replace('{START_TIME}', weekend.start.toISO())
                        .replace('{END_TIME}', weekend.end.toISO())
                        .replace('{GUILD_ID}', guild.discordId)
                );
            } else {
                // Create a NO_INCREASED_XP_WEEKEND entry to track that we checked this weekend
                const noEventMarker = new EventData(
                    em.getReference(GuildData, guild.id),
                    EventType.NO_INCREASED_XP_WEEKEND,
                    weekend.start.toISO(),
                    weekend.end.toISO()
                );

                noEventMarker.autoGenerated = true;

                em.persist(noEventMarker);
                guild.eventDatas.add(noEventMarker);

                Logger.info(
                    Logs.info.noXpEventGenerated
                        .replace('{START_TIME}', weekend.start.toISO())
                        .replace('{END_TIME}', weekend.end.toISO())
                        .replace('{GUILD_ID}', guild.discordId)
                );
            }
        }
    }

    private determineMultiplier(): XpMultiplier {
        const rand = Math.random();
        if (rand < 0.85) return 2; // 85% chance
        if (rand < 0.95) return 3; // 10% chance
        return 4; // 5% chance
    }

    private getNextWeekends(
        from: DateTime,
        count: number
    ): Array<{ start: DateTime; end: DateTime }> {
        const weekends = [];
        let current = from;

        while (weekends.length < count) {
            // Find next Friday
            while (current.weekday !== 5) {
                // 5 = Friday
                current = current.plus({ days: 1 });
            }

            // Start time is Friday 6 PM
            const startTime = current.set({ hour: 18, minute: 0, second: 0, millisecond: 0 });

            // End time is Sunday midnight (Monday 00:00)
            const endTime = current.plus({ days: 2 }).set({
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
            });

            weekends.push({ start: startTime, end: endTime });

            // Move to next week
            current = current.plus({ days: 7 });
        }

        return weekends;
    }

    private hasExistingEvent(events: EventData[], startTime: DateTime, endTime: DateTime): boolean {
        return events.some(event => {
            const eventStart = DateTime.fromISO(event.timeProperties.startTime);
            const eventEnd = DateTime.fromISO(event.timeProperties.endTime);

            // Check if the time periods overlap (exclusive)
            return !(eventEnd <= startTime || eventStart >= endTime);
        });
    }
}
