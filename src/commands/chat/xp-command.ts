import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import {
    ClientUtils,
    ExperienceUtils,
    FormatUtils,
    InteractionUtils,
    MathUtils,
} from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class XpCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.xp', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireEventData: EventDataType[] = [EventDataType.GUILD_USER_DATA];
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let target =
            intr.options.getUser(Lang.getRef('commands', 'arguments.user', Language.Default)) ??
            intr.user;

        if (target.bot) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.cannotViewBotXp', data.lang)
            );
            return;
        }

        let guildUserData = data.guildUserData;
        let member = await ClientUtils.getGuildMember(intr.guild, target.id);

        let currentXp = guildUserData.experience;
        let level = ExperienceUtils.getLevelFromXp(currentXp);
        let xpProgressInCurrentLevel = ExperienceUtils.getXpProgressInCurrentLevel(currentXp);
        let xpForNextLevel = ExperienceUtils.getXpForNextLevel(level);

        let multiplierBreakdown = await ExperienceUtils.getXpMultiplierBreakdownForGuildMember(
            member,
            data.guildData
        );
        let hasIncreasedMultiplier =
            multiplierBreakdown.totalMultiplier > ExperienceUtils.DEFAULT_XP_MULTIPLIER;

        let xpMultiplier = Lang.getRef('info', 'terms.xpMultiplierBreakdown', data.lang, {
            TOTAL_MULTIPLIER_LINE: hasIncreasedMultiplier
                ? Lang.getRef('info', 'terms.totalMultiplier', data.lang, {
                      TOTAL_MULTIPLIER: FormatUtils.formatMultiplier(
                          multiplierBreakdown.totalMultiplier
                      ),
                  })
                : `${FormatUtils.formatMultiplier(multiplierBreakdown.totalMultiplier)}x`,
            EVENT_MULTIPLIER_LINE:
                multiplierBreakdown.eventMultiplier !== undefined
                    ? Lang.getRef('info', 'terms.eventMultiplier', data.lang, {
                          EVENT_MULTIPLIER: FormatUtils.formatMultiplier(
                              multiplierBreakdown.eventMultiplier
                          ),
                      })
                    : '',
            NITRO_XP_BOOST_LINE:
                multiplierBreakdown.nitroMultiplier !== undefined
                    ? Lang.getRef('info', 'terms.nitroXPBoost', data.lang, {
                          NITRO_XP_BOOST_PERCENT: FormatUtils.formatMultiplierPercent(
                              (multiplierBreakdown.nitroMultiplier - 1) * 100
                          ),
                      })
                    : '',
        });

        const totalBars = 10;

        let progress = Math.round((xpProgressInCurrentLevel / xpForNextLevel) * totalBars);
        let remainingBars = totalBars - progress;
        let progressPercentage = MathUtils.getPercent(xpProgressInCurrentLevel / xpForNextLevel);
        let xpProgressionForLevel = `${xpProgressInCurrentLevel.toLocaleString()} / ${xpForNextLevel.toLocaleString()} XP (*${progressPercentage}*)`;
        let progressBar = `**${level}** | ${Lang.getEmoji('percentComplete').repeat(progress)}${Lang.getEmoji('percentRemaining').repeat(remainingBars)} | **${level + 1}**`;
        let embedPath = 'embeds.userXpBreakdown';
        let voiceXpPerMinuteBreakdown = '';

        let voiceChannel = member.voice.channel;
        let isInValidVoiceChannel = voiceChannel && voiceChannel.id !== intr.guild.afkChannelId;
        if (isInValidVoiceChannel) {
            let numberOfVoiceMembers = voiceChannel.members.filter(
                channelMember => !channelMember.user.bot
            ).size;
            let hasAdditionalUsers = numberOfVoiceMembers > 1;
            let baseXpPerMinute = ExperienceUtils.generateBaseVoiceXp(1);
            let baseAndExtraXpPerMinute = ExperienceUtils.generateBaseVoiceXp(numberOfVoiceMembers);
            let extraXpFromAdditionalUsers = baseAndExtraXpPerMinute - baseXpPerMinute;
            let totalXpPerMinuteAfterMultiplier = ExperienceUtils.generateVoiceXp(
                member,
                numberOfVoiceMembers,
                1,
                await ExperienceUtils.getXpMultiplier(data.guildData)
            );

            voiceXpPerMinuteBreakdown = Lang.getRef(
                'info',
                'terms.voiceXpPerMinuteBreakdown',
                data.lang,
                {
                    TOTAL_XP_LINE: Lang.getRef(
                        'info',
                        hasAdditionalUsers
                            ? 'terms.totalVoiceXpPerMinute'
                            : 'terms.totalVoiceXpPerMinuteValueOnly',
                        data.lang,
                        {
                            TOTAL_XP: (
                                baseXpPerMinute + extraXpFromAdditionalUsers
                            ).toLocaleString(),
                            TOTAL_XP_AFTER_MULTIPLIER_LINE: hasIncreasedMultiplier
                                ? Lang.getRef('info', 'terms.totalXpAfterMultiplier', data.lang, {
                                      TOTAL_XP_AFTER_MULTIPLIER:
                                          totalXpPerMinuteAfterMultiplier.toLocaleString(),
                                  })
                                : '',
                        }
                    ),
                    BASE_XP_LINE: hasAdditionalUsers
                        ? Lang.getRef('info', 'terms.baseXpPerMinute', data.lang, {
                              BASE_XP: baseXpPerMinute.toLocaleString(),
                          })
                        : '',
                    EXTRA_XP_LINE: hasAdditionalUsers
                        ? Lang.getRef('info', 'terms.xpFromAdditionalUsers', data.lang, {
                              EXTRA_XP: extraXpFromAdditionalUsers.toLocaleString(),
                          })
                        : '',
                }
            );

            embedPath = 'embeds.userXpBreakdownWithVoice';
        }

        let embed = Lang.getEmbed('info', embedPath, data.lang, {
            CURRENT_LEVEL: level.toLocaleString(),
            CURRENT_XP: currentXp.toLocaleString(),
            XP_MULTIPLIER: xpMultiplier,
            VOICE_XP_PER_MINUTE: voiceXpPerMinuteBreakdown,
            LEVEL_PROGRESS: `${xpProgressionForLevel}\n\n${progressBar}`,
            USER_NAME: `**${target.displayName}**`,
            USER_AVATAR: target.displayAvatarURL(),
        });

        await InteractionUtils.send(intr, embed);
    }
}
