import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class RewardRoleClearCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.reward', Language.Default),
        Lang.getRef('commands', 'chatCommands.clearRoles', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [
        EventDataType.GUILD_DATA,
        EventDataType.LEVELING_REWARD_DATA,
    ];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let level = intr.options.getInteger(
            Lang.getRef('commands', 'arguments.level', Language.Default)
        );

        let levelingRewardDatas = data.guildData.levelingRewardDatas.getItems();
        let levelingRewardData = levelingRewardDatas.find(
            levelingRewardData => levelingRewardData.level === level
        );

        let levelString = level.toString();
        let dataToSendToLang = {
            LEVEL: levelString,
        };

        let noRolesForLevle = !levelingRewardData || levelingRewardData.roleDiscordIds.length === 0;
        if (!noRolesForLevle) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.levelingRewardDoesNotHaveRoles',
                    data.lang,
                    dataToSendToLang
                )
            );
            return;
        }

        levelingRewardData.roleDiscordIds = levelingRewardData.roleDiscordIds = [];
        await data.em.persistAndFlush(levelingRewardData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed(
                'results',
                'successEmbeds.levelRewardRoleCleared',
                data.lang,
                dataToSendToLang
            )
        );
    }
}
