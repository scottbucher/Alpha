import { AddLevelingRewardCommand } from './commands/add-level-reward-command';
import { AddRoleCallCommand } from './commands/add-role-call-command';
import { Bot } from './bot';
import { ClearLevelRewardsCommand } from './commands/clear-level-rewards-command';
import { Client } from 'discord.js';
import { DataAccess } from './services/database/data-access';
import { DefaultHelpCommand } from './commands/default-help-command';
import { GuildJoinHandler } from './events/guild-join-handler';
import { GuildRepo } from './services/database/repos/guild-repo';
import { Logger } from './services';
import { MessageHandler } from './events/message-handler';
import { RewardRepo } from './services/database/repos/reward-repo';
import { RoleCallRepo } from './services/database/repos/rolecall-repo';
import { SetLevelingChannelCommand } from './commands/set-leveling-channel-command';
import { TestCommand } from './commands';
import { TrackVoiceXp } from './jobs/trackVoiceXp';
import { UserJoinHandler } from './events/user-join-handler';
import { UserRepo } from './services/database/repos/user-repo';
import { XpCommand } from './commands/xp-command';

let Config = require('../config/config.json');

async function start(): Promise<void> {
    Logger.info('Starting Bot!');
    let client = new Client();
    let dataAccess = new DataAccess(Config.mysql);

    let defaultHelpCommand = new DefaultHelpCommand();

    // Repos
    let userRepo = new UserRepo(dataAccess);
    let guildRepo = new GuildRepo(dataAccess);
    let rewardRepo = new RewardRepo(dataAccess);
    let roleCallRepo = new RoleCallRepo(dataAccess);

    // Commands
    let xpCommand = new XpCommand(userRepo);

    let setLevelingChannelCommand = new SetLevelingChannelCommand(guildRepo);
    let addLevelingRewardCommand = new AddLevelingRewardCommand(rewardRepo);
    let clearLevelRewardsCommand = new ClearLevelRewardsCommand(rewardRepo);

    let addRoleCallCommand = new AddRoleCallCommand(roleCallRepo);

    let testCommand = new TestCommand();

    // Events handlers
    let messageHandler = new MessageHandler(
        defaultHelpCommand,
        [
            xpCommand,
            setLevelingChannelCommand,
            addLevelingRewardCommand,
            clearLevelRewardsCommand,
            addRoleCallCommand,
            testCommand
        ],
        guildRepo,
        userRepo,
        rewardRepo
        );
    let guildJoinHandler = new GuildJoinHandler(guildRepo);
    let userJoinHandler = new UserJoinHandler(userRepo);

    // Jobs
    let trackVoiceXpJob = new TrackVoiceXp(client, guildRepo, userRepo, rewardRepo);

    let bot = new Bot(Config.token, client, trackVoiceXpJob, messageHandler, guildJoinHandler, userJoinHandler, guildRepo, userRepo);

    await bot.start();
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection:', promise);
    if (reason instanceof Error) {
        console.error(reason.stack);
    } else {
        console.error(reason);
    }
});

start();
