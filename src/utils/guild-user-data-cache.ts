import { GuildData, GuildUserData } from '../database/entities/index.js';

// Interface for cached guild user data
interface CachedGuildUserData {
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

    /**
     * Get cached guild user data for a guild
     * @param guildId The guild ID to get cached data for
     * @returns Cached data if valid, null otherwise
     */
    public static get(guildId: string): CachedGuildUserData | null {
        const now = Date.now();
        const cachedData = this.guildUserDataCache.get(guildId);

        if (cachedData && cachedData.expiresAt > now) {
            return cachedData;
        }

        // Remove expired cache entry
        if (cachedData) {
            this.guildUserDataCache.delete(guildId);
        }

        return null;
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
