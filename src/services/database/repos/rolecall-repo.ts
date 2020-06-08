import { DataAccess } from '../data-access';
import { Procedure } from '../procedure';
import { RoleCallData } from '../../../models/database/rolecall-models';
import { SQLUtils } from '../../../utils';

export class RoleCallRepo {
    constructor(private dataAccess: DataAccess) {}

    public async addRoleCall(
        guildId: string,
        roleId: string,
        emoteId: string,
        category: string
    ): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_AddRoleCall, [
            guildId,
            roleId,
            emoteId,
            category,
        ]);
    }

    public async removeRoleCall(roleId: string): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_RemoveRoleCall, [roleId]);
    }

    public async getRoleCalls(guildId: string): Promise<RoleCallData[]> {
        let results = await this.dataAccess.executeProcedure(Procedure.Guild_GetRoleCalls, [
            guildId,
        ]);

        return SQLUtils.getFirstResult(results);
    }
}
