import { GuildMember, TextChannel } from 'discord.js';

import { ActionUtils } from './action-utils';
import { FormatUtils } from './format-utils';
import { GuildRepo } from '../services/database/repos/guild-repo';
import { MessageUtils } from './message-utils';
import { RewardRepo } from '../services/database/repos/reward-repo';
import moment from 'moment';

export abstract class XpUtils {
    public static getLevelXp(level: number): number {
        return 5 * (level * level) + 50 * level + 100;
    }

    public static getLevelFromXp(xp: number): number {
        let level = 0;

        while (xp >= this.getLevelXp(level)) {
            xp -= this.getLevelXp(level);
            level++;
        }

        return level;
    }

    public static getPlayerLevelXp(level: number): number {
        let xp = 0;
        for (let i = 0; i < level; i++) {
            xp += this.getLevelXp(i);
        }
        return xp;
    }

    public static getXpTowardsNextLevel(xp: number): number {
        return xp - this.getPlayerLevelXp(this.getLevelFromXp(xp)); // I don't know why minus 1 works but it does
    }

    public static randomXp(): number {
        return Math.round(Math.random() * (25 - 15) + 15);
    }

    public static canGetXp(LastUpdated: string): boolean {
        return moment().isAfter(moment(LastUpdated).add(1, 'minute'));
    }

    public static isLevelUp(currentLevel, newLevel: number): boolean {
        return newLevel > currentLevel;
    }

    public static async onLevelUp(
        member: GuildMember,
        newLevel: number,
        guildRepo: GuildRepo,
        rewardRepo: RewardRepo
    ): Promise<void> {
        let levelingChannel: TextChannel;
        let guildData = await guildRepo.getGuild(member.guild.id);
        try {
            levelingChannel = member.guild.channels.resolve(
                guildData.LevelingChannelId
            ) as TextChannel;
        } catch (error) {
            // Can't find the leveling channel.
            return;
        }

        let newRoleIds = (await rewardRepo.getLevelRewards(member.guild.id, newLevel)).map(
            levelReward => levelReward.RoleDiscordId
        );

        // Check if any new roles were unlocked
        if (newRoleIds.length === 0) {
            await levelingChannel.send(
                `**Congratulations** <@${member.id}> you've reached level __**${newLevel}**__`
            );
            return;
        }

        // Give new roles
        for (let newRoleId of newRoleIds) {
            ActionUtils.giveRole(member, member.guild.roles.resolve(newRoleId));
        }

        // Let the user know
        let newRoleNames = newRoleIds.map(newRoleId =>
            MessageUtils.getRoleName(newRoleId, member.guild)
        );

        let newRolesList = FormatUtils.joinWithAnd(newRoleNames);

        await levelingChannel.send(
            `**Congratulations** <@${member.id}> you've reached level __**${newLevel}**__ and have unlocked the following role(s): ${newRolesList}!`
        );
    }
}
