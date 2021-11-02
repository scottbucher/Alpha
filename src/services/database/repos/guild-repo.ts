import { DataAccess } from '../data-access';
import { GuildData } from '../../../models/database/guild-models';
import { Procedure } from '../procedure';
import { SQLUtils } from '../../../utils';

export class GuildRepo {
    constructor(private dataAccess: DataAccess) {}

    public async getGuild(discordId: string): Promise<GuildData> {
        let results = await this.dataAccess.executeProcedure(Procedure.Guild_Get, [discordId]);
        return SQLUtils.getFirstResultFirstRow(results);
    }

    public async syncGuild(guildId: string, discordIds: string[]): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_Sync, [
            guildId,
            discordIds.join(','),
        ]);
    }

    public async updateGuildLevelingChannel(guildId: string, channelId: string): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_UpdateLevelingChannel, [
            guildId,
            channelId,
        ]);
    }

    public async updateGuildPollChannel(guildId: string, channelId: string): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_UpdatePollChannel, [
            guildId,
            channelId,
        ]);
    }

    public async updateGuildWelcomeChannel(guildId: string, channelId: string): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_UpdateWelcomeChannel, [
            guildId,
            channelId,
        ]);
    }

    public async updateGuildQuoteChannel(guildId: string, channelId: string): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_UpdateQuoteChannel, [
            guildId,
            channelId,
        ]);
    }

    public async updateGuildJoinRole(guildId: string, roleId: string): Promise<void> {
        await this.dataAccess.executeProcedure(Procedure.Guild_UpdateJoinRole, [guildId, roleId]);
    }
}
