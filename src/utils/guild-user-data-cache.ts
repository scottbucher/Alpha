import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Guild } from 'discord.js';

import { DatabaseUtils } from './database-utils.js';
import { GuildData, GuildUserData } from '../database/entities/index.js';

// Interface for cached guild user data
export interface CachedGuildUserData {
    guildData: GuildData;
    guildUserDatas: GuildUserData[];
    expiresAt: number;
}

/**
 * Shared cache for guild user data to reduce database calls across voice XP and message XP systems.
 * This ensures both systems use the same cached data and stay in sync.
 */
export class GuildUserDataCache {
    private static guildUserDataCache = new Map<string, CachedGuildUserData>();
    private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    private static orm: MikroORM<MongoDriver> | undefined;

    /**
     * Per-guild queue to prevent concurrent calls from racing and/or double-fetching.
     */
    private static guildQueues = new Map<string, Promise<unknown>>();

    /**
     * Must be called once during app startup before using `get()`.
     */
    public static init(orm: MikroORM<MongoDriver>): void {
        this.orm = orm;
    }

    private static getOrm(): MikroORM<MongoDriver> {
        if (!this.orm) {
            throw new Error(
                'GuildUserDataCache has not been initialized. Call GuildUserDataCache.init(orm) during startup.'
            );
        }
        return this.orm;
    }

    private static enqueue<T>(guildId: string, task: () => Promise<T>): Promise<T> {
        const previous = this.guildQueues.get(guildId) ?? Promise.resolve();
        const next = previous.then(task, task);

        this.guildQueues.set(guildId, next);
        next.finally(() => {
            if (this.guildQueues.get(guildId) === next) {
                this.guildQueues.delete(guildId);
            }
        });

        return next;
    }

    /**
     * Get cached guild user data for a guild
     * - If the cache entry is missing/expired, this will fetch from the DB and populate the cache.
     * - If the cache entry exists but is missing some users, it will fetch just the missing users and merge them in.
     */
    public static async get(guild: Guild, memberIds: string[]): Promise<CachedGuildUserData> {
        const requestedMemberIds = [...new Set(memberIds)];

        return await this.enqueue(guild.id, async () => {
            const now = Date.now();
            const cachedData = this.guildUserDataCache.get(guild.id);

            if (cachedData && cachedData.expiresAt > now) {
                const updatedCachedData = await this.ensureAllMembersAreCached(
                    guild,
                    cachedData,
                    requestedMemberIds
                );
                this.set(guild.id, updatedCachedData.guildData, updatedCachedData.guildUserDatas);
                return updatedCachedData;
            }

            // Remove expired cache entry
            if (cachedData) {
                this.guildUserDataCache.delete(guild.id);
            }

            const result = await DatabaseUtils.getOrCreateDataForGuild(
                this.getOrm().em.fork(),
                guild,
                requestedMemberIds,
                undefined,
                true
            );
            this.set(guild.id, result.GuildData, result.GuildUserData);
            return {
                guildData: result.GuildData,
                guildUserDatas: result.GuildUserData,
                expiresAt: now + this.CACHE_TTL_MS,
            };
        });
    }

    private static async ensureAllMembersAreCached(
        guild: Guild,
        cachedData: CachedGuildUserData,
        memberIds: string[]
    ): Promise<CachedGuildUserData> {
        if (memberIds.length === 0) {
            return cachedData;
        }

        const cachedUserIds = new Set(cachedData.guildUserDatas.map(gud => gud.userDiscordId));
        const missingMemberIds = memberIds.filter(id => !cachedUserIds.has(id));

        if (missingMemberIds.length === 0) {
            return cachedData;
        }

        const result = await DatabaseUtils.getOrCreateDataForGuild(
            this.getOrm().em.fork(),
            guild,
            missingMemberIds,
            cachedData.guildData,
            true
        );

        const mergedById = new Map<string, GuildUserData>();
        for (const gud of cachedData.guildUserDatas) {
            mergedById.set(gud.userDiscordId, gud);
        }
        for (const gud of result.GuildUserData) {
            mergedById.set(gud.userDiscordId, gud);
        }

        return {
            ...cachedData,
            // In case `getOrCreateDataForGuild` returned a different (or more populated) instance
            guildData: result.GuildData ?? cachedData.guildData,
            guildUserDatas: [...mergedById.values()],
        };
    }

    /**
     * Set cached guild user data for a guild
     * @param guildId The guild ID to cache data for
     * @param guildData The guild data to cache
     * @param guildUserDatas The guild user datas to cache
     */
    public static set(
        guildId: string,
        guildData: GuildData,
        guildUserDatas: GuildUserData[]
    ): void {
        const now = Date.now();
        this.guildUserDataCache.set(guildId, {
            guildData,
            guildUserDatas,
            expiresAt: now + this.CACHE_TTL_MS,
        });
    }

    /**
     * Update a specific user's data in the cache if it exists
     * @param guildId The guild ID
     * @param userId The user ID
     * @param updatedGuildUserData The updated guild user data
     */
    public static updateUserData(
        guildId: string,
        userId: string,
        updatedGuildUserData: GuildUserData
    ): void {
        const cachedData = this.guildUserDataCache.get(guildId);
        if (cachedData && cachedData.expiresAt > Date.now()) {
            const cachedIndex = cachedData.guildUserDatas.findIndex(
                gud => gud.userDiscordId === userId
            );
            if (cachedIndex >= 0) {
                // Update the cached entry with the new data
                cachedData.guildUserDatas[cachedIndex] = updatedGuildUserData;
            } else {
                // User not in cache, add them
                cachedData.guildUserDatas.push(updatedGuildUserData);
            }
        }
    }

    /**
     * Clear the cache for a specific guild or all guilds
     * @param guildId The guild ID to clear the cache for, or undefined to clear all caches
     */
    public static clear(guildId?: string): void {
        if (guildId) {
            this.guildUserDataCache.delete(guildId);
        } else {
            this.guildUserDataCache.clear();
        }
    }
}
