import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString, Role } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class RewardRemoveRoleIdCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.reward', Language.Default),
        Lang.getRef('commands', 'chatCommands.remove', Language.Default),
        Lang.getRef('commands', 'chatCommands.id', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let id = intr.options.getString(Lang.getRef('commands', 'arguments.id', Language.Default));
        let level = intr.options.getInteger(
            Lang.getRef('commands', 'arguments.level', Language.Default)
        );

        await data.guildData.levelingRewardDatas.init();

        let levelingRewardDatas = data.guildData.levelingRewardDatas.getItems();
        let levelingRewardData = levelingRewardDatas.find(
            levelingRewardData => levelingRewardData.level === level
        );

        let roleMention = id;
        let levelString = level.toString();
        let dataToSendToLang = {
            ROLE_ID: roleMention,
            LEVEL: levelString,
        };

        let hasRoleForLevel = !levelingRewardData || levelingRewardData.roleDiscordIds.includes(id);
        if (!hasRoleForLevel) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.levelingRewardDoesNotHaveRoleId',
                    data.lang,
                    dataToSendToLang
                )
            );
            return;
        }

        levelingRewardData.roleDiscordIds = levelingRewardData.roleDiscordIds.filter(
            roleId => roleId !== id
        );
        await data.em.persistAndFlush(levelingRewardData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed(
                'results',
                'successEmbeds.levelRewardRoleIdRemoved',
                data.lang,
                dataToSendToLang
            )
        );
    }
}
