import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { ExperienceUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class MilestoneIntervalCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.milestone', Language.Default),
        Lang.getRef('commands', 'chatCommands.interval', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let xp = intr.options.getInteger(Lang.getRef('commands', 'arguments.xp', Language.Default));

        let milestoneSettings = ExperienceUtils.ensureMilestoneSettings(data.guildData);
        milestoneSettings.xpInterval = xp ?? undefined;
        await data.em.persistAndFlush(data.guildData);

        await InteractionUtils.send(
            intr,
            xp
                ? Lang.getSuccessEmbed('results', 'successEmbeds.milestoneIntervalSet', data.lang, {
                      XP: xp.toLocaleString(),
                  })
                : Lang.getSuccessEmbed(
                      'results',
                      'successEmbeds.milestoneIntervalCleared',
                      data.lang
                  )
        );
    }
}
