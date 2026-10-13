import {
    Collection,
    DiscordAPIError,
    RESTJSONErrorCodes as DiscordApiErrors,
    Guild,
    GuildMember,
    Role,
    Snowflake,
    TextChannel,
} from 'discord.js';
import { createRequire } from 'node:module';

import { Lang, Logger } from './index.js';
import { GuildData, XpMilestone } from '../database/entities/index.js';
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

            let { channel: milestoneChannel } = await MilestoneService.getAnnouncementChannel(
                guild,
                guildData
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
     * Resolve the channel milestones are announced in: the milestone channel, falling back to the leveling channel.
     * @param guild The guild to resolve the channel in
     * @param guildData The guild's data
     * @returns The channel, or null if neither channel is usable, and whether the leveling channel fallback was used
     */
    public static async getAnnouncementChannel(
        guild: Guild,
        guildData: GuildData
    ): Promise<{ channel: TextChannel | null; isFallback: boolean }> {
        let milestoneChannelId = guildData.milestoneSettings?.channelDiscordId;
        let milestoneChannel = await MilestoneService.getTextChannel(guild, milestoneChannelId);
        if (milestoneChannel) {
            return { channel: milestoneChannel, isFallback: false };
        }

        let levelingChannelId = guildData.levelingSettings?.channelDiscordId;
        let levelingChannel =
            levelingChannelId !== milestoneChannelId
                ? await MilestoneService.getTextChannel(guild, levelingChannelId)
                : null;
        return { channel: levelingChannel, isFallback: levelingChannel !== null };
    }

    private static async getTextChannel(
        guild: Guild,
        channelId?: string
    ): Promise<TextChannel | null> {
        if (!channelId) {
            return null;
        }

        try {
            return await ClientUtils.getConfiguredTextChannelIfExists(guild, channelId);
        } catch {
            // The channel was likely deleted
            return null;
        }
    }

    /**
     * Give a user the roles of the milestones they crossed, skipping roles that no longer exist,
     * roles the user already has, and users that have left the guild.
     * @returns The roles that were newly given to the user
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

        let member = await this.getMember(guild, userId);
        if (!member) {
            return [];
        }

        let earnedRoles: Role[] = [];
        let rolesNotGiven: Role[] = [];

        // Roles are given one at a time, see the comment in LevelUpService for why
        for (let role of roles) {
            if (member.roles.cache.has(role.id)) {
                continue;
            }

            if (await ActionUtils.giveRole(member, role)) {
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

    /**
     * Fetch a guild member, returning null if they are no longer in the guild.
     */
    private async getMember(guild: Guild, userId: string): Promise<GuildMember | null> {
        try {
            return await guild.members.fetch(userId);
        } catch (error) {
            if (error instanceof DiscordAPIError && error.code === DiscordApiErrors.UnknownMember) {
                return null;
            }
            throw error;
        }
    }
}
