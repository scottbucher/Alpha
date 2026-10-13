import { MikroORM } from '@mikro-orm/core';
import { MongoDriver, MongoEntityManager } from '@mikro-orm/mongodb';
import { Client, Guild, VoiceState } from 'discord.js';
import { createRequire } from 'node:module';

import { Job } from './index.js';
import { GuildData, GuildUserData } from '../database/entities/index.js';
import { LevelUpService, Logger, MilestoneService } from '../services/index.js';
import { ExperienceUtils, GuildUserDataCache, StatisticsUtils, TimeUtils } from '../utils/index.js';

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
        private levelUpService: LevelUpService,
        private milestoneService: MilestoneService
    ) {
        super();
    }

    public async run(): Promise<void> {
        let guildList = this.client.guilds.cache;
        let em = this.orm.em.fork() as MongoEntityManager<MongoDriver>;

        for (let guild of guildList.values()) {
            let guildVoiceStates = this.filterValidVoiceStates(
                [...guild.voiceStates.cache.values()],
                guild
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

            // Get data from cache
            const cachedData = await GuildUserDataCache.get(guild, voiceUserIds);

            guildData = cachedData.guildData;
            guildUserDatas = cachedData.guildUserDatas;

            const dayString = TimeUtils.getNowForGuild(guildData).toISODate();
            const minutesIncrement = Config.jobs.giveVoiceXp.minutesPerRun;

            let leveledUpUsers: { userId: string; oldLevel: number; newLevel: number }[] = [];
            let xpChangedUsers: { userId: string; oldXp: number; newXp: number }[] = [];
            let updatedGuildUserDatas: GuildUserData[] = [];

            for (let voiceState of guildVoiceStates) {
                let guildUserData = guildUserDatas.find(
                    userData => userData.userDiscordId === voiceState.member.id && voiceState
                );
                if (guildUserData) {
                    let startingXp = guildUserData.experience;

                    let currentVoiceChannelMembers = guild.voiceStates.cache.filter(
                        vs => vs.channelId === voiceState.channelId
                    );

                    let numberOfValidVoiceChannelMembers = this.filterValidVoiceStates(
                        [...currentVoiceChannelMembers.values()],
                        guild
                    ).length;

                    let xpGranted = ExperienceUtils.generateVoiceXp(
                        voiceState.member,
                        numberOfValidVoiceChannelMembers,
                        await ExperienceUtils.getXpMultiplier(guildData)
                    );

                    // Phase 2: persist daily stats via atomic upsert (Mongo update pipeline)
                    StatisticsUtils.queueVoiceMinutesForGuild(guild.id, {
                        guildUserObjectId: guildUserData._id,
                        dayString,
                        minutesIncrement,
                        startingXp,
                        createdIso: TimeUtils.now().toISO(),
                    });

                    // Read right before granting, message XP can update this shared cached entity
                    // during the await above, which would otherwise announce a level up or milestone twice
                    let memberXpBefore = guildUserData.experience;
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
                    xpChangedUsers.push({
                        userId: voiceState.member.id,
                        oldXp: memberXpBefore,
                        newXp: memberXpAfter,
                    });

                    let hasLeveledUp = ExperienceUtils.hasLeveledUp(memberXpBefore, memberXpAfter);
                    if (hasLeveledUp) {
                        leveledUpUsers.push({
                            userId: voiceState.member.id,
                            oldLevel: ExperienceUtils.getLevelFromXp(memberXpBefore), // not sure I need this, only scenario I can think of where we would is if they leveled up multiple times, is that possible?
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

            // Flush stats once per guild per run (bulk write)
            await StatisticsUtils.flushVoiceMinutesForGuild(em, guild.id, true);

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

            if (xpChangedUsers.length === 0) {
                continue;
            }

            // The cached guild data is not reloaded while the guild is active, so load fresh settings.
            // A separate fork avoids identity map conflicts with the cached guild data.
            let freshGuildData =
                (await this.orm.em.fork().findOne(GuildData, { discordId: guild.id })) ?? guildData;

            if (leveledUpUsers.length > 0) {
                try {
                    await this.levelUpService.handleLevelUpsForGuild(
                        guild,
                        freshGuildData,
                        leveledUpUsers
                    );
                } catch (error) {
                    Logger.error(
                        Logs.error.levelUpGuildError.replaceAll('{GUILD_ID}', guild.id),
                        error
                    );
                }
            }

            await this.milestoneService.handleMilestonesForGuild(
                guild,
                freshGuildData,
                xpChangedUsers
            );
        }
    }

    private filterValidVoiceStates(voiceStates: VoiceState[], guild: Guild): VoiceState[] {
        return voiceStates.filter(
            voiceState =>
                voiceState.channelId &&
                !voiceState.member.user.bot &&
                voiceState.channel !== guild.afkChannel &&
                voiceState.selfDeaf === false
        );
    }
}
