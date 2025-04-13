import { Guild, User } from 'discord.js';

import { Language } from '../models/enum-helpers/language.js';
import { EventData } from '../models/internal-models.js';
import { Loaded, MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { GuildData } from '../database/entities/guild.js';
import { GuildUserData, LevelingRewardData } from '../database/entities/index.js';
import { EventDataType } from '../enums/index.js';
import { DatabaseUtils } from '../utils/index.js';
import { Logger } from './index.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let Logs = require('../../lang/logs.json');

export class EventDataService {
    constructor(private orm: MikroORM<MongoDriver>) {}

    public async create(
        options: {
            target?: User;
            guild?: Guild;
            requireEventData?: EventDataType[];
            args?: {
                levelingRewardAlias?: string;
            };
        } = {}
    ): Promise<EventData> {
        let em = this.orm.em.fork();

        let guildData: Loaded<GuildData>;
        if (options.guild) {
            guildData = await em.findOne(GuildData, { discordId: options.guild.id });
            if (guildData) {
                await em.flush();
            }
        }

        let levelingRewardDatas: Loaded<LevelingRewardData, 'guild'>;

        if (options.args) {
            if (options.args.levelingRewardAlias) {
                levelingRewardDatas = await em.findOne(LevelingRewardData, {
                    alias: options.args.levelingRewardAlias,
                    guildDiscordId: options.guild.id,
                });
            }
        }

        let guildUserData: Loaded<GuildUserData>;
        if (options.requireEventData?.includes(EventDataType.GUILD_USER_DATA)) {
            let target = options.target;

            if (!target) {
                Logger.error(Logs.error.noUser);
                throw new Error('No target user provided');
            }

            guildUserData = await em.findOne(GuildUserData, {
                guildDiscordId: options.guild.id,
                userDiscordId: target.id,
            });

            if (!guildUserData) {
                let { GuildUserData: newGuildUserDatas, GuildData: _ } =
                    await DatabaseUtils.createGuildUserDatas(
                        em,
                        options.guild.id,
                        [target.id],
                        guildData
                    );
                guildUserData = newGuildUserDatas[0];
            }
        }

        // Event language
        let lang =
            options.guild?.preferredLocale &&
            Language.Enabled.includes(options.guild.preferredLocale)
                ? options.guild.preferredLocale
                : Language.Default;

        // Guild language
        let langGuild =
            options.guild?.preferredLocale &&
            Language.Enabled.includes(options.guild.preferredLocale)
                ? options.guild.preferredLocale
                : Language.Default;

        return new EventData(lang, langGuild, em, guildData, levelingRewardDatas, guildUserData);
    }
}
