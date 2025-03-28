import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class JoinRoleRemoveIdCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.joinRoles', Language.Default),
        Lang.getRef('commands', 'chatCommands.remove', Language.Default),
        Lang.getRef('commands', 'chatCommands.id', Language.Default),
    ];
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let id = intr.options.getString(Lang.getRef('commands', 'arguments.id', Language.Default));

        let dataToSendToLang = {
            ROLE_ID: id,
        };

        if (!data.guildData.welcomeSettings.joinRoleDiscordIds.includes(id)) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.joinRoleIdDoesNotExist',
                    data.lang,
                    dataToSendToLang
                )
            );
            return;
        }

        data.guildData.welcomeSettings.joinRoleDiscordIds =
            data.guildData.welcomeSettings.joinRoleDiscordIds.filter(roleId => roleId !== id);
        await data.em.persistAndFlush(data.guildData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed(
                'results',
                'successEmbeds.joinRoleIdRemoved',
                data.lang,
                dataToSendToLang
            )
        );
    }
}
