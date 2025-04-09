import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { FormatUtils, InteractionUtils, ValidationUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class JoinRoleAddCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.joinRoles', Language.Default),
        Lang.getRef('commands', 'chatCommands.add', Language.Default),
    ];
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let role = intr.options.getRole(
            Lang.getRef('commands', 'arguments.role', Language.Default)
        );

        // if we got this far, we know role is a Role
        let validatedRole = await ValidationUtils.validateRole(intr, data, role);
        if (!validatedRole) {
            return;
        }

        let roleMention = FormatUtils.roleMention(intr.guild, role.id);
        let dataToSendToLang = {
            ROLE: roleMention,
        };

        if (data.guildData.welcomeSettings.joinRoleDiscordIds.includes(role.id)) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.joinRoleAlreadyExists',
                    data.lang,
                    dataToSendToLang
                )
            );
            return;
        }

        data.guildData.welcomeSettings.joinRoleDiscordIds.push(role.id);
        await data.em.persistAndFlush(data.guildData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed(
                'results',
                'successEmbeds.joinRoleAdded',
                data.lang,
                dataToSendToLang
            )
        );
    }
}
