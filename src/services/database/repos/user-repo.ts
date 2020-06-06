import { DataAccess } from '../data-access';
import { Procedure } from '../procedure';
import { SQLUtils } from '../../../utils';
import { UserData } from '../../../models/database/user-models';

export class UserRepo {
    constructor (private dataAccess: DataAccess) {}

    public async getUser(discordId: string, guildId: string): Promise<UserData> {
        let results = await this.dataAccess.executeProcedure(Procedure.User_Get, [discordId, guildId]);
        return SQLUtils.getFirstResultFirstRow(results);
    }

    public async updateUser(discordId: string, guildId: string, xp: number): Promise<UserData> {
        let results = await this.dataAccess.executeProcedure(Procedure.User_Update, [discordId, guildId, xp]);
        return SQLUtils.getFirstResultFirstRow(results);
    }

    // public async getAllUsers(discordIds: string[], guildId: string): Promise<string[]> {
    //     let results = await this.dataAccess.executeProcedure(Procedure.User_GetAll, [
    //         discordIds.join(','),
    //         guildId
    //     ]);

    //     let firstResult = SQLUtils.getFirstResult(results);
    //     return firstResult.map(row => row.UserDiscordId);
    // }

    public async syncUser(guildId: string, discordId: string): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.User_Sync, [
            guildId,
            discordId
        ]);
    }
}