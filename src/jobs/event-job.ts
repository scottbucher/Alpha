import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { BaseMessageOptions, Client, Guild, TextChannel } from 'discord.js';
import { DateTime } from 'luxon';
import { createRequire } from 'node:module';

import { Job } from './index.js';
import { EventData, GuildData } from '../database/entities/index.js';
import { EventStage, EventType } from '../enums/index.js';
import { Language } from '../models/enum-helpers/index.js';
import { Lang, Logger } from '../services/index.js';
import {
    ClientUtils,
    ExperienceUtils,
    FormatUtils,
    MessageUtils,
    TimeUtils,
} from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

const XP_EVENT_START_ICON =
    'https://birthday-bot-docs-images.s3.us-east-1.amazonaws.com/xp-multiplier.png';
const XP_EVENT_END_ICON =
    'https://birthday-bot-docs-images.s3.us-east-1.amazonaws.com/xp-multiplier.png';
const XP_EVENT_ANNOUNCED_ICON =
    'https://birthday-bot-docs-images.s3.us-east-1.amazonaws.com/xp-multiplier.png';

const MULTIPLIER_NAMES = {
    2: 'double',
    3: 'triple',
    4: 'quadruple',
};

/**
 * This job checks if any events are starting or ending this hour and updates the database as well as sends a message to the channel if there is one.
 */
export class EventJob extends Job {
    public name = 'Event Job';
    public schedule: string = Config.jobs.eventJob.schedule;
    public log: boolean = Config.jobs.eventJob.log;
    public runOnce: boolean = Config.jobs.eventJob.runOnce;
    public initialDelaySecs: number = Config.jobs.eventJob.initialDelaySecs;

    constructor(
        private client: Client,
        private orm: MikroORM<MongoDriver>
    ) {
        super();
    }

    public async run(): Promise<void> {
        let em = this.orm.em.fork();
        let guildIds = this.client.guilds.cache.map(guild => guild.id);

        // Load guilds with their event datas, except for events that have ended
        let guildDatas = await em.find(
            GuildData,
            { discordId: { $in: guildIds } },
            {
                populate: ['eventDatas'],
                filters: {
                    'eventDatas.timeProperties.hasEnded': false,
                },
            }
        );

        // Efficiency check to see if we need to flush the database
        let hasChangedEvents = false;

        for (let guildData of guildDatas) {
            let guild = await this.client.guilds.fetch(guildData.discordId);
            if (!guild) {
                Logger.error(
                    Logs.error.guildNotFoundDuringEventUpdate.replaceAll(
                        '{GUILD_ID}',
                        guildData.discordId
                    )
                );
                continue;
            }

            let eventDatas = guildData.eventDatas.getItems();

            if (eventDatas.length === 0) {
                continue;
            }

            // Process increased xp weekend events
            try {
                let channel = await ClientUtils.getConfiguredTextChannelIfExists(
                    guild,
                    guildData.eventSettings.channelDiscordId
                );

                let hasChangedEventsForGuild = await this.processGuildIncreasedXpWeekendEvents(
                    guild,
                    guildData,
                    eventDatas.filter(event => event.eventType === EventType.INCREASED_XP_WEEKEND),
                    channel,
                    TimeUtils.getNowForGuild(guildData)
                );

                if (hasChangedEventsForGuild) {
                    let activeEvents = guildData.eventDatas
                        .getItems()
                        .filter(event => event.timeProperties.isActive);

                    if (activeEvents.length > 0) {
                        let highestMultiplier = Math.max(
                            ...activeEvents.map(event => event.xpProperties.multiplier)
                        );
                        ExperienceUtils.setMultiplierCache(guild.id, highestMultiplier);
                    } else {
                        ExperienceUtils.clearMultiplierCache(guild.id);
                    }

                    hasChangedEvents = true;
                }
            } catch (error) {
                Logger.error(Logs.error.eventJobError, error);
            }
        }

        if (hasChangedEvents) {
            await em.flush();
        }
    }

    private async processGuildIncreasedXpWeekendEvents(
        guild: Guild,
        guildData: GuildData,
        eventDatas: EventData[],
        channel: TextChannel | null,
        now: DateTime
    ): Promise<boolean> {
        let hasChangedEventsForGuild = false;

        for (let event of eventDatas) {
            let timeZone = guildData.generalSettings.timeZone;

            // Convert string dates to DateTime objects in the guild's time zone
            const eventStartTime = DateTime.fromISO(event.timeProperties.startTime, {
                zone: timeZone,
            });
            const eventEndTime = DateTime.fromISO(event.timeProperties.endTime, {
                zone: timeZone,
            });

            // This is probably overkill, but it's good to have
            if (!eventStartTime.isValid || !eventEndTime.isValid) {
                Logger.error(
                    Logs.error.invalidEventTimes
                        .replaceAll('{GUILD_ID}', guild.id)
                        .replaceAll('{EVENT_ID}', event.id)
                        .replaceAll('{START_TIME}', event.timeProperties.startTime)
                        .replaceAll('{END_TIME}', event.timeProperties.endTime)
                );
                continue;
            }

            // For debugging time zones
            Logger.info(`Guild: ${guild.name}, Time Zone: ${timeZone}`);
            Logger.info(
                `Event start time: ${eventStartTime.toISO()} (${eventStartTime.toLocaleString(DateTime.DATETIME_FULL)})`
            );
            Logger.info(
                `Event end time: ${eventEndTime.toISO()} (${eventEndTime.toLocaleString(DateTime.DATETIME_FULL)})`
            );
            Logger.info(
                `Current time in guild's time zone: ${now.toISO()} (${now.toLocaleString(DateTime.DATETIME_FULL)})`
            );

            // Check if we should announce the upcoming event (2 weeks before)
            const timeBeforeStart = eventStartTime.minus({
                days: Config.events.announce.daysBefore,
            });

            if (
                !event.timeProperties.hasAnnounced &&
                now >= timeBeforeStart &&
                now < eventStartTime
            ) {
                event.timeProperties.hasAnnounced = true;
                hasChangedEventsForGuild = true;

                Logger.info(
                    Logs.info.xpEventAnnounced
                        .replaceAll('{GUILD_ID}', guild.id)
                        .replaceAll('{EVENT_ID}', event.id)
                        .replaceAll('{MULTIPLIER}', event.xpProperties.multiplier.toString())
                );

                await this.sendXpEventMessage(
                    guild,
                    guildData,
                    event,
                    channel,
                    EventStage.Announced
                );
            }

            // Check if event should start
            if (!event.timeProperties.hasStarted && now >= eventStartTime) {
                event.timeProperties.hasStarted = true;
                event.timeProperties.isActive = true;
                hasChangedEventsForGuild = true;

                Logger.info(
                    Logs.info.xpEventStarted
                        .replaceAll('{GUILD_ID}', guild.id)
                        .replaceAll('{EVENT_ID}', event.id)
                        .replaceAll('{MULTIPLIER}', event.xpProperties.multiplier.toString())
                );

                await this.sendXpEventMessage(guild, guildData, event, channel, EventStage.Started);
            }

            // Check if event should end
            if (!event.timeProperties.hasEnded && now > eventEndTime) {
                event.timeProperties.hasEnded = true;
                event.timeProperties.isActive = false;
                hasChangedEventsForGuild = true;

                Logger.info(
                    Logs.info.xpEventEnded
                        .replaceAll('{GUILD_ID}', guild.id)
                        .replaceAll('{EVENT_ID}', event.id)
                        .replaceAll('{MULTIPLIER}', event.xpProperties.multiplier.toString())
                );

                await this.sendXpEventMessage(guild, guildData, event, channel, EventStage.Ended);
            }

            // Ensure active status correctly reflects if we're in the event's time window
            // This handles edge cases where an event might need to be activated/deactivated
            // during its scheduled period
            // TBH this is more than likely overkill, but it's good to have
            if (
                event.timeProperties.hasStarted &&
                !event.timeProperties.hasEnded &&
                event.timeProperties.isActive !== (now >= eventStartTime && now <= eventEndTime)
            ) {
                event.timeProperties.isActive = now >= eventStartTime && now <= eventEndTime;
                hasChangedEventsForGuild = true;
            }
        }

        return hasChangedEventsForGuild;
    }

    private async sendXpEventMessage(
        guild: Guild,
        guildData: GuildData,
        event: EventData,
        eventChannel: TextChannel | null,
        type: EventStage
    ): Promise<void> {
        if (!eventChannel) return;

        const multiplier = event.xpProperties.multiplier;
        const multiplierKey = MULTIPLIER_NAMES[multiplier];

        if (!multiplierKey) {
            Logger.error(
                Logs.error.invalidMultiplier
                    .replaceAll('{GUILD_ID}', guild.id)
                    .replaceAll('{EVENT_ID}', event.id)
                    .replaceAll('{MULTIPLIER}', multiplier.toString())
            );
            return;
        }

        const timeZone = guildData?.generalSettings.timeZone;

        const multiplierName = Lang.getRef('info', `terms.${multiplierKey}`, Language.Default);

        // Parse dates with the guild's time zone
        const eventStartTime = DateTime.fromISO(event.timeProperties.startTime, {
            zone: timeZone,
        }).toJSDate();

        const eventEndTime = DateTime.fromISO(event.timeProperties.endTime, {
            zone: timeZone,
        }).toJSDate();

        const embed = Lang.getEmbed(
            'info',
            type === EventStage.Announced
                ? 'xpEvents.announced'
                : `xpEvents.has${type === EventStage.Started ? 'Started' : 'Ended'}`,
            Language.Default,
            {
                MULTIPLIER_NAME_CAPS: multiplierName.toLocaleUpperCase(),
                MULTIPLIER_NAME: multiplierName.toLocaleLowerCase(),
                MULTIPLIER_AMOUNT: multiplier.toString(),
                START_TIME: FormatUtils.discordTimestampRelative(eventStartTime),
                END_TIME: eventEndTime.toLocaleString(),
                END_TIME_RELATIVE: FormatUtils.discordTimestampRelative(eventEndTime),
                SERVER_ICON: guild.iconURL() ?? '',
                XP_EVENT_ICON:
                    type === EventStage.Announced
                        ? XP_EVENT_ANNOUNCED_ICON
                        : type === EventStage.Ended
                          ? XP_EVENT_END_ICON
                          : XP_EVENT_START_ICON,
            }
        );

        // TODO: make this a configurable mention
        let mention = `@everyone`;

        await MessageUtils.send(eventChannel, {
            content: mention,
            embeds: [embed],
        } as BaseMessageOptions);
    }
}
