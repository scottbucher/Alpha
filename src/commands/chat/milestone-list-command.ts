import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang, MilestoneService } from '../../services/index.js';
import { ExperienceUtils, FormatUtils, InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class MilestoneListCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.milestone', Language.Default),
        Lang.getRef('commands', 'chatCommands.list', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let milestoneSettings = ExperienceUtils.getMilestoneSettings(data.guildData);
        let milestones = milestoneSettings.xpMilestones;

        if (milestones.length === 0 && !milestoneSettings.xpInterval) {
            await InteractionUtils.send(
                intr,
                Lang.getEmbed('info', 'embeds.milestoneListEmpty', data.lang, {
                    CMD_MILESTONE_ADD: await FormatUtils.commandMention(intr.client, 'milestone', [
                        'add',
                    ]),
                    CMD_MILESTONE_INTERVAL: await FormatUtils.commandMention(
                        intr.client,
                        'milestone',
                        ['interval']
                    ),
                })
            );
            return;
        }

        let milestoneList =
            milestones.length > 0
                ? milestones
                      .map(milestone =>
                          milestone.roleDiscordId
                              ? Lang.getRef('info', 'lists.milestoneListEntryWithRole', data.lang, {
                                    XP: milestone.xp.toLocaleString(),
                                    ROLE: FormatUtils.roleMention(
                                        intr.guild,
                                        milestone.roleDiscordId
                                    ),
                                })
                              : Lang.getRef('info', 'lists.milestoneListEntry', data.lang, {
                                    XP: milestone.xp.toLocaleString(),
                                })
                      )
                      .join('\n')
                : Lang.getRef('info', 'terms.none', data.lang);

        let interval = milestoneSettings.xpInterval
            ? Lang.getRef('info', 'terms.milestoneIntervalValue', data.lang, {
                  XP: milestoneSettings.xpInterval.toLocaleString(),
              })
            : Lang.getRef('info', 'terms.none', data.lang);

        await InteractionUtils.send(
            intr,
            Lang.getEmbed('info', 'embeds.milestoneList', data.lang, {
                MILESTONES: milestoneList,
                INTERVAL: interval,
                CHANNEL: await this.getChannelDisplay(intr, data),
            })
        );
    }

    private async getChannelDisplay(
        intr: ChatInputCommandInteraction,
        data: EventData
    ): Promise<string> {
        let { channel, isFallback } = await MilestoneService.getAnnouncementChannel(
            intr.guild,
            data.guildData
        );
        if (!channel) {
            return Lang.getRef('info', 'terms.notSet', data.lang);
        }

        return isFallback
            ? Lang.getRef('info', 'terms.levelingChannelFallback', data.lang, {
                  CHANNEL: channel.toString(),
              })
            : channel.toString();
    }
}
