import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { FormatUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class RewardRemoveRoleCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.reward', Language.Default),
        Lang.getRef('commands', 'chatCommands.remove', Language.Default),
        Lang.getRef('commands', 'chatCommands.role', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [
        EventDataType.GUILD_DATA,
        EventDataType.LEVELING_REWARD_DATA,
    ];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let role = intr.options.getRole(
            Lang.getRef('commands', 'arguments.role', Language.Default)
        );
        let level = intr.options.getInteger(
            Lang.getRef('commands', 'arguments.level', Language.Default)
        );

        let levelingRewardDatas = data.guildData.levelingRewardDatas.getItems();
        let levelingRewardData = levelingRewardDatas.find(
            levelingRewardData => levelingRewardData.level === level
        );

        let roleMention = FormatUtils.roleMention(intr.guild, role.id);
        let levelString = level.toString();
        let dataToSendToLang = {
            ROLE: roleMention,
            LEVEL: levelString,
        };

        let hasRoleForLevel = levelingRewardData?.roleDiscordIds.includes(role.id);
        if (!hasRoleForLevel) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.levelingRewardDoesNotHaveRole',
                    data.lang,
                    dataToSendToLang
                )
            );
            return;
        }

        levelingRewardData.roleDiscordIds = levelingRewardData.roleDiscordIds.filter(
            id => id !== role.id
        );
        await data.em.persistAndFlush(levelingRewardData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed(
                'results',
                'successEmbeds.levelRewardRoleRemoved',
                data.lang,
                dataToSendToLang
            )
        );
    }
}
