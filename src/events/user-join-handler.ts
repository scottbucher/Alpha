import { GuildMember } from 'discord.js';

import { EventHandler } from './event-handler';
import { Logger } from '../services';
import { UserRepo } from '../services/database/repos/user-repo';

export class UserJoinHandler implements EventHandler {
    constructor(private userRepo: UserRepo) {}

    public async process(member: GuildMember): Promise<void> {
        Logger.info(`User Joining...`);
        this.userRepo.syncUser(member.guild.id, member.id);
        Logger.info(`User Joined!`);
    }
}
