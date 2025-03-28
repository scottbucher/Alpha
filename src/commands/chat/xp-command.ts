import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';

import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils, MathUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';
import { EventDataType } from '../../enums/index.js';
import { ExperienceUtils } from '../../utils/experience-utils.js';

export class XpCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.xp', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireEventData: EventDataType[] = [EventDataType.GUILD_USER_DATA];
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let target =
            intr.options.getUser(Lang.getRef('commands', 'arguments.user', Language.Default)) ??
            intr.user;

        let guildUserData = data.guildUserData;

        let currentXp = guildUserData.experience;
        let level = ExperienceUtils.getLevelFromXp(currentXp);
        let xpProgressInCurrentLevel = ExperienceUtils.getXpProgressInCurrentLevel(currentXp);
        let xpForNextLevel = ExperienceUtils.getXpForNextLevel(level);

        const totalBars = 10;

        let progress = Math.round((xpProgressInCurrentLevel / xpForNextLevel) * totalBars);
        let remainingBars = totalBars - progress;
        let progressPercentage = MathUtils.getPercent(xpProgressInCurrentLevel / xpForNextLevel);
        let xpProgressionForLevel = `${xpProgressInCurrentLevel.toLocaleString()} / ${xpForNextLevel.toLocaleString()} XP (*${progressPercentage}*)`;
        let progressBar = `**${level}** | ${Lang.getEmoji('percentComplete').repeat(progress)}${Lang.getEmoji('percentRemaining').repeat(remainingBars)} | **${level + 1}**`;

        let embed = Lang.getEmbed('info', 'embeds.userXpBreakdown', data.lang, {
            CURRENT_LEVEL: level.toLocaleString(),
            CURRENT_XP: currentXp.toLocaleString(),
            LEVEL_PROGRESS: `${xpProgressionForLevel}\n\n${progressBar}`,
            USER_NAME: `**${target.displayName}**`,
            USER_AVATAR: target.displayAvatarURL(),
        });

        await InteractionUtils.send(intr, embed);
    }
}
