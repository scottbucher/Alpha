import { createRequire } from 'node:module';

import { Job } from './index.js';
import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { EventData, GuildData } from '../database/entities/index.js';
import { ExperienceUtils } from '../utils/experience-utils.js';
import { Client, Guild, TextChannel } from 'discord.js';
import { ClientUtils, FormatUtils, MessageUtils } from '../utils/index.js';
import { Lang, Logger } from '../services/index.js';
import { Language } from '../models/enum-helpers/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

const XP_EVENT_START_ICON =
    'https://birthday-bot-docs-images.s3.us-east-1.amazonaws.com/xp-multiplier.png';
const XP_EVENT_END_ICON =
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

        // Load guilds with their event datas, except for events that have ended
        let guildDatas = await em.find(
            GuildData,
            {},
            {
                populate: ['eventDatas'],
                filters: {
                    'eventDatas.timeProperties.hasEnded': false,
                },
            }
        );
        let now = new Date();

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

            try {
                let hasChangedEventsForGuild = await this.processGuildEvents(
                    guild,
                    guildData,
                    null,
                    now
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
                Logger.error(Logs.error.eventJobError, {
                    guildId: guild.id,
                    error: error.message,
                });
            }
        }

        if (hasChangedEvents) {
            await em.flush();
        }
    }

    private async processGuildEvents(
        guild: Guild,
        guildData: GuildData,
        channel: TextChannel | null,
        now: Date
    ): Promise<boolean> {
        let eventData = guildData.eventDatas.getItems();
        let hasChangedEventsForGuild = false;

        for (let event of eventData) {
            const eventStartTime = new Date(event.timeProperties.startTime);
            const eventEndTime = new Date(event.timeProperties.endTime);

            // This is probably overkill, but it's good to have
            if (isNaN(eventStartTime.getTime()) || isNaN(eventEndTime.getTime())) {
                Logger.error(Logs.error.invalidEventTimes, {
                    guildId: guild.id,
                    eventId: event.id,
                    startTime: event.timeProperties.startTime,
                    endTime: event.timeProperties.endTime,
                });
                continue;
            }

            // Check if event should start
            if (!event.timeProperties.hasStarted && now >= eventStartTime) {
                event.timeProperties.hasStarted = true;
                event.timeProperties.isActive = true;
                hasChangedEventsForGuild = true;

                Logger.info(Logs.info.xpEventStarted, {
                    guildId: guild.id,
                    eventId: event.id,
                    multiplier: event.xpProperties.multiplier,
                });

                await this.sendXpEventMessage(guild, event, channel, true);
            }

            // Check if event should end
            if (!event.timeProperties.hasEnded && now > eventEndTime) {
                event.timeProperties.hasEnded = true;
                event.timeProperties.isActive = false;
                hasChangedEventsForGuild = true;

                Logger.info(Logs.info.xpEventEnded, {
                    guildId: guild.id,
                    eventId: event.id,
                    multiplier: event.xpProperties.multiplier,
                });

                await this.sendXpEventMessage(guild, event, channel, false);
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
        event: EventData,
        eventChannel: TextChannel | null,
        isStarting: boolean
    ) {
        if (!eventChannel) return;

        const multiplier = event.xpProperties.multiplier;
        const multiplierKey = MULTIPLIER_NAMES[multiplier];

        if (!multiplierKey) {
            Logger.error(Logs.error.invalidMultiplier, {
                guildId: guild.id,
                eventId: event.id,
                multiplier: multiplier,
            });
            return;
        }

        const multiplierName = Lang.getRef('info', `terms.${multiplierKey}`, Language.Default);
        let eventStartTime = event.timeProperties.startTime;

        await MessageUtils.send(
            eventChannel,
            Lang.getEmbed(
                'info',
                `events.has${isStarting ? 'Started' : 'Ended'}`,
                Language.Default,
                {
                    MULTIPLIER_NAME_CAPS: multiplierName.toLocaleUpperCase(),
                    MULTIPLIER_NAME: multiplierName.toLocaleLowerCase(),
                    MULTIPLIER_AMOUNT: multiplier.toString(),
                    END_TIME: eventStartTime,
                    END_TIME_RELATIVE: FormatUtils.discordTimestampRelative(
                        new Date(eventStartTime)
                    ),
                    SERVER_ICON: guild.iconURL() ?? '',
                    XP_EVENT_ICON: isStarting ? XP_EVENT_START_ICON : XP_EVENT_END_ICON,
                }
            )
        );
    }
}
