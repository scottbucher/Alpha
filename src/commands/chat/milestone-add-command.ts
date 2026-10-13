import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { XpMilestone } from '../../database/entities/index.js';
import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import {
    ExperienceUtils,
    FormatUtils,
    InteractionUtils,
    ValidationUtils,
} from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const MAX_XP_MILESTONES = 25;

export class MilestoneAddCommand implements Command {
    public names = [
        Lang.getRef('commands', 'chatCommands.milestone', Language.Default),
        Lang.getRef('commands', 'chatCommands.add', Language.Default),
    ];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let xp = intr.options.getInteger(Lang.getRef('commands', 'arguments.xp', Language.Default));
        let role = intr.options.getRole(
            Lang.getRef('commands', 'arguments.role', Language.Default)
        );

        if (role) {
            let validatedRole = await ValidationUtils.validateRole(intr, data, role);
            if (!validatedRole) {
                return;
            }
        }

        let dataToSendToLang = {
            XP: xp.toLocaleString(),
            ROLE: role ? FormatUtils.roleMention(intr.guild, role.id) : undefined,
        };

        let milestoneSettings = ExperienceUtils.ensureMilestoneSettings(data.guildData);
        let existingMilestone = milestoneSettings.xpMilestones.find(
            milestone => milestone.xp === xp
        );

        if (existingMilestone) {
            if (!role) {
                await InteractionUtils.send(
                    intr,
                    Lang.getErrorEmbed(
                        'validation',
                        'errorEmbeds.milestoneAlreadyExists',
                        data.lang,
                        dataToSendToLang
                    )
                );
                return;
            }

            existingMilestone.roleDiscordId = role.id;
            await data.em.persistAndFlush(data.guildData);

            await InteractionUtils.send(
                intr,
                Lang.getSuccessEmbed('results', 'successEmbeds.milestoneRoleUpdated', data.lang, {
                    ...dataToSendToLang,
                    CMD_CLAIM_REWARDS: await FormatUtils.commandMention(
                        intr.client,
                        'claimRewards'
                    ),
                })
            );
            return;
        }

        if (milestoneSettings.xpMilestones.length >= MAX_XP_MILESTONES) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.milestoneLimitReached', data.lang, {
                    MAX: MAX_XP_MILESTONES.toString(),
                })
            );
            return;
        }

        let milestone = new XpMilestone();
        milestone.xp = xp;
        milestone.roleDiscordId = role?.id;

        let insertIndex = milestoneSettings.xpMilestones.findIndex(
            existing => existing.xp > milestone.xp
        );
        milestoneSettings.xpMilestones.splice(
            insertIndex === -1 ? milestoneSettings.xpMilestones.length : insertIndex,
            0,
            milestone
        );
        await data.em.persistAndFlush(data.guildData);

        await InteractionUtils.send(
            intr,
            role
                ? Lang.getSuccessEmbed(
                      'results',
                      'successEmbeds.milestoneAddedWithRole',
                      data.lang,
                      {
                          ...dataToSendToLang,
                          CMD_CLAIM_REWARDS: await FormatUtils.commandMention(
                              intr.client,
                              'claimRewards'
                          ),
                      }
                  )
                : Lang.getSuccessEmbed(
                      'results',
                      'successEmbeds.milestoneAdded',
                      data.lang,
                      dataToSendToLang
                  )
        );
    }
}
