import { FormatUtils, ParseUtils } from '../utils';
import { Message, TextChannel } from 'discord.js';

import { Command } from './command';
import { UserRepo } from '../services/database/repos';

let Config = require('../../config/config.json');

export class XpLeaderboardCommand implements Command {
    public name: string = 'lb';
    public aliases = ['leaderboard', 'top'];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = false;
    public ownerOnly = false;
    public help: string = `Show this server's xp leaderboard`;

    constructor(private userRepo: UserRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        let page = 1;

        if (args[1]) {
            try {
                page = ParseUtils.parseInt(args[1]);
            } catch (error) {
                // Not A Number
            }
            if (!page || page <= 0 || page > 100000) page = 1;
        }

        let pageSize = Config.lbPageSize;

        let users = msg.guild.members.cache.filter(member => !member.user.bot).keyArray();

        let userDataResults = await this.userRepo.getLeaderBoardUsers(
            msg.guild.id,
            users,
            pageSize,
            page
        );

        if (page > userDataResults.stats.TotalPages) page = userDataResults.stats.TotalPages;

        let embed = await FormatUtils.getXpLeaderBoardEmbed(msg.guild, userDataResults, page, pageSize);

        let message = await channel.send(embed);

        if (embed.description === 'No users in the database!') return;

        if (page !== 1) await message.react(Config.emotes.previousPage);
        if (userDataResults.stats.TotalPages > page) await message.react(Config.emotes.nextPage);
    }
}
