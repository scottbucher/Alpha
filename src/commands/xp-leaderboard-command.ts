import { Message, TextChannel } from 'discord.js';

import { Command } from './command';
import { UserRepo } from '../services/database/repos';

let Config = require('../../config/config.json');

export class XpLeaderboardCommand implements Command {
    public name: string = 'lb';
    public aliases = ['leaderboard', 'top'];
    public guildOnly = true;
    public adminOnly = false;
    public ownerOnly = false;
    public help: string = 'Show this server\'s xp leaderboard';

    constructor(private userRepo: UserRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        // Do Stuff
    }
}