import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class JoinRoleClearCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.joinRoles', Language.Default),
        Lang.getRef('commands', 'chatCommands.clear', Language.Default),
    ];
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        if (data.guildData.welcomeSettings.joinRoleDiscordIds.length === 0) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.noJoinRoles', data.lang)
            );
            return;
        }

        data.guildData.welcomeSettings.joinRoleDiscordIds = [];
        await data.em.persistAndFlush(data.guildData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed('results', 'successEmbeds.joinRolesCleared', data.lang)
        );
    }
}
