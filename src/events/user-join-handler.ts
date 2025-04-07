import { Guild, GuildMember, Role, TextChannel } from 'discord.js';
import { createRequire } from 'node:module';

import { EventHandler } from './index.js';
import { Lang, Logger } from '../services/index.js';
import { ActionUtils, ClientUtils, DatabaseUtils, MessageUtils } from '../utils/index.js';
import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Language } from '../models/enum-helpers/index.js';

const require = createRequire(import.meta.url);
let Logs = require('../../lang/logs.json');

export class UserJoinHandler implements EventHandler {
    constructor(private orm: MikroORM<MongoDriver>) {}

    public async process(member: GuildMember, guild: Guild): Promise<void> {
        Logger.info(
            Logs.info.userJoinedServer
                .replaceAll('{USER_NAME}', member.user.globalName)
                .replaceAll('{USER_ID}', member.id)
                .replaceAll('{GUILD_NAME}', guild.name)
                .replaceAll('{GUILD_ID}', guild.id)
        );

        let em = this.orm.em.fork();

        let { GuildData: guildData, GuildUserData: _ } =
            await DatabaseUtils.getOrCreateDataForGuild(em, guild, [member.id]);

        let welcomeChannel = guildData.welcomeSettings.channelDiscordId;
        let joinRoles = guildData.welcomeSettings.joinRoleDiscordIds;

        let channel = await ClientUtils.getConfiguredTextChannelIfExists(guild, welcomeChannel);

        if (channel) {
            await MessageUtils.send(
                channel,
                Lang.getEmbed('info', 'embeds.welcomeMember', Language.Default, {
                    GUILD_NAME: guild.name,
                    USER_MENTION: member.toString(),
                    USER_NAME: member.user.globalName,
                    ICON: member.user.avatarURL(),
                })
            );
        }

        if (joinRoles.length > 0) {
            let guildRoles = await guild.roles.fetch();
            let givenRoles: Role[] = [];
            let resovledRoles: Role[] = [];

            for (const roleId of joinRoles) {
                let role = guildRoles.get(roleId);
                if (role) {
                    resovledRoles.push(role);
                }
            }

            // I have a function to give multiple roles to a member, but cache inconsistencies can cause it to remove all roles from a member.
            // Related discord api issue: https://github.com/discord/discord-api-docs/discussions/7398
            for (const role of resovledRoles) {
                await ActionUtils.giveRole(member, role);
                givenRoles.push(role);
            }

            let rolesNotGiven = resovledRoles.filter(role => !givenRoles.includes(role));

            if (rolesNotGiven.length > 0) {
                Logger.error(
                    Logs.error.failedToAssignRolesOnJoin
                        .replaceAll('{USER_ID}', member.id)
                        .replaceAll('{ROLE_IDS}', rolesNotGiven.map(role => role.id).join(', '))
                        .replaceAll('{GUILD_NAME}', guild.name)
                        .replaceAll('{GUILD_ID}', guild.id)
                );
            }
        }
    }
}
