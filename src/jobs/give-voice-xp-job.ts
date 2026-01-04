import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Client } from 'discord.js';
import { createRequire } from 'node:module';

import { Job } from './index.js';
import { GuildData, GuildUserData } from '../database/entities/index.js';
import { LevelUpService, Logger } from '../services/index.js';
import { DatabaseUtils, ExperienceUtils, GuildUserDataCache } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

export class GiveVoiceXpJob extends Job {
    public name = 'Give Voice XP';
    public schedule: string = Config.jobs.giveVoiceXp.schedule;
    public log: boolean = Config.jobs.giveVoiceXp.log;
    public runOnce: boolean = Config.jobs.giveVoiceXp.runOnce;
    public initialDelaySecs: number = Config.jobs.giveVoiceXp.initialDelaySecs;

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
            const cachedData = GuildUserDataCache.get(guild.id);

            if (cachedData) {
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
                } else {
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
                const result = await DatabaseUtils.getOrCreateDataForGuild(em, guild, voiceUserIds);
                guildData = result.GuildData;
                guildUserDatas = result.GuildUserData;
            }

            // Update cache if needed
            if (shouldUpdateCache) {
                GuildUserDataCache.set(guild.id, guildData, guildUserDatas);
            }

            let leveledUpUsers: { userId: string; oldLevel: number; newLevel: number }[] = [];
            let updatedGuildUserDatas: GuildUserData[] = [];

            for (let voiceState of guildVoiceStates) {
                let guildUserData = guildUserDatas.find(
                    userData => userData.userDiscordId === voiceState.member.id && voiceState
                );
                if (guildUserData) {
                    let memberXpBefore = guildUserData.experience;
                    let memberLevelBefore = ExperienceUtils.getLevelFromXp(memberXpBefore);

                    let currentVoiceChannelMembers = guild.voiceStates.cache
                        .filter(vs => vs.channelId === voiceState.channelId)
                        .filter(vs => !vs.member.user.bot).size;

                    let xpGranted = ExperienceUtils.generateVoiceXp(
                        voiceState.member,
                        currentVoiceChannelMembers,
                        await ExperienceUtils.getXpMultiplier(guildData)
                    );

                    guildUserData.experience += xpGranted;

                    Logger.info(
                        Logs.info.voiceXpGranted
                            .replaceAll('{GUILD_ID}', guild.id)
                            .replaceAll('{GUILD_NAME}', guild.name)
                            .replaceAll('{USER_ID}', voiceState.member.id)
                            .replaceAll('{USER_NAME}', voiceState.member.user.username)
                            .replaceAll('{XP_GRANTED}', xpGranted)
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
                    Logger.error(
                        Logs.error.noGuildUserDataDuringVoiceXp
                            .replace('{GUILD_ID}', guild.id)
                            .replace('{USER_ID}', voiceState.member.id)
                    );
                }
            }

            // Persist all updated guild user data in a single batch
            if (updatedGuildUserDatas.length > 0) {
                await em.persistAndFlush(updatedGuildUserDatas);

                // Update the shared cache with the new values
                for (const updatedData of updatedGuildUserDatas) {
                    GuildUserDataCache.updateUserData(
                        guild.id,
                        updatedData.userDiscordId,
                        updatedData
                    );
                }
            }

            if (leveledUpUsers.length === 0) {
                continue;
            }

            await this.levelUpService.handleLevelUpsForGuild(guild, guildData, leveledUpUsers);
        }
    }
}
