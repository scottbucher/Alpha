import CronExpressionParser, { CronDate } from 'cron-parser';
import { DateTime } from 'luxon';
import { promisify } from 'node:util';

import { GuildData } from '../database/entities/index.js';

let setTimeoutAsync = promisify(setTimeout);

export class TimeUtils {
    public static async sleep(ms: number): Promise<void> {
        return await setTimeoutAsync(ms);
    }

    /**
     * Get the current time, optionally in a specific time zone
     * @param timeZone Optional time zone identifier (e.g., 'America/New_York')
     * @returns DateTime object in the specified time zone, or UTC if none provided
     */
    public static now(timeZone?: string): DateTime {
        let now: DateTime<true> | DateTime<false> = DateTime.utc();
        if (timeZone) {
            now = now.setZone(timeZone);
        }
        return now;
    }

    /**
     * Get the current time in a guild's configured time zone
     * @param guild The guild data containing timezone settings
     * @returns DateTime object in the guild's time zone, or UTC if none configured
     */
    public static getNowForGuild(guild: GuildData): DateTime {
        return guild.generalSettings.timeZone
            ? this.now(guild.generalSettings.timeZone)
            : this.now();
    }

    /**
     * Convert a date string from a specific time zone to UTC
     * @param dateString ISO date string to convert
     * @param timeZone Source time zone (e.g., 'America/New_York')
     * @returns DateTime object converted to UTC
     */
    public static dateToUTC(dateString: string, timeZone: string): DateTime {
        return DateTime.fromISO(dateString, { zone: timeZone }).toUTC();
    }

    /**
     * Convert a UTC date string to a specific time zone
     * @param dateString ISO date string in UTC
     * @param timeZone Target time zone to convert to (e.g., 'America/New_York')
     * @returns DateTime object in the specified time zone
     */
    public static dateFromUTC(dateString: string, timeZone: string): DateTime {
        return DateTime.fromISO(dateString).setZone(timeZone);
    }

    /**
     * Calculate a time based on a cron expression and interval
     * @param cronString Cron expression (e.g., '0 0 * * *')
     * @param timeZone Time zone for the cron expression
     * @param interval Number of intervals to move (positive for future, negative for past, 0 for current time)
     * @param currentTime Base DateTime to calculate from (defaults to UTC now)
     * @returns DateTime representing the calculated time
     */
    public static cronIntervalTime(
        cronString: string,
        timeZone: string,
        interval: number,
        currentTime: DateTime = DateTime.utc()
    ): DateTime {
        let cron = CronExpressionParser.parse(cronString, {
            currentDate: currentTime.toISO(),
            tz: timeZone,
        });

        let cronTime: CronDate;
        if (interval === 0) {
            return currentTime;
        } else if (interval > 0) {
            for (let i = 0; i < interval; i++) {
                cronTime = cron.next();
            }
        } else if (interval < 0) {
            for (let i = 0; i < Math.abs(interval); i++) {
                cronTime = cron.prev();
            }
        }

        return DateTime.fromISO(cronTime.toISOString()).toUTC();
    }
}
