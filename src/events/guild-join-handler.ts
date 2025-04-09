import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Guild } from 'discord.js';
import { createRequire } from 'node:module';

import { EventHandler } from './index.js';
import { EventDataService, Lang, Logger } from '../services/index.js';
import { ClientUtils, DatabaseUtils, FormatUtils, MessageUtils } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Logs = require('../../lang/logs.json');

export class GuildJoinHandler implements EventHandler {
    constructor(
        private orm: MikroORM<MongoDriver>,
        private eventDataService: EventDataService
    ) {}

    public async process(guild: Guild): Promise<void> {
        Logger.info(
            Logs.info.guildJoined
                .replaceAll('{GUILD_NAME}', guild.name)
                .replaceAll('{GUILD_ID}', guild.id)
        );

        let em = this.orm.em.fork();

        await DatabaseUtils.getOrCreateDataForGuild(em, guild);

        let owner = await guild.fetchOwner();

        // Get data from database
        let data = await this.eventDataService.create({
            guild,
        });

        // Send welcome message to the server's notify channel
        let notifyChannel = await ClientUtils.findNotifyChannel(guild, data.langGuild);
        if (notifyChannel) {
            await MessageUtils.send(
                notifyChannel,
                Lang.getEmbed('info', 'embeds.welcome', data.langGuild, {
                    CMD_LINK_HELP: await FormatUtils.commandMention(guild.client, 'help'),
                    HELP_DESCRIPTION: Lang.getRef('commands', 'commandDescs.help', data.lang),
                }).setAuthor({
                    name: guild.name,
                    iconURL: guild.iconURL(),
                })
            );
        }

        // Send welcome message to owner
        if (owner) {
            await MessageUtils.send(
                owner.user,
                Lang.getEmbed('info', 'embeds.welcome', data.lang, {
                    CMD_LINK_HELP: await FormatUtils.commandMention(guild.client, 'help'),
                    HELP_DESCRIPTION: Lang.getRef('commands', 'commandDescs.help', data.lang),
                }).setAuthor({
                    name: guild.name,
                    iconURL: guild.iconURL(),
                })
            );
        }
    }
}
