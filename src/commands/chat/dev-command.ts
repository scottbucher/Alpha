import djs, { ChatInputCommandInteraction, PermissionsString } from 'discord.js';
import { createRequire } from 'node:module';
import os from 'node:os';
import typescript from 'typescript';

import { DevCommandName, EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { FormatUtils, InteractionUtils, ShardUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const require = createRequire(import.meta.url);
let TsConfig = require('../../../tsconfig.json');

export class DevCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.dev', Language.Default)];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [];
    public isDevOnly = true;

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let shardCount = intr.client.shard?.count ?? 1;
        let serverCount: number;
        if (intr.client.shard) {
            try {
                serverCount = await ShardUtils.serverCount(intr.client.shard);
            } catch (error) {
                if (error.name.includes('ShardingInProcess')) {
                    await InteractionUtils.send(
                        intr,
                        Lang.getEmbed('info', 'embeds.startupInProcess', data.lang)
                    );
                    return;
                } else {
                    throw error;
                }
            }
        } else {
            serverCount = intr.client.guilds.cache.size;
        }

        let memory = process.memoryUsage();
        let otherNa = Lang.getRef('info', 'other.na', data.lang);

        await InteractionUtils.send(
            intr,
            Lang.getEmbed('info', 'embeds.devInfo', data.lang, {
                NODE_VERSION: process.version,
                TS_VERSION: `v${typescript.version}`,
                ES_VERSION: TsConfig.compilerOptions.target,
                DJS_VERSION: `v${djs.version}`,
                SHARD_COUNT: shardCount.toLocaleString(data.lang),
                SERVER_COUNT: serverCount.toLocaleString(data.lang),
                SERVER_COUNT_PER_SHARD: Math.round(serverCount / shardCount).toLocaleString(
                    data.lang
                ),
                RSS_SIZE: FormatUtils.fileSize(memory.rss),
                RSS_SIZE_PER_SERVER:
                    serverCount > 0 ? FormatUtils.fileSize(memory.rss / serverCount) : otherNa,
                HEAP_TOTAL_SIZE: FormatUtils.fileSize(memory.heapTotal),
                HEAP_TOTAL_SIZE_PER_SERVER:
                    serverCount > 0
                        ? FormatUtils.fileSize(memory.heapTotal / serverCount)
                        : otherNa,
                HEAP_USED_SIZE: FormatUtils.fileSize(memory.heapUsed),
                HEAP_USED_SIZE_PER_SERVER:
                    serverCount > 0 ? FormatUtils.fileSize(memory.heapUsed / serverCount) : otherNa,
                HOSTNAME: os.hostname(),
                SHARD_ID: (intr.guild?.shardId ?? 0).toString(),
                SERVER_ID: intr.guild?.id ?? otherNa,
                BOT_ID: intr.client.user?.id,
                USER_ID: intr.user.id,
            })
        );
    }
}
