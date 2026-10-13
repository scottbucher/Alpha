import { ChatInputCommandInteraction, PermissionsString, Role } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { ActionUtils, ExperienceUtils, FormatUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

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
        let currentMemberXp = data.guildUserData.experience;
        let currentMemberLevel = ExperienceUtils.getLevelFromXp(currentMemberXp);

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
        let milestoneRoleIds = ExperienceUtils.getMilestoneSettings(guildData)
            .xpMilestones.filter(
                milestone => milestone.roleDiscordId && milestone.xp <= currentMemberXp
            )
            .map(milestone => milestone.roleDiscordId);

        let rolesToAdd = [...new Set([...levelingRewardRoleIds, ...milestoneRoleIds])]
            .filter(roleId => !currentMemberRoleIds.includes(roleId))
            .map(roleId => intr.guild.roles.cache.get(roleId))
            .filter(role => role);

        if (rolesToAdd.length === 0) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.noRewardsToClaim', data.lang)
            );
            return;
        }

        let rolesAdded: Role[] = [];
        for (let role of rolesToAdd) {
            if (await ActionUtils.giveRole(member, role)) {
                rolesAdded.push(role);
            }
        }

        if (rolesAdded.length === 0) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.rewardsCouldNotBeGiven', data.lang)
            );
            return;
        }

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed('results', 'successEmbeds.rewardsClaimed', data.lang, {
                ROLES_ADDED: FormatUtils.joinWithAnd(
                    rolesAdded.map(role => FormatUtils.roleMention(intr.guild, role.id)),
                    data.lang
                ),
            })
        );
    }
}
