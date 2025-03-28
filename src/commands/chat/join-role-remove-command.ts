import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { FormatUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class JoinRoleRemoveCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.joinRoles', Language.Default),
        Lang.getRef('commands', 'chatCommands.remove', Language.Default),
        Lang.getRef('commands', 'chatCommands.role', Language.Default),
    ];
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let role = intr.options.getRole(
            Lang.getRef('commands', 'arguments.role', Language.Default)
        );

        let roleMention = FormatUtils.roleMention(intr.guild, role.id);
        let dataToSendToLang = {
            ROLE: roleMention,
        };

        if (!data.guildData.welcomeSettings.joinRoleDiscordIds.includes(role.id)) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.joinRoleDoesNotExist',
                    data.lang,
                    dataToSendToLang
                )
            );
            return;
        }

        data.guildData.welcomeSettings.joinRoleDiscordIds =
            data.guildData.welcomeSettings.joinRoleDiscordIds.filter(id => id !== role.id);
        await data.em.persistAndFlush(data.guildData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed(
                'results',
                'successEmbeds.joinRoleRemoved',
                data.lang,
                dataToSendToLang
            )
        );
    }
}
