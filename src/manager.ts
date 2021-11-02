import { Shard, ShardingManager } from 'discord.js';

import { Logger } from './services';
import { BotSite } from './services/sites';

let Logs = require('../lang/logs.json');
let Config = require('../config/config.json');

export class Manager {
    constructor(private shardManager: ShardingManager, private botSites: BotSite[]) {}

    public async start(): Promise<void> {
        this.registerListeners();
        try {
            await this.shardManager.spawn({
                amount: this.shardManager.totalShards,
                delay: Config.sharding.spawnDelay * 1000,
                timeout: Config.sharding.spawnTimeout * 1000,
            });
        } catch (error) {
            Logger.error(Logs.error.spawnShard, error);
            return;
        }

        try {
            await this.updateServerCount();
        } catch (error) {
            Logger.error(Logs.error.updateServerCount, error);
        }
    }

    public async updateServerCount(): Promise<void> {
        let serverCount = await this.retrieveServerCount();
        await this.shardManager.broadcastEval(
            (client, context) => {
                return client.user.setPresence({
                    activities: [
                        {
                            // TODO: Discord.js won't accept all ActivityType's here
                            // Need to find a solution to remove "any"
                            type: context.type as any,
                            name: context.name,
                            url: context.url,
                        },
                    ],
                });
            },
            {
                context: {
                    type: 'STREAMING',
                    name: 'Watching you...',
                    url: 'https://www.twitch.tv/stqlth',
                },
            }
        );

        Logger.info(
            Logs.info.updatedServerCount.replace('{SERVER_COUNT}', serverCount.toLocaleString())
        );

        for (let botSite of this.botSites) {
            try {
                await botSite.updateServerCount(serverCount);
            } catch (error) {
                Logger.error(
                    Logs.error.updateServerCountSite.replace('{BOT_SITE}', botSite.name),
                    error
                );
                continue;
            }

            Logger.info(Logs.info.updateServerCountSite.replace('{BOT_SITE}', botSite.name));
        }
    }

    private async retrieveServerCount(): Promise<number> {
        let shardGuildCounts = (await this.shardManager.fetchClientValues(
            'guilds.cache.size'
        )) as number[];
        return shardGuildCounts.reduce((a, b) => a + b, 0);
    }

    private registerListeners(): void {
        this.shardManager.on('shardCreate', shard => this.onShardCreate(shard));
    }

    private onShardCreate(shard: Shard): void {
        Logger.info(Logs.info.launchedShard.replace('{SHARD_ID}', shard.id.toString()));
    }
}
