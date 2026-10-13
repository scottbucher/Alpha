import { Collection, Guild, Role, Snowflake, TextChannel } from 'discord.js';
import { createRequire } from 'node:module';

import { Lang, Logger } from './index.js';
import { GuildData, MilestoneSettings, XpMilestone } from '../database/entities/index.js';
import { Language } from '../models/enum-helpers/index.js';
import {
    ActionUtils,
    ClientUtils,
    ExperienceUtils,
    FormatUtils,
    MessageUtils,
} from '../utils/index.js';

const require = createRequire(import.meta.url);
let Logs = require('../../lang/logs.json');

export class MilestoneService {
    /**
     * Grant milestone roles and announce XP milestones crossed by users in a guild.
     * Never throws, so XP granting is not affected by failures here.
     * @param guild The guild the XP was granted in
     * @param guildData The guild's data
     * @param users The users that were granted XP, with their XP before and after the grant
     */
    public async handleMilestonesForGuild(
        guild: Guild,
        guildData: GuildData,
        users: { userId: string; oldXp: number; newXp: number }[]
    ): Promise<void> {
        try {
            let milestoneSettings = ExperienceUtils.getMilestoneSettings(guildData);

            let milestoneUsers = users
                .map(user => ({
                    userId: user.userId,
                    newXp: user.newXp,
                    crossed: ExperienceUtils.getMilestonesCrossed(
                        user.oldXp,
                        user.newXp,
                        milestoneSettings
                    ),
                }))
                .filter(user => user.crossed);

            if (milestoneUsers.length === 0) {
                return;
            }

            let milestoneChannel = await this.getMilestoneChannel(
                guild,
                guildData,
                milestoneSettings
            );

            let guildRoles = milestoneUsers.some(user => user.crossed.roleMilestones.length > 0)
                ? await guild.roles.fetch()
                : new Collection<Snowflake, Role>();

            for (let milestoneUser of milestoneUsers) {
                try {
                    let earnedRoles = await this.giveMilestoneRoles(
                        guild,
                        guildRoles,
                        milestoneUser.userId,
                        milestoneUser.crossed.roleMilestones
                    );

                    if (!milestoneChannel) {
                        continue;
                    }

                    let variables = {
                        USER_MENTION: FormatUtils.userMention(milestoneUser.userId),
                        XP: milestoneUser.crossed.highestXp.toLocaleString(),
                        LEVEL: ExperienceUtils.getLevelFromXp(milestoneUser.newXp).toString(),
                    };

                    let embed =
                        earnedRoles.length > 0
                            ? Lang.getEmbed(
                                  'info',
                                  'embeds.xpMilestoneWithRoles',
                                  Language.Default,
                                  {
                                      ...variables,
                                      ROLES: FormatUtils.joinWithAnd(
                                          earnedRoles.map(role => role.toString()),
                                          Language.Default
                                      ),
                                      PLURAL:
                                          earnedRoles.length === 1 ? '' : Lang.getCom('plurals.s'),
                                  }
                              )
                            : Lang.getEmbed(
                                  'info',
                                  'embeds.xpMilestone',
                                  Language.Default,
                                  variables
                              );

                    await MessageUtils.send(milestoneChannel, {
                        content: FormatUtils.userMention(milestoneUser.userId),
                        embeds: [embed],
                    });
                } catch (error) {
                    Logger.error(
                        Logs.error.milestoneUserError
                            .replaceAll('{USER_ID}', milestoneUser.userId)
                            .replaceAll('{GUILD_ID}', guild.id),
                        error
                    );
                }
            }
        } catch (error) {
            Logger.error(Logs.error.milestoneGuildError.replaceAll('{GUILD_ID}', guild.id), error);
        }
    }

    /**
     * Resolve the channel to announce milestones in: the milestone channel, falling back to the leveling channel.
     */
    private async getMilestoneChannel(
        guild: Guild,
        guildData: GuildData,
        milestoneSettings: MilestoneSettings
    ): Promise<TextChannel | null> {
        let channelIds = [
            milestoneSettings.channelDiscordId,
            guildData.levelingSettings?.channelDiscordId,
        ];

        for (let channelId of new Set(channelIds.filter(Boolean))) {
            try {
                let channel = await ClientUtils.getConfiguredTextChannelIfExists(guild, channelId);
                if (channel) {
                    return channel;
                }
            } catch {
                // The channel was likely deleted, try the next one
            }
        }

        return null;
    }

    /**
     * Give a user the roles of the milestones they crossed, skipping roles that no longer exist.
     * @returns The roles the user now has from the milestones
     */
    private async giveMilestoneRoles(
        guild: Guild,
        guildRoles: Collection<Snowflake, Role>,
        userId: string,
        roleMilestones: XpMilestone[]
    ): Promise<Role[]> {
        let roles = [
            ...new Set(
                roleMilestones
                    .map(milestone => guildRoles.get(milestone.roleDiscordId))
                    .filter(Boolean)
            ),
        ];
        if (roles.length === 0) {
            return [];
        }

        let member = await guild.members.fetch(userId);
        let earnedRoles: Role[] = [];
        let rolesNotGiven: Role[] = [];

        // Roles are given one at a time, see the comment in LevelUpService for why
        for (let role of roles) {
            if (member.roles.cache.has(role.id) || (await ActionUtils.giveRole(member, role))) {
                earnedRoles.push(role);
            } else {
                rolesNotGiven.push(role);
            }
        }

        if (rolesNotGiven.length > 0) {
            Logger.error(
                Logs.error.failedToAssignRolesForMilestone
                    .replaceAll('{ROLE_IDS}', rolesNotGiven.map(role => role.id).join(', '))
                    .replaceAll('{USER_ID}', userId)
                    .replaceAll('{GUILD_ID}', guild.id)
            );
        }

        return earnedRoles;
    }
}
