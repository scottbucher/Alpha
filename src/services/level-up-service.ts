import { Guild, Role, TextChannel } from 'discord.js';
import { GuildData } from '../database/entities/index.js';
import {
    ActionUtils,
    ClientUtils,
    FormatUtils,
    MessageUtils,
    PermissionUtils,
} from '../utils/index.js';
import { Language } from '../models/enum-helpers/index.js';
import { Lang, Logger } from './index.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let Logs = require('../../lang/logs.json');

export class LevelUpService {
    public async handleLevelUpsForGuild(
        guild: Guild,
        guildData: GuildData,
        leveledUpUsers: { userId: string; oldLevel: number; newLevel: number }[]
    ): Promise<void> {
        let levelingChannel = await ClientUtils.getConfiguredTextChannelIfExists(
            guild,
            guildData.levelingSettings.channelDiscordId
        );

        let allNewLevels = new Set(leveledUpUsers.map(user => user.newLevel));

        await guildData.levelingRewardDatas.init();
        let levelUpRewardDatas = guildData.levelingRewardDatas.getItems();

        let guildRoles = levelUpRewardDatas.length > 0 ? await guild.roles.fetch() : new Map();

        // Create a map of level -> roles for quicker lookups
        const roleToLevelMap = new Map<number, Role[]>();

        // Pre-populate the map with empty arrays for all levels that users leveled up to
        for (const level of allNewLevels) {
            roleToLevelMap.set(level, []);
        }

        // Add roles to the appropriate levels
        for (const reward of levelUpRewardDatas) {
            for (const roleId of reward.roleDiscordIds) {
                const role = guildRoles.get(roleId);
                if (role) {
                    roleToLevelMap.get(reward.level)?.push(role);
                }
            }
        }

        for (const leveledUpUser of leveledUpUsers) {
            let levelUpMessage: string;
            const level = leveledUpUser.newLevel;
            const roles = roleToLevelMap.get(level);
            const givenRoles: Role[] = [];

            if (roles.length > 0) {
                const member = await guild.members.fetch(leveledUpUser.userId);

                // I have a function to give multiple roles to a member, but cache inconsistencies can cause it to remove all roles from a member.
                // Related discord api issue: https://github.com/discord/discord-api-docs/discussions/7398
                for (const role of roles) {
                    await ActionUtils.giveRole(member, role);
                    givenRoles.push(role);
                }

                let rolesNotGiven = roles.filter(role => !givenRoles.includes(role));

                if (rolesNotGiven.length > 0) {
                    Logger.error(
                        Logs.error.failedToAssignRolesForLevel
                            .replaceAll('{ROLE_IDS}', rolesNotGiven.map(role => role.id).join(', '))
                            .replaceAll('{USER_ID}', leveledUpUser.userId)
                            .replaceAll('{LEVEL}', level.toString())
                    );
                }
                let newRoleNames = givenRoles.map(role => role.toString());

                levelUpMessage = Lang.getRef('info', 'events.levelUpWithRoles', Language.Default, {
                    USER_MENTION: FormatUtils.userMention(leveledUpUser.userId),
                    LEVEL: leveledUpUser.newLevel.toString(),
                    ROLES: FormatUtils.joinWithAnd(newRoleNames, Language.Default),
                    PLURAL: leveledUpUser.newLevel === 1 ? '' : Lang.getCom('plurals.s'),
                });
            } else {
                levelUpMessage = Lang.getRef('info', 'events.levelUp', Language.Default, {
                    USER_MENTION: FormatUtils.userMention(leveledUpUser.userId),
                    LEVEL: level.toString(),
                });
            }

            if (levelingChannel) await MessageUtils.send(levelingChannel, levelUpMessage);
        }
    }
}
