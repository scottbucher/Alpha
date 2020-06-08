import { Client } from 'discord.js';

import { Logger } from '../services';
import { GuildRepo, RewardRepo, UserRepo } from '../services/database/repos';
import { XpUtils } from '../utils';
import { Job } from './job';

let Config = require('../../config/config.json');

export class TrackVoiceXp implements Job {
    constructor(
        private client: Client,
        private guildRepo: GuildRepo,
        private userRepo: UserRepo,
        private rewardRepo: RewardRepo
    ) {}

    public async run(): Promise<void> {
        let guildList = this.client.guilds.cache;

        // Get guild data from database

        for (let guild of guildList.array()) {
            try {
                // let guildVoiceStates = guild.voiceStates.cache.array();
                let guildVoiceStates = guild.voiceStates.cache
                    .array()
                    .filter(
                        voiceState =>
                            !voiceState.member.user.bot && voiceState.channel !== guild.afkChannel
                    ); // Filter out the bots and afk channels first

                for (let memberVoiceState of guildVoiceStates) {
                    let member = memberVoiceState.member;

                    if (memberVoiceState.channel != null) {
                        let userData = await this.userRepo.getUser(member.id, guild.id);

                        let playerXp = userData.XpAmount;
                        let currentLevel = XpUtils.getLevelFromXp(playerXp); // Get current level

                        playerXp += Config.xp.voiceXp;

                        // Update User
                        await this.userRepo.updateUser(member.id, guild.id, playerXp);

                        let newLevel = XpUtils.getLevelFromXp(playerXp); // Get new level
                        if (XpUtils.isLevelUp(currentLevel, newLevel)) {
                            // xpLevelup instance
                            XpUtils.onLevelUp(member, newLevel, this.guildRepo, this.rewardRepo);
                        }
                    }
                }
            } catch (error) {
                Logger.error(
                    `Failed while giving xp to members in the guild: ${guild.name} (ID: ${guild.id})`,
                    error
                );
                continue;
            }
        }
    }
}
