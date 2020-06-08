import { EventHandler } from './event-handler';
import { Guild } from 'discord.js';
import { GuildRepo } from '../services/database/repos/guild-repo';
import { Logger } from '../services';

let Logs = require('../../lang/logs.json');

export class GuildJoinHandler implements EventHandler {
    constructor(private guildRepo: GuildRepo) {}

    public async process(guild: Guild): Promise<void> {
        Logger.info(
            Logs.info.syncingGuild
                .replace('{GUILD_NAME}', guild.name)
                .replace('{GUILD_ID}', guild.id)
        );

        this.guildRepo.syncGuild(guild.id, guild.members.cache.keyArray());

        Logger.info(
            Logs.info.syncedGuild
                .replace('{GUILD_NAME}', guild.name)
                .replace('{GUILD_ID}', guild.id)
        );
    }
}
