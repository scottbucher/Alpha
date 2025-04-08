import { Client } from 'discord.js';
import { createRequire } from 'node:module';

import { Job } from './index.js';
import { LevelUpService, Logger } from '../services/index.js';
import { DatabaseUtils } from '../utils/index.js';
import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { GuildData } from '../database/entities/index.js';
import { ExperienceUtils } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

// TODO: This job runs every minute so we are constantly fetching this from the database. A robust cache system would be ideal.
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
            guild = await guild.fetch();
            let guildVoiceStates = [...guild.voiceStates.cache.values()].filter(
                voiceState => !voiceState.member.user.bot && voiceState.channel !== guild.afkChannel
            ); // Filter out the bots and afk channels first

            // If there are no voice states, we can skip this guild
            if (guildVoiceStates.length === 0) {
                continue;
            }

            // Get all the GuildUserData objects for this guild but only the for the GuildMembers that are in the voiceState array
            let voiceUserIds = guildVoiceStates.map(voiceState => voiceState.member.id);

            let { GuildData: guildData, GuildUserData: guildUserDatas } =
                await DatabaseUtils.getOrCreateDataForGuild(em, guild, voiceUserIds);

            let leveledUpUsers: { userId: string; oldLevel: number; newLevel: number }[] = [];

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
                    await em.persistAndFlush(guildUserData);

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

            if (leveledUpUsers.length === 0) {
                return;
            }

            if (!guildData) {
                guildData = await em.findOne(GuildData, { discordId: guild.id });
            }

            await this.levelUpService.handleLevelUpsForGuild(guild, guildData, leveledUpUsers);
        }
    }
}
