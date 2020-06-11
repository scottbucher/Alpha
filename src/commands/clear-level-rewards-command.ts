import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { RewardRepo } from '../services/database/repos';
import { FormatUtils, ParseUtils } from '../utils';
import { Command } from './command';

let Config = require('../../config/config.json');

export class ClearLevelRewardsCommand implements Command {
    public name: string = 'clearlevelrewards';
    public aliases = ['removelevelrewards'];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = false;
    public help: string = 'Remove all role rewards for this level.';

    constructor(private rewardRepo: RewardRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        // Need at least 2 arguments
        if (args.length < 2) {
            let embed = new MessageEmbed()
                .setDescription('Please provide a level you want to clear.')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        let level = ParseUtils.parseInt(args[1]);

        if (!FormatUtils.isLevel(level)) {
            let embed = new MessageEmbed()
                .setDescription('Invalid Level!')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        this.rewardRepo.clearLevelRewards(msg.guild.id, level);

        let embed = new MessageEmbed()
            .setDescription(`Successfully removed all role rewards from level **${level}**!`)
            .setColor(Config.colors.success);

        await channel.send(embed);
    }
}
