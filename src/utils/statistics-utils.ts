import { MongoDriver, MongoEntityManager } from '@mikro-orm/mongodb';

/**
 * Low-level helpers for daily statistics persistence.
 *
 * Intentionally uses Mongo atomic updates for counter-like fields to avoid ORM
 * hydration/cascade overhead in hot paths (e.g. voice XP job).
 */
export class StatisticsUtils {
    private static COLLECTION = 'guildUserDailyStatisticsDatas';
    private static voiceMinutesOpsByGuild = new Map<string, any[]>();
    private static messageStatsOpsByGuild = new Map<string, any[]>();

    /**
     * Build a MongoDB update operation that:
     * - upserts the daily stats doc (guildUser, dayString)
     * - ensures xpStats exists (without overwriting existing values)
     * - increments xpStats.minutesSpentInVoice
     *
     * Uses an update *pipeline* (MongoDB 4.2+) so this stays a single operation.
     */
    public static buildVoiceMinutesUpsertOp(options: {
        guildUserObjectId: unknown;
        dayString: string;
        minutesIncrement: number;
        startingXp: number;
        createdIso: string;
    }): any {
        const { guildUserObjectId, dayString, minutesIncrement, startingXp, createdIso } = options;

        return {
            updateOne: {
                filter: {
                    guildUser: guildUserObjectId,
                    dayString,
                },
                update: [
                    {
                        // Ensure top-level fields exist on insert
                        $set: {
                            created: { $ifNull: ['$created', createdIso] },
                            guildUser: { $ifNull: ['$guildUser', guildUserObjectId] },
                            dayString: { $ifNull: ['$dayString', dayString] },

                            // Ensure xpStats exists (or stays as-is)
                            xpStats: {
                                $ifNull: [
                                    '$xpStats',
                                    {
                                        startingXp,
                                        minutesSpentInVoice: 0,
                                        messagesSent: 0,
                                    },
                                ],
                            },
                        },
                    },
                    {
                        // Patch xpStats fields without overwriting existing values
                        $set: {
                            'xpStats.startingXp': { $ifNull: ['$xpStats.startingXp', startingXp] },
                            'xpStats.messagesSent': { $ifNull: ['$xpStats.messagesSent', 0] },
                            'xpStats.minutesSpentInVoice': {
                                $add: [
                                    { $ifNull: ['$xpStats.minutesSpentInVoice', 0] },
                                    minutesIncrement,
                                ],
                            },
                        },
                    },
                ],
                upsert: true,
            },
        };
    }

    /**
     * Build a MongoDB update operation that:
     * - upserts the daily stats doc (guildUser, dayString)
     * - ensures xpStats exists (without overwriting existing values)
     * - increments xpStats.messagesSent
     *
     * Uses an update *pipeline* (MongoDB 4.2+) so this stays a single operation.
     */
    public static buildMessageStatsUpsertOp(options: {
        guildUserObjectId: unknown;
        dayString: string;
        messagesIncrement: number;
        startingXp: number;
        createdIso: string;
    }): any {
        const { guildUserObjectId, dayString, messagesIncrement, startingXp, createdIso } = options;

        return {
            updateOne: {
                filter: {
                    guildUser: guildUserObjectId,
                    dayString,
                },
                update: [
                    {
                        // Ensure top-level fields exist on insert
                        $set: {
                            created: { $ifNull: ['$created', createdIso] },
                            guildUser: { $ifNull: ['$guildUser', guildUserObjectId] },
                            dayString: { $ifNull: ['$dayString', dayString] },

                            // Ensure xpStats exists (or stays as-is)
                            xpStats: {
                                $ifNull: [
                                    '$xpStats',
                                    {
                                        startingXp,
                                        minutesSpentInVoice: 0,
                                        messagesSent: 0,
                                    },
                                ],
                            },
                        },
                    },
                    {
                        // Patch xpStats fields without overwriting existing values
                        $set: {
                            'xpStats.startingXp': { $ifNull: ['$xpStats.startingXp', startingXp] },
                            'xpStats.minutesSpentInVoice': {
                                $ifNull: ['$xpStats.minutesSpentInVoice', 0],
                            },
                            'xpStats.messagesSent': {
                                $add: [
                                    { $ifNull: ['$xpStats.messagesSent', 0] },
                                    messagesIncrement,
                                ],
                            },
                        },
                    },
                ],
                upsert: true,
            },
        };
    }

    public static queueVoiceMinutesForGuild(
        guildId: string,
        options: {
            guildUserObjectId: unknown;
            dayString: string;
            minutesIncrement: number;
            startingXp: number;
            createdIso: string;
        }
    ): void {
        const ops = this.voiceMinutesOpsByGuild.get(guildId) ?? [];
        ops.push(this.buildVoiceMinutesUpsertOp(options));
        this.voiceMinutesOpsByGuild.set(guildId, ops);
    }

    public static queueMessageStatsForGuild(
        guildId: string,
        options: {
            guildUserObjectId: unknown;
            dayString: string;
            messagesIncrement: number;
            startingXp: number;
            createdIso: string;
        }
    ): void {
        const ops = this.messageStatsOpsByGuild.get(guildId) ?? [];
        ops.push(this.buildMessageStatsUpsertOp(options));
        this.messageStatsOpsByGuild.set(guildId, ops);
    }

    public static async flushVoiceMinutesForGuild(
        em: MongoEntityManager<MongoDriver>,
        guildId: string,
        ordered: boolean = true
    ): Promise<void> {
        const ops = this.voiceMinutesOpsByGuild.get(guildId) ?? [];
        this.voiceMinutesOpsByGuild.delete(guildId);
        await this.bulkWriteDailyStats(em, ops, ordered);
    }

    public static async flushMessageStatsForGuild(
        em: MongoEntityManager<MongoDriver>,
        guildId: string,
        ordered: boolean = true
    ): Promise<void> {
        const ops = this.messageStatsOpsByGuild.get(guildId) ?? [];
        this.messageStatsOpsByGuild.delete(guildId);
        await this.bulkWriteDailyStats(em, ops, ordered);
    }

    public static async bulkWriteDailyStats(
        em: MongoEntityManager<MongoDriver>,
        ops: any[],
        ordered: boolean = true
    ): Promise<void> {
        if (ops.length === 0) {
            return;
        }

        const statsCollection = em.getConnection().getCollection(this.COLLECTION);
        await statsCollection.bulkWrite(ops, { ordered });
    }
}

