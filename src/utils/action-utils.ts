import {
    Collection,
    DiscordAPIError,
    RESTJSONErrorCodes as DiscordApiErrors,
    Guild,
    GuildMember,
    Role,
    RoleResolvable,
    Snowflake,
    User,
} from 'discord.js';
import { createRequire } from 'node:module';

import { TimeUtils } from './index.js';
import { Logger } from '../services/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

const IGNORED_ERRORS = [
    DiscordApiErrors.UnknownMessage,
    DiscordApiErrors.UnknownMember,
    DiscordApiErrors.UnknownChannel,
    DiscordApiErrors.UnknownGuild,
    DiscordApiErrors.UnknownUser,
    DiscordApiErrors.UnknownInteraction,
    DiscordApiErrors.CannotSendMessagesToThisUser, // User blocked bot or DM disabled
    DiscordApiErrors.ReactionWasBlocked, // User blocked bot or DM disabled
    DiscordApiErrors.MaximumActiveThreads,
    DiscordApiErrors.UnknownRole, // Since we resolve the roles idk why this would be thrown
    DiscordApiErrors.MissingPermissions, // Since we check permissions idk why this would be thrown
];

export class ActionUtils {
    public static async giveRole(
        member: GuildMember,
        role: Role,
        delay?: number
    ): Promise<GuildMember> {
        // check if the member already has the role
        const hasRole = member.roles.cache.has(role.id);
        if (hasRole) {
            Logger.warn(
                `We are trying to give a role to a member that already has it: ${member.user.tag} (${member.id}) in guild ${member.guild.id} role ${role.id}`
            );
            return;
        }

        delay = Config.delays.enabled ? delay : 0;
        try {
            member = await member.roles.add(role);
            await TimeUtils.sleep(delay ?? 0);
            return member;
        } catch (error) {
            if (
                error instanceof DiscordAPIError &&
                typeof error.code == 'number' &&
                IGNORED_ERRORS.includes(error.code)
            ) {
                return;
            } else {
                throw error;
            }
        }
    }

    public static async removeRole(
        member: GuildMember,
        roles: Role,
        delay?: number
    ): Promise<void> {
        delay = Config.delays.enabled ? delay : 0;

        // check if the member does not have the role
        const hasRole = member.roles.cache.has(roles.id);
        if (!hasRole) {
            Logger.warn(
                `We are trying to remove a role from a member that does not have it: ${member.user.tag} (${member.id}) in guild ${member.guild.id} role ${roles.id}`
            );
            return;
        }

        try {
            await member.roles.remove(roles);
            await TimeUtils.sleep(delay ?? 0);
        } catch (error) {
            if (
                error instanceof DiscordAPIError &&
                typeof error.code == 'number' &&
                IGNORED_ERRORS.includes(error.code)
            ) {
                return;
            } else {
                throw error;
            }
        }
    }

    public static async fetchMember(user: User, guild: Guild): Promise<GuildMember> {
        try {
            return await guild.members.fetch(user);
        } catch (error) {
            if (
                error instanceof DiscordAPIError &&
                typeof error.code == 'number' &&
                IGNORED_ERRORS.includes(error.code)
            ) {
                return;
            } else {
                throw error;
            }
        }
    }

    // THIS SHOULD RARELY BE USED SINCE PATCH GUILD MEMBER CAN RESULT IN LOSS OF ROLES WHEN GuildMemberRoleManager#cache IS NOT UP TO DATE
    public static async addAndRemoveRoles(
        member: GuildMember,
        rolesToAdd: string[],
        rolesToRemove: string[],
        delay?: number
    ): Promise<GuildMember> {
        delay = Config.delays.enabled ? delay : 0;
        try {
            member = await this.modifyRoles(rolesToAdd, rolesToRemove, member);
            await TimeUtils.sleep(delay ?? 0);
            return member;
        } catch (error) {
            if (
                error instanceof DiscordAPIError &&
                typeof error.code == 'number' &&
                IGNORED_ERRORS.includes(error.code)
            ) {
                return;
            } else {
                throw error;
            }
        }
    }

    /**
     * Modifies the roles of the member.
     * @param {RoleResolvable[]} roleIdsToAdd The role ids to add
     * @param {RoleResolvable[]} roleIdsToRemove The role or roles to remove
     * @param {string} [reason] Reason for modifying the roles
     * @returns {Promise<GuildMember>}
     */
    private static async modifyRoles(
        roleIdsToAdd: RoleResolvable[] | Collection<Snowflake, Role>,
        roleIdsToRemove: RoleResolvable[] | Collection<Snowflake, Role>,
        member: GuildMember,
        reason?: any
    ): Promise<GuildMember> {
        const resolvedRolesToAdd = this.resolveRoles(roleIdsToAdd, member.guild);
        const resolvedRolesToRemove = this.resolveRoles(roleIdsToRemove, member.guild);

        const currentRoles = new Set(member.roles.cache.keys());
        for (const role of resolvedRolesToAdd) {
            currentRoles.add(role.id);
        }
        for (const role of resolvedRolesToRemove) {
            currentRoles.delete(role.id);
        }

        return await member.roles.set([...currentRoles], reason);
    }

    /**
     * Resolves roles from the input.
     * @param {RoleResolvable[] | Collection<Snowflake, Role>} rolesToResolve The roles to resolve
     * @param {Guild} guild The guild to resolve the roles in
     * @returns {Array} The resolved roles
     */
    private static resolveRoles(
        rolesToResolve: RoleResolvable[] | Collection<Snowflake, Role>,
        guild: Guild
    ): Role[] {
        const resolvedRoles = [];
        for (const role of rolesToResolve.values()) {
            const resolvedRole = guild.roles.resolve(role);
            if (!resolvedRole) {
                throw new Error(`InvalidElement: Array or Collection: roles: ${role}`);
            }
            resolvedRoles.push(resolvedRole);
        }
        return resolvedRoles;
    }
}
