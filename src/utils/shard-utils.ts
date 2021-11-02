import { ShardClientUtil, ShardingManager, Util } from 'discord.js';
import { MathUtils } from '.';

const MAX_SERVERS_PER_SHARD = 2500;

export class ShardUtils {
    public static async requiredShardCount(token: string): Promise<number> {
        return this.recommendedShardCount(token, MAX_SERVERS_PER_SHARD);
    }

    public static async recommendedShardCount(
        token: string,
        serversPerShard: number
    ): Promise<number> {
        return Math.ceil(
            await Util.fetchRecommendedShards(token, { guildsPerShard: serversPerShard })
        );
    }

    public static shardIds(
        totalShards: number,
        machineId: number,
        totalMachines: number
    ): number[] {
        let myShardIds: number[] = [];
        for (let shardId = 0; shardId < totalShards; shardId++) {
            if (shardId % totalMachines === machineId) {
                myShardIds.push(shardId);
            }
        }
        return myShardIds;
    }

    public static shardId(guildId: number | string, shardCount: number): number {
        // See sharding formula:
        //   https://discord.com/developers/docs/topics/gateway#sharding-sharding-formula
        // tslint:disable-next-line:no-bitwise
        return Number((BigInt(guildId) >> 22n) % BigInt(shardCount));
    }

    public static async serverCount(
        shardInterface: ShardingManager | ShardClientUtil
    ): Promise<number> {
        let shardGuildCounts = (await shardInterface.fetchClientValues(
            'guilds.cache.size'
        )) as number[];
        return MathUtils.sum(shardGuildCounts);
    }
}
