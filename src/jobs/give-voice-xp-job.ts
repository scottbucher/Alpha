import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Client } from 'discord.js';
import { createRequire } from 'node:module';

import { Job } from './index.js';
import { GuildData, GuildUserData } from '../database/entities/index.js';
import { LevelUpService, Logger } from '../services/index.js';
import { DatabaseUtils } from '../utils/index.js';
import { ExperienceUtils } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

// Interface for cached guild user data
interface CachedGuildUserData {
    guildData: GuildData;
    guildUserDatas: GuildUserData[];
    expiresAt: number;
}

export class GiveVoiceXpJob extends Job {
    public name = 'Give Voice XP';
    public schedule: string = Config.jobs.giveVoiceXp.schedule;
    public log: boolean = Config.jobs.giveVoiceXp.log;
    public runOnce: boolean = Config.jobs.giveVoiceXp.runOnce;
    public initialDelaySecs: number = Config.jobs.giveVoiceXp.initialDelaySecs;

    // Cache for guild user data to reduce database calls
    private static guildUserDataCache = new Map<string, CachedGuildUserData>();
    private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    constructor(
        private client: Client,
        private orm: MikroORM<MongoDriver>,
        private levelUpService: LevelUpService
    ) {
        super();
    }

    public async run(): Promise<void> {
        let guildList = this.client.guilds.cache;
        let em = this.orm.em.fork();

        for (let guild of guildList.values()) {
            let guildVoiceStates = [...guild.voiceStates.cache.values()].filter(
                voiceState =>
                    voiceState.channelId &&
                    !voiceState.member.user.bot &&
                    voiceState.channel !== guild.afkChannel &&
                    voiceState.selfDeaf === false
            ); // Filter out the bots and afk channels first

            // If there are no voice states, we can skip this guild
            if (guildVoiceStates.length === 0) {
                continue;
            }

            // Get all the GuildUserData objects for this guild but only the for the GuildMembers that are in the voiceState array
            let voiceUserIds = guildVoiceStates.map(voiceState => voiceState.member.id);

            // Try to get data from cache first
            let guildData: GuildData | null = null;
            let guildUserDatas: GuildUserData[] = [];
            let shouldUpdateCache = true;

            // Check cache first
            const now = Date.now();
            const cachedData = GiveVoiceXpJob.guildUserDataCache.get(guild.id);

            if (cachedData && cachedData.expiresAt > now) {
                // We have valid cache, let's use it
                guildData = cachedData.guildData;

                // Check if all needed users are in the cache
                const cachedUserIds = new Set(
                    cachedData.guildUserDatas.map(gud => gud.userDiscordId)
                );
                const missingUserIds = voiceUserIds.filter(id => !cachedUserIds.has(id));

                if (missingUserIds.length === 0) {
                    // All users are in the cache, filter to only the ones we need
                    guildUserDatas = cachedData.guildUserDatas.filter(gud =>
                        voiceUserIds.includes(gud.userDiscordId)
                    );
                    shouldUpdateCache = false;

                    Logger.info(
                        Logs.info?.cacheHitVoiceXp?.replaceAll('{GUILD_ID}', guild.id) ||
                            `Voice XP cache hit for guild ${guild.id}`
                    );
                } else {
                    // Some users are missing, fetch all data
                    Logger.info(
                        Logs.info?.cachePartialVoiceXp?.replaceAll('{GUILD_ID}', guild.id) ||
                            `Voice XP partial cache hit for guild ${guild.id}`
                    );
                    const result = await DatabaseUtils.getOrCreateDataForGuild(
                        em,
                        guild,
                        voiceUserIds,
                        guildData
                    );
                    guildData = result.GuildData;
                    guildUserDatas = result.GuildUserData;
                }
            } else {
                // No cache or expired, fetch from database
                Logger.info(
                    Logs.info?.cacheMissVoiceXp?.replaceAll('{GUILD_ID}', guild.id) ||
                        `Voice XP cache miss for guild ${guild.id}`
                );
                const result = await DatabaseUtils.getOrCreateDataForGuild(em, guild, voiceUserIds);
                guildData = result.GuildData;
                guildUserDatas = result.GuildUserData;
            }

            // Update cache if needed
            if (shouldUpdateCache) {
                GiveVoiceXpJob.guildUserDataCache.set(guild.id, {
                    guildData,
                    guildUserDatas,
                    expiresAt: now + GiveVoiceXpJob.CACHE_TTL_MS,
                });
            }

            let leveledUpUsers: { userId: string; oldLevel: number; newLevel: number }[] = [];
            let updatedGuildUserDatas: GuildUserData[] = [];

            for (let voiceState of guildVoiceStates) {
                let guildUserData = guildUserDatas.find(
                    userData => userData.userDiscordId === voiceState.member.id
                );
                if (guildUserData) {
                    let memberXpBefore = guildUserData.experience;
                    let memberLevelBefore = ExperienceUtils.getLevelFromXp(memberXpBefore);

                    guildUserData.experience += ExperienceUtils.generateVoiceXp(
                        await ExperienceUtils.getXpMultiplier(guildData)
                    );
                    let memberXpAfter = guildUserData.experience;
                    updatedGuildUserDatas.push(guildUserData);

                    let hasLeveledUp = ExperienceUtils.hasLeveledUp(memberXpBefore, memberXpAfter);
                    if (hasLeveledUp) {
                        leveledUpUsers.push({
                            userId: voiceState.member.id,
                            oldLevel: memberLevelBefore, // not sure I need this, only scenario I can think of where we would is if they leveled up multiple times, is that possible?
                            newLevel: ExperienceUtils.getLevelFromXp(memberXpAfter),
                        });
                    }
                } else {
                    // This should never happen, we use the DatabaseUtils to create a GuildUserData object for every user in the voiceState array that is missing originally
                    Logger.error(Logs.error.noGuildUserDataDuringVoiceXp, {
                        guildId: guild.id,
                        userId: voiceState.member.id,
                    });
                }
            }

            // Persist all updated guild user data in a single batch
            if (updatedGuildUserDatas.length > 0) {
                await em.persistAndFlush(updatedGuildUserDatas);

                // Update the cache with the new values
                if (cachedData) {
                    // Update the cached data with new experience values
                    const cachedUserDatas = cachedData.guildUserDatas;
                    for (const updatedData of updatedGuildUserDatas) {
                        const cachedIndex = cachedUserDatas.findIndex(
                            c => c.userDiscordId === updatedData.userDiscordId
                        );
                        if (cachedIndex >= 0) {
                            cachedUserDatas[cachedIndex] = updatedData;
                        }
                    }
                }
            }

            if (leveledUpUsers.length === 0) {
                continue;
            }

            await this.levelUpService.handleLevelUpsForGuild(guild, guildData, leveledUpUsers);
        }
    }

    /**
     * Clear the cache for a specific guild or all guilds
     * @param guildId The guild ID to clear the cache for, or undefined to clear all caches
     */
    public static clearGuildUserDataCache(guildId?: string): void {
        if (guildId) {
            GiveVoiceXpJob.guildUserDataCache.delete(guildId);
        } else {
            GiveVoiceXpJob.guildUserDataCache.clear();
        }
    }
}
