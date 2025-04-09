import {
    ApplicationCommandOptionChoiceData,
    AutocompleteFocusedOption,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    PermissionsString,
} from 'discord.js';

import { timeZones } from '../../autocompletes/time-zone.js';
import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/language.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/lang.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../command.js';

export class EditTimeZoneCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.edit', Language.Default),
        Lang.getRef('commands', 'chatCommands.timeZone', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireDev = false;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    async autocomplete(
        intr: AutocompleteInteraction,
        option: AutocompleteFocusedOption,
        data: EventData
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        switch (option.name) {
            case Lang.getRef('commands', 'arguments.timeZone', Language.Default): {
                return await timeZones(intr, option, data);
            }
        }
    }

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let timeZone = intr.options.getString(
            Lang.getRef('commands', 'arguments.timeZone', Language.Default)
        );

        data.guildData.generalSettings.timeZone = timeZone;
        await data.em.flush();

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed('results', 'successEmbeds.timeZoneSet', data.lang, {
                TIME_ZONE: timeZone,
            })
        );
    }
}
