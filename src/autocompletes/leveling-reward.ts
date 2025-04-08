import { QueryOrder } from '@mikro-orm/core';
import {
    ApplicationCommandOptionChoiceData,
    AutocompleteFocusedOption,
    AutocompleteInteraction,
} from 'discord.js';

import { DiscordLimits } from '../constants/index.js';
import { EventData } from '../models/internal-models.js';
import { RegexUtils, StringUtils } from '../utils/index.js';
import { LevelingRewardData } from '../database/entities/leveling-reward-data.js';

// TODO: unused?
export async function levelingReward(
    intr: AutocompleteInteraction,
    option: AutocompleteFocusedOption,
    data: EventData
): Promise<ApplicationCommandOptionChoiceData[]> {
    let search = RegexUtils.escapeRegex(option.value);

    let levelingRewards = await data.em.find(
        LevelingRewardData,
        {
            guild: { discordId: intr.guild.id },
            $or: [
                {
                    alias: new RegExp(`^${search}`, 'i'),
                },
                {
                    alias: new RegExp(search, 'i'),
                },
            ],
        },
        { orderBy: { created: QueryOrder.DESC }, limit: DiscordLimits.CHOICES_PER_AUTOCOMPLETE }
    );

    return levelingRewards.map(levelingReward => ({
        name: StringUtils.truncate(`Level ${levelingReward.level}`, 100, true),
        value: levelingReward.alias,
    }));
}
