import { GuildMember } from 'discord.js';
import { DateTime } from 'luxon';
import { createRequire } from 'node:module';

import { GuildData } from '../database/entities/index.js';

const require = createRequire(import.meta.url);
const Config = require('../../config/config.json');
const textXpMin = Config.experience.textMin;
const textXpMax = Config.experience.textMax;
const voiceXpAmount = Config.experience.voiceAmount;

/**
 * Utility class for managing experience points and leveling system
 */
export abstract class ExperienceUtils {
    /**
     * Cache for XP multipliers. Since we check xp multipliers for every message and voice event, we should cache the results so we don't have to query the database every time.
     */
    private static xpMultiplierCache = new Map<
        string,
        {
            multiplier: number;
            expiresAt: number;
        }
    >();

    // TODO: evaluate if this is a good cache ttl
    // TODO: We could cache it for a long time if we track when events start and end
    private static CACHE_TTL_MS = 60000 * 5; // Cache for 5 minutes

    /**
     * Get the XP multiplier for a guild
     * @param guildData The guild data to get the multiplier for
     * @returns The XP multiplier for the guild
     */
    public static async getXpMultiplier(guildData: GuildData): Promise<number> {
        const now = Date.now();
        const cached = this.xpMultiplierCache.get(guildData.discordId);

        // Return cached value if it exists and hasn't expired
        if (cached && cached.expiresAt > now) {
            return cached.multiplier;
        }

        // If cache missed or expired, fetch from database
        await guildData.eventDatas.init();
        let eventData = guildData.eventDatas.getItems();

        // Find all active events and get the highest multiplier
        const activeEvents = eventData.filter(event => event.timeProperties.isActive);
        const multiplier =
            activeEvents.length > 0
                ? Math.max(...activeEvents.map(event => event.xpProperties.multiplier ?? 1))
                : 1;

        // Update cache
        this.setMultiplierCache(guildData.discordId, multiplier);

        return multiplier;
    }

    /**
     * Clear the cache for a specific guild or all guilds
     * @param guildId The guild ID to clear the cache for, or undefined to clear all caches
     */
    public static clearMultiplierCache(guildId?: string): void {
        if (guildId) {
            this.xpMultiplierCache.delete(guildId);
        } else {
            this.xpMultiplierCache.clear();
        }
    }

    public static setMultiplierCache(guildId: string, multiplier: number): void {
        this.xpMultiplierCache.set(guildId, {
            multiplier,
            expiresAt: Date.now() + this.CACHE_TTL_MS,
        });
    }

    /**
     * Calculate XP required to complete a specific level (ex: you are level 5, the amount of XP needed to reach level 6)
     * @param level The level to calculate XP for
     * @returns The amount of XP needed for this level
     */
    public static getXpForNextLevel(level: number): number {
        return 5 * (level * level) + 50 * level + 100;
    }

    /**
     * Calculate a user's level based on their total XP
     * @param xp Total XP accumulated
     * @returns The user's current level
     */
    public static getLevelFromXp(xp: number): number {
        let level = 0;

        while (xp >= this.getXpForNextLevel(level)) {
            xp -= this.getXpForNextLevel(level);
            level++;
        }

        return level;
    }

    /**
     * Calculate total XP required to reach a specific level
     * @param level The target level
     * @returns Total XP required to reach this level
     */
    public static getTotalXpForLevel(level: number): number {
        let xp = 0;
        for (let i = 0; i < level; i++) {
            xp += this.getXpForNextLevel(i);
        }
        return xp;
    }

    /**
     * Calculate XP progress within the current level
     * @param totalXp Total XP accumulated
     * @returns XP progress in the current level
     */
    public static getXpProgressInCurrentLevel(totalXp: number): number {
        const currentLevel = this.getLevelFromXp(totalXp);
        const xpForCurrentLevel = this.getTotalXpForLevel(currentLevel);
        return totalXp - xpForCurrentLevel;
    }

    /**
     * Calculate remaining XP needed to level up
     * @param totalXp Current total XP
     * @returns XP needed to reach the next level
     */
    public static getXpNeededForNextLevel(totalXp: number): number {
        const currentLevel = this.getLevelFromXp(totalXp);
        const xpForCurrentLevel = this.getXpForNextLevel(currentLevel);
        const currentProgress = this.getXpProgressInCurrentLevel(totalXp);

        return xpForCurrentLevel - currentProgress;
    }

    /**
     * Generate a random XP amount for message rewards with guild member multipliers
     * @param guildMember The guild member to calculate XP for
     * @param multiplier The base multiplier for the message XP (defaults to 1)
     * @returns Random XP amount within configured range with multipliers applied
     */
    public static generateMessageXp(guildMember: GuildMember, multiplier: number = 1): number {
        return Math.round(
            this.generateBaseMessageXp() *
                this.getXpMultiplierForGuildMember(guildMember, multiplier)
        );
    }

    /**
     * Generate base random XP amount for messages without any multipliers
     * @returns Random XP amount within configured text XP range
     */
    public static generateBaseMessageXp(): number {
        return Math.random() * (textXpMax - textXpMin) + textXpMin;
    }

    /**
     * Calculate the total XP multiplier for a guild member
     * @param guildMember The guild member to calculate multiplier for
     * @param multiplier The base multiplier to apply (defaults to 1)
     * @returns Combined multiplier including nitro bonus and base multiplier
     */
    public static getXpMultiplierForGuildMember(
        guildMember: GuildMember,
        multiplier: number = 1
    ): number {
        return this.getGuildMemberNitroMultiplier(guildMember) * multiplier;
    }

    /**
     * Get the nitro multiplier for a guild member
     * @param guildMember The guild member to check for nitro status
     * @returns 1.2 if member has nitro, 1.0 otherwise
     */
    public static getGuildMemberNitroMultiplier(guildMember: GuildMember): number {
        return guildMember.premiumSince ? 1.2 : 1;
    }

    /**
     * If a voice channel has at least 2 members, give them an additional 1 XP per member in the voice channel, up to a maxium of 5 XP
     * @param guildMembers The guild members to calculate XP for
     * @returns Total XP amount for multiple users in a voice channel
     */
    public static getVoiceXpForMultipleUsersInVoiceChannel(numberOfMembers: number): number {
        // If less than 2 members, no bonus XP
        if (numberOfMembers < 2) {
            return 0;
        }

        // 1 XP per member in the voice channel, up to a maximum of 5 XP
        return Math.min(numberOfMembers, 5);
    }

    /**
     * Generate XP amount for voice activity with guild member multipliers
     * @param guildMember The guild member to calculate XP for
     * @param minutesInVoice Minutes spent in voice channel (defaults to 1)
     * @param multiplier The base multiplier for the voice XP (defaults to 1)
     * @returns XP amount for voice activity with multipliers applied
     */
    public static generateVoiceXp(
        guildMember: GuildMember,
        numberOfMembers: number,
        minutesInVoice: number = 1,
        multiplier: number = 1
    ): number {
        return (
            Math.round(
                this.generateBaseVoiceXp(numberOfMembers) *
                    this.getXpMultiplierForGuildMember(guildMember, multiplier)
            ) * minutesInVoice
        );
    }

    /**
     * Generate base XP amount for voice activity without any multipliers
     * @param numberOfMembers The number of members in the voice channel
     * @returns Base XP amount for voice activity
     */
    public static generateBaseVoiceXp(numberOfMembers: number): number {
        return voiceXpAmount + this.getVoiceXpForMultipleUsersInVoiceChannel(numberOfMembers);
    }

    /**
     * Check if enough time has passed to earn more XP
     * @param lastUpdated Timestamp of last XP gain
     * @param cooldownMinutes Minutes required between XP gains (defaults to 1)
     * @returns Whether user can receive XP again
     */
    public static canEarnXp(lastUpdated: string | Date, cooldownMinutes: number = 1): boolean {
        const lastUpdatedTime =
            lastUpdated instanceof Date
                ? DateTime.fromJSDate(lastUpdated)
                : DateTime.fromISO(lastUpdated);

        const cooldownEndTime = lastUpdatedTime.plus({ minutes: cooldownMinutes });
        return DateTime.now() > cooldownEndTime;
    }

    /**
     * Check if user has leveled up
     * @param previousXp Previous XP amount
     * @param newXp New XP amount
     * @returns Whether user leveled up
     */
    public static hasLeveledUp(previousXp: number, newXp: number): boolean {
        return this.getLevelFromXp(newXp) > this.getLevelFromXp(previousXp);
    }

    /**
     * Calculate level progress as a percentage
     * @param totalXp Total XP accumulated
     * @returns Percentage progress to next level (0-100)
     */
    public static getLevelProgressPercentage(totalXp: number): number {
        const currentLevel = this.getLevelFromXp(totalXp);
        const currentLevelXp = this.getXpForNextLevel(currentLevel);
        const progress = this.getXpProgressInCurrentLevel(totalXp);

        return Math.min(100, Math.floor((progress / currentLevelXp) * 100));
    }
}
