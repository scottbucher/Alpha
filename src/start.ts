import { Client, ClientOptions, PartialTypes } from 'discord.js';

import { Bot } from './bot';
import {
    AboutCommand,
    AddLevelingRewardCommand,
    AddRoleCallCommand,
    ClearLevelRewardsCommand,
    CreateRoleCallCommand,
    DefaultHelpCommand,
    GoodMorningCommand,
    GoodnightCommand,
    QuoteCommand,
    RemoveRoleCallCommand,
    ServerInfoCommand,
    SetLevelingChannelCommand,
    SetQuoteChannelCommand,
    SetWelcomeChannelCommand,
    SetXpCommand,
    XpCommand,
} from './commands';
import { EightBallCommand } from './commands/eight-ball-command';
import { XpLeaderboardCommand } from './commands/xp-leaderboard-command';
import {
    GuildJoinHandler,
    MessageHandler,
    ReactionAddHandler,
    ReactionRemoveHandler,
    UserJoinHandler,
} from './events';
import { TrackVoiceXp } from './jobs/trackVoiceXp';
import { Logger } from './services';
import { DataAccess } from './services/database/data-access';
import { GuildRepo, RewardRepo, RoleCallRepo, UserRepo } from './services/database/repos';

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
    let xpLeaderBoardCommand = new XpLeaderboardCommand(userRepo);
    let setXpCommand = new SetXpCommand(userRepo);

    let setLevelingChannelCommand = new SetLevelingChannelCommand(guildRepo);
    let addLevelingRewardCommand = new AddLevelingRewardCommand(rewardRepo);
    let clearLevelRewardsCommand = new ClearLevelRewardsCommand(rewardRepo);

    let addRoleCallCommand = new AddRoleCallCommand(roleCallRepo);
    let removeRoleCallCommand = new RemoveRoleCallCommand(roleCallRepo);
    let createRoleCallCommand = new CreateRoleCallCommand(roleCallRepo);

    let setWelcomeChannelCommand = new SetWelcomeChannelCommand(guildRepo);
    let setQuoteChannelCommand = new SetQuoteChannelCommand(guildRepo);

    let goodMorningCommand = new GoodMorningCommand();
    let goodNightCommand = new GoodnightCommand();

    let eightBallCommand = new EightBallCommand();
    let aboutCommand = new AboutCommand(guildRepo);
    let serverInfoCommand = new ServerInfoCommand(guildRepo);
    let quoteCommand = new QuoteCommand(guildRepo);

    // Events handlers
    let messageHandler = new MessageHandler(
        defaultHelpCommand,
        [
            xpCommand,
            xpLeaderBoardCommand,
            setXpCommand,
            setLevelingChannelCommand,
            addLevelingRewardCommand,
            clearLevelRewardsCommand,
            addRoleCallCommand,
            removeRoleCallCommand,
            createRoleCallCommand,
            setWelcomeChannelCommand,
            setQuoteChannelCommand,
            goodMorningCommand,
            goodNightCommand,
            eightBallCommand,
            aboutCommand,
            serverInfoCommand,
            quoteCommand,
        ],
        guildRepo,
        userRepo,
        rewardRepo
    );
    let guildJoinHandler = new GuildJoinHandler(guildRepo);
    let userJoinHandler = new UserJoinHandler(guildRepo, userRepo);
    let reactionAddHandler = new ReactionAddHandler(userRepo, roleCallRepo);
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
