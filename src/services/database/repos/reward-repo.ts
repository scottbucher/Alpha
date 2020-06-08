import { RewardData } from '../../../models/database/reward-models';
import { SQLUtils } from '../../../utils';
import { DataAccess } from '../data-access';
import { Procedure } from '../procedure';

export class RewardRepo {
    constructor(private dataAccess: DataAccess) {}

    public async addLevelReward(guildId: string, roleId: string, level: number): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_AddReward, [guildId, roleId, level]);
    }

    public async clearLevelRewards(guildId: string, level: number): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_ClearLevelRewards, [guildId, level]);
    }

    public async getLevelRewards(guildId: string, level: number): Promise<RewardData[]> {
        let results = await this.dataAccess.executeProcedure(Procedure.Guild_GetLevelRewards, [
            guildId,
            level,
        ]);

        return SQLUtils.getFirstResult(results);
    }
}
