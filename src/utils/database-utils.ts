import { ref } from '@mikro-orm/core';
import { MongoDriver, MongoEntityManager } from '@mikro-orm/mongodb';
import { GuildData, GuildUserData, UserData } from '../database/entities/index.js';
import { Guild } from 'discord.js';
import { ClientUtils, TimeUtils } from './index.js';
export class DatabaseUtils {
    /**
     * This is a robust function that serves multiple purposes:
     * Since a GuildUserData references a GuildData and a UserData, both must be created in order to create a GuildUserData.
     * Due to this, we can use this function for setting up a new guild, getting/creating all guild user data for a guild, or getting/creating the guild user data for a specific user.
     * @param em - The entity manager to use
     * @param guild - The guild to get or create data for
     * @param memberIdListOverride - An optional list of member IDs to override the default list of guild members
     * @returns An object containing the guild data and an array of guild user data
     */
    public static async getOrCreateDataForGuild(
        em: MongoEntityManager<MongoDriver>,
        guild: Guild,
        memberIdListOverride?: string[],
        guildData?: GuildData
    ): Promise<{ GuildData: GuildData; GuildUserData: GuildUserData[] }> {
        if (!guildData) {
            guildData = await em.findOne(GuildData, { discordId: guild.id });
        }

        let hadGuildData = guildData !== null;

        if (!hadGuildData) {
            // Add new guild data
            guildData = new GuildData(guild.id);
            await em.persistAndFlush(guildData);
        }

        let guildUserDatas: GuildUserData[] = [];
        let guildMemberIds = [
            ...(memberIdListOverride ?? ClientUtils.getAllMemberIds(guild, true)),
        ];

        // If it never had a guild data, it could have never had any guild user datas, it would violate the unique constraint
        if (!hadGuildData) {
            let { GuildUserData: newGuildUserDatas, GuildData: _ } =
                await DatabaseUtils.createGuildUserDatas(em, guild.id, guildMemberIds);
            guildUserDatas = newGuildUserDatas;
        } else {
            guildUserDatas = await em.find(GuildUserData, {
                guildDiscordId: guild.id,
                userDiscordId: { $in: guildMemberIds },
            });

            let newGuildUserIds = guildMemberIds.filter(
                id => !guildUserDatas.some(data => data.userDiscordId === id)
            );

            if (newGuildUserIds.length > 0) {
                let { GuildUserData: newGuildUserDatas, GuildData: _ } =
                    await DatabaseUtils.createGuildUserDatas(
                        em,
                        guild.id,
                        newGuildUserIds,
                        guildData
                    );
                guildUserDatas.push(...newGuildUserDatas);
            }
        }

        return { GuildData: guildData, GuildUserData: guildUserDatas };
    }

    public static async createGuildUserDatas(
        em: MongoEntityManager<MongoDriver>,
        guildId: string,
        userIds: string[],
        guildData?: GuildData
    ): Promise<{ GuildUserData: GuildUserData[]; GuildData: GuildData }> {
        if (userIds.length === 0) {
            return { GuildUserData: [], GuildData: null };
        }

        if (!guildData) {
            guildData = await em.findOne(GuildData, { discordId: guildId });
        }

        // Batch fetch all users at once instead of one by one
        const existingUserDatas = await em.find(UserData, { discordId: { $in: userIds } });

        // Create a map for quick lookups
        const userDataMap = new Map<string, UserData>();
        existingUserDatas.forEach(userData => userDataMap.set(userData.discordId, userData));

        // Prepare arrays for new users and guild user data
        const newUserDatas: UserData[] = [];
        const guildUserDatas: GuildUserData[] = [];

        // Process all users
        for (const userId of userIds) {
            let userData = userDataMap.get(userId);

            // Create new UserData if it doesn't exist
            if (!userData) {
                userData = new UserData(userId);
                newUserDatas.push(userData);
                userDataMap.set(userId, userData);
            }

            // Create GuildUserData for each user
            const guildUserData = new GuildUserData(
                ref(guildData),
                ref(userData),
                0,
                TimeUtils.now().toISO()
            );

            // Set the guild and user discord IDs for the unique constraint
            guildUserData.guildDiscordId = guildId;
            guildUserData.userDiscordId = userId;

            guildData.userDatas.add(guildUserData);
            userData.guildDatas.add(guildUserData);
            guildUserDatas.push(guildUserData);
        }

        // Persist new users if any were created
        if (newUserDatas.length > 0) {
            await em.persistAndFlush(newUserDatas);
        }

        // Persist all guild user data entries
        await em.persistAndFlush(guildUserDatas);

        return { GuildUserData: guildUserDatas, GuildData: guildData };
    }
}
