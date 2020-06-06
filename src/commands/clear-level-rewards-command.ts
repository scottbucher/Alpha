import { FormatUtils, ParseUtils } from '../utils';
import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { Command } from './command';
import { RewardRepo } from '../services/database/repos/reward-repo';

let Config = require('../../config/config.json');

export class ClearLevelRewardsCommand implements Command {
    public name: string = 'clearlevelrewards';
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = false;
    public help: string = 'Remove all role rewards for this level.';

    constructor(
        private rewardRepo: RewardRepo
    ) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        if (args.length < 2) { // Need atleast 2 arguments
            let embed = new MessageEmbed()
                .setDescription('Please provide a level you want to clear.')
                .setColor(Config.errorColor);
            await channel.send(embed);
            return;
        }

        let level = ParseUtils.parseInt(args[1]);

        if (!FormatUtils.isLevel(level)) {
            let embed = new MessageEmbed()
                .setDescription('Invalid Level!')
                .setColor(Config.errorColor);
            await channel.send(embed);
            return;
        }

        this.rewardRepo.clearLevelRewards(msg.guild.id, level);

        let embed = new MessageEmbed()
            .setDescription(`Successfully removed all role rewards from level **${level}**!`)
            .setColor(Config.successColor);

        await channel.send(embed);
    }
}