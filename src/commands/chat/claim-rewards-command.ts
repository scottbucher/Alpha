import { ChatInputCommandInteraction, Guild, PermissionsString } from 'discord.js';

import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { ActionUtils, ExperienceUtils, FormatUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';
import { EventDataType } from '../../enums/index.js';

export class ClaimRewardsCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.claimRewards', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireEventData: EventDataType[] = [
        EventDataType.GUILD_DATA,
        EventDataType.LEVELING_REWARD_DATA,
        EventDataType.GUILD_USER_DATA,
    ];
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let guildData = data.guildData;
        let levelingRewardDatas = guildData.levelingRewardDatas.getItems();
        let currentMemberLevel = ExperienceUtils.getLevelFromXp(data.guildUserData.experience);

        let levelingRewardData = levelingRewardDatas.filter(
            rewardData => rewardData.level <= currentMemberLevel
        );

        if (!levelingRewardData) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.noRewardsToClaim', data.lang)
            );
            return;
        }

        let member = await intr.guild.members.fetch(intr.user.id);
        let currentMemberRoleIds = member.roles.cache.map(role => role.id);
        let levelingRewardRoleIds = levelingRewardData.flatMap(
            rewardData => rewardData.roleDiscordIds
        );

        let rolesToAdd = levelingRewardRoleIds
            .filter(roleId => !currentMemberRoleIds.includes(roleId))
            .map(roleId => intr.guild.roles.cache.get(roleId));

        if (rolesToAdd.length === 0) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.noRewardsToClaim', data.lang)
            );
            return;
        }

        for (let role of rolesToAdd) {
            await ActionUtils.giveRole(member, role);
        }

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed('results', 'successEmbeds.rewardsClaimed', data.lang, {
                ROLES_ADDED: FormatUtils.joinWithAnd(
                    rolesToAdd.map(role => FormatUtils.roleMention(intr.guild, role.id)),
                    data.lang
                ),
            })
        );
    }
}
