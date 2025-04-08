import { EmojiResolvable, Message } from 'discord.js';

import { Trigger } from './index.js';
import { EventData } from '../models/internal-models.js';
import { LevelUpService } from '../services/index.js';
import { EventDataType } from '../enums/index.js';
import { ExperienceUtils } from '../utils/index.js';
import { createRequire } from 'node:module';
import { FormatUtils } from '../utils/format-utils.js';
import { MessageUtils } from '../utils/message-utils.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

export class GenericTrigger implements Trigger {
    public requireGuild = true;
    public requireEventData: EventDataType[] = [EventDataType.GUILD_USER_DATA];

    // TODO: don't earn xp for messages that contain certain words (slurs, etc)
    public triggered(_: Message): boolean {
        return true;
    }

    constructor(private levelUpService: LevelUpService) {}

    // TODO: we are currently querying the database for every message, we should add a cache layer
    public async execute(msg: Message, data: EventData): Promise<void> {
        // This trigger is used for all messages, we use it to reward xp
        let guildUserData = data.guildUserData;
        let guildData = data.guildData;

        if (Config.chase.guildIds.includes(msg.guild.id) && msg.author.id === Config.chase.id) {
            // Add chase emote to chase's message
            let emoji: EmojiResolvable = await FormatUtils.findGuildEmoji(
                Config.chase.emote,
                msg.guild
            );
            if (emoji) await MessageUtils.react(msg, emoji); // React with the emote
        }

        if (ExperienceUtils.canEarnXp(guildUserData.lastGivenMessageXp)) {
            let memberXpBefore = guildUserData.experience;
            let currentLevel = ExperienceUtils.getLevelFromXp(memberXpBefore); // Get current level

            guildUserData.experience += ExperienceUtils.generateMessageXp(
                await ExperienceUtils.getXpMultiplier(guildData)
            );
            let memberXpAfter = guildUserData.experience;
            await data.em.persistAndFlush(guildUserData);

            let hasLeveledUp = ExperienceUtils.hasLeveledUp(memberXpBefore, memberXpAfter);
            if (hasLeveledUp) {
                await this.levelUpService.handleLevelUpsForGuild(msg.guild, guildData, [
                    {
                        userId: msg.author.id,
                        oldLevel: currentLevel,
                        newLevel: ExperienceUtils.getLevelFromXp(memberXpAfter),
                    },
                ]);
            }
        }
    }
}
