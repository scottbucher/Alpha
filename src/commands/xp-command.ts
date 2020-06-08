import { GuildMember, Message, MessageEmbed, TextChannel } from 'discord.js';

import { UserRepo } from '../services/database/repos';
import { FormatUtils, XpUtils } from '../utils';
import { Command } from './command';

let Config = require('../../config/config.json');

export class XpCommand implements Command {
    public name: string = 'xp';
    public guildOnly = true;
    public adminOnly = false;
    public ownerOnly = true;
    public help: string = 'Shows the user their current Xp and Level.';

    constructor(private userRepo: UserRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        let target: GuildMember;

        if (args.length >= 2) {
            target =
                msg.mentions.members.first() ||
                msg.guild.members.cache.find(
                    member =>
                        member.displayName.toLowerCase().includes(args[1].toLowerCase()) ||
                        member.user.username.toLowerCase().includes(args[1].toLowerCase())
                );
        } else {
            target = msg.member;
        }

        if (!target) {
            let embed = new MessageEmbed()
                .setDescription('Could not find that user!')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        let userData = await this.userRepo.getUser(target.id, msg.guild.id);

        let playerXp = userData.XpAmount;
        let playerLevel = XpUtils.getLevelFromXp(playerXp); // Calculate their Level
        let playerLevelXp = XpUtils.getLevelXp(playerLevel); // How much Xp does total is needed for the next level
        let xpTowardsNextLevel = XpUtils.getXpTowardsNextLevel(playerXp); // How much xp towards the next level does the user have

        let progressPercent = FormatUtils.getPercent(xpTowardsNextLevel / playerLevelXp);

        const totalBars = 10;

        let progress = Math.round((xpTowardsNextLevel / playerLevelXp) * totalBars);
        let remainingBars = totalBars - progress;
        let progressBar = `${'🟩'.repeat(progress)}${'⬛'.repeat(remainingBars)}`;

        let embed = new MessageEmbed()
            .setTitle(`**${target.displayName}**'s Leveling Progress`)
            .addField('Player Level', `${playerLevel}`)
            .addField('Player Experience', `${playerXp}`)
            .addField(
                'Level Progress',
                `${xpTowardsNextLevel} / ${playerLevelXp} XP (*${progressPercent}*) \n\n**${playerLevel} |** ${progressBar} **| ${
                    playerLevel + 1
                }**`
            )
            .setThumbnail(target.user.avatarURL())
            .setColor(Config.colors.default);
        await channel.send(embed);
    }
}
