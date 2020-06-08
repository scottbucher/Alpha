import { Client, ClientOptions, PartialTypes } from 'discord.js';

import { AddLevelingRewardCommand } from './commands/add-level-reward-command';
import { AddRoleCallCommand } from './commands/add-role-call-command';
import { Bot } from './bot';
import { ClearLevelRewardsCommand } from './commands/clear-level-rewards-command';
import { CreateRoleCallCommand } from './commands/create-role-call-command';
import { DataAccess } from './services/database/data-access';
import { DefaultHelpCommand } from './commands/default-help-command';
import { GuildJoinHandler } from './events/guild-join-handler';
import { GuildRepo } from './services/database/repos/guild-repo';
import { Logger } from './services';
import { MessageHandler } from './events/message-handler';
import { ReactionAddHandler } from './events/reaction-add-handler';
import { ReactionRemoveHandler } from './events/reaction-remove-handler';
import { RemoveRoleCallCommand } from './commands/remove-role-call-command';
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

    let clientOptions: ClientOptions = {
        messageCacheMaxSize: Config.clientOptions.messageCacheMaxSize,
        messageCacheLifetime: Config.clientOptions.messageCacheLifetime,
        messageSweepInterval: Config.clientOptions.messageSweepInterval,
        partials: Config.clientOptions.partials as PartialTypes[],
    };

    let client = new Client(clientOptions);
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
    let removeRoleCallCommand = new RemoveRoleCallCommand(roleCallRepo);
    let createRoleCallCommand = new CreateRoleCallCommand(roleCallRepo);

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
            removeRoleCallCommand,
            createRoleCallCommand,
            testCommand,
        ],
        guildRepo,
        userRepo,
        rewardRepo
    );
    let guildJoinHandler = new GuildJoinHandler(guildRepo);
    let userJoinHandler = new UserJoinHandler(userRepo);
    let reactionAddHandler = new ReactionAddHandler(roleCallRepo);
    let reactionRemoveHandler = new ReactionRemoveHandler(roleCallRepo);

    // Jobs
    let trackVoiceXpJob = new TrackVoiceXp(client, guildRepo, userRepo, rewardRepo);

    let bot = new Bot(
        Config.token,
        client,
        trackVoiceXpJob,
        messageHandler,
        guildJoinHandler,
        userJoinHandler,
        reactionAddHandler,
        reactionRemoveHandler,
        guildRepo,
        userRepo
    );

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
