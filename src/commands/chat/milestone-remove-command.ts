import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { ExperienceUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class MilestoneRemoveCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.milestone', Language.Default),
        Lang.getRef('commands', 'chatCommands.remove', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let xp = intr.options.getInteger(Lang.getRef('commands', 'arguments.xp', Language.Default));
        let dataToSendToLang = {
            XP: xp.toLocaleString(),
        };

        let milestoneSettings = ExperienceUtils.ensureMilestoneSettings(data.guildData);
        let milestoneIndex = milestoneSettings.xpMilestones.findIndex(
            milestone => milestone.xp === xp
        );

        if (milestoneIndex === -1) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.milestoneDoesNotExist',
                    data.lang,
                    dataToSendToLang
                )
            );
            return;
        }

        milestoneSettings.xpMilestones.splice(milestoneIndex, 1);
        await data.em.persistAndFlush(data.guildData);

        await InteractionUtils.send(
            intr,
            Lang.getSuccessEmbed(
                'results',
                'successEmbeds.milestoneRemoved',
                data.lang,
                dataToSendToLang
            )
        );
    }
}
