import { ChatInputCommandInteraction, PermissionsString, Role } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import {
    FormatUtils,
    InteractionUtils,
    PermissionUtils,
    ValidationUtils,
} from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';
import { LevelingRewardData } from '../../database/entities/index.js';

export class RewardAddRoleCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.reward', Language.Default),
        Lang.getRef('commands', 'chatCommands.addRole', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let role = intr.options.getRole(
            Lang.getRef('commands', 'arguments.role', Language.Default)
        );
        let level = intr.options.getInteger(
            Lang.getRef('commands', 'arguments.level', Language.Default)
        );

        // if we got this far, we know role is a Role
        let validatedRole = await ValidationUtils.validateRole(intr, data, role);
        if (!validatedRole) {
            return;
        }

        await data.guildData.levelingRewardDatas.init();

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

        if (levelingRewardData) {
            let alreadyHasRole = levelingRewardData.roleDiscordIds.includes(role.id);
            if (alreadyHasRole) {
                await InteractionUtils.send(
                    intr,
                    Lang.getErrorEmbed(
                        'validation',
                        'errorEmbeds.levelingRewardAlreadyHasRole',
                        data.lang,
                        dataToSendToLang
                    )
                );
                return;
            }
            levelingRewardData.roleDiscordIds.push(role.id);
        } else {
            levelingRewardData = new LevelingRewardData(intr.guild.id, [role.id], level);
            data.guildData.levelingRewardDatas.add(levelingRewardData);
        }

        await data.em.persistAndFlush(levelingRewardData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed(
                'results',
                'successEmbeds.levelRewardRoleSet',
                data.lang,
                dataToSendToLang
            )
        );
    }
}
