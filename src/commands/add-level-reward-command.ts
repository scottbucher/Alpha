import { FormatUtils, MessageUtils, ParseUtils } from '../utils';
import { Message, MessageEmbed, Role, TextChannel } from 'discord.js';

import { Command } from './command';
import { RewardRepo } from '../services/database/repos';

let Config = require('../../config/config.json');

export class AddLevelingRewardCommand implements Command {
    public name: string = 'addlevelreward';
    public aliases = [];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = false;
    public help: string = 'Add a level reward.';

    constructor(private rewardRepo: RewardRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        // Need at least 3 arguments
        if (args.length < 3) {
            let embed = new MessageEmbed()
                .setDescription('Invalid Usage. Please provide a level and role.')
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

        // Find mentioned role
        let roleInput: Role = msg.mentions.roles.first();

        if (!roleInput) {
            roleInput = msg.guild.roles.cache.find(role =>
                role.name.toLowerCase().includes(args[2].toLowerCase())
            );
        }

        if (
            !roleInput ||
            roleInput.guild.id !== msg.guild.id ||
            args[2].toLowerCase() === 'everyone'
        ) {
            let embed = new MessageEmbed()
                .setDescription(`Invalid Role!`)
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        await this.rewardRepo.addLevelReward(msg.guild.id, roleInput.id, level);

        let embed = new MessageEmbed()
            .setDescription(
                `Successfully added the ${MessageUtils.getRoleName(
                    roleInput.id,
                    msg.guild
                )} role as a reward for level **${level}**!`
            )
            .setColor(Config.colors.success);

        await channel.send(embed);
    }
}
