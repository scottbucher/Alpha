import {
    ApplicationCommandOptionChoiceData,
    AutocompleteFocusedOption,
    AutocompleteInteraction,
} from 'discord.js';

import { DiscordLimits } from '../constants/index.js';
import { EventData } from '../models/internal-models.js';
import { TimeZoneUtils } from '../utils/index.js';

export async function timeZones(
    _intr: AutocompleteInteraction,
    option: AutocompleteFocusedOption,
    _data: EventData
): Promise<ApplicationCommandOptionChoiceData[]> {
    let timeZones = TimeZoneUtils.findMultiple(
        option.value,
        DiscordLimits.CHOICES_PER_AUTOCOMPLETE
    );

    return timeZones.map(choice => ({
        name: choice.name,
        value: choice.name,
    }));
}
