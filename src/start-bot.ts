import { REST } from '@discordjs/rest';
import { Options, Partials } from 'discord.js';
import { createRequire } from 'node:module';

import { Button, LeaderboardButton, ViewRewardsButton } from './buttons/index.js';
import {
    DevCommand,
    EditChannelCommand,
    EightBallCommand,
    HelpCommand,
    InfoCommand,
    LeaderboardCommand,
    QuoteCommand,
    RewardAddRoleCommand,
    RewardRemoveRoleCommand,
    RewardRemoveRoleIdCommand,
    RewardRoleClearCommand,
    ViewRewardsCommand,
    XpCommand,
    ServerInfoCommand,
    ViewJoinRolesCommand,
    JoinRoleAddCommand,
    JoinRoleClearCommand,
    JoinRoleRemoveCommand,
    JoinRoleRemoveIdCommand,
    SettingsCommand,
    ChannelPermissionsCommand,
    EditTimeZoneCommand,
    MapCommand,
    ClaimRewardsCommand,
} from './commands/chat/index.js';
import {
    ChatCommandMetadata,
    Command,
    MessageCommandMetadata,
    UserCommandMetadata,
} from './commands/index.js';
import {
    ButtonHandler,
    CommandHandler,
    GuildJoinHandler,
    GuildLeaveHandler,
    MessageHandler,
    ReactionHandler,
    TriggerHandler,
} from './events/index.js';
import { CustomClient } from './extensions/index.js';
import { EventJob, GenerateXpEventsJob, GiveVoiceXpJob, Job } from './jobs/index.js';
import { Bot } from './models/index.js';
import { Reaction } from './reactions/index.js';
import {
    CommandRegistrationService,
    EventDataService,
    JobService,
    LevelUpService,
    Logger,
} from './services/index.js';
import {
    GenericTrigger,
    GoodMorningTrigger,
    GoodNightTrigger,
    OldPrefixTrigger,
    Trigger,
} from './triggers/index.js';
import { Database } from './database/index.js';
import { QuoteMessage } from './commands/message/index.js';
import { ViewJoinRolesButton } from './buttons/view-join-roles-button.js';

const require = createRequire(import.meta.url);
let Config = require('../config/config.json');
let Logs = require('../lang/logs.json');

async function start(): Promise<void> {
    // Database
    let orm = await Database.connect();
    // Services
    let eventDataService = new EventDataService(orm);
    let levelUpService = new LevelUpService();

    // Client
    let client = new CustomClient({
        intents: Config.client.intents,
        partials: (Config.client.partials as string[]).map(partial => Partials[partial]),
        makeCache: Options.cacheWithLimits({
            // Keep default caching behavior
            ...Options.DefaultMakeCacheSettings,
            // Override specific options from config
            ...Config.client.caches,
        }),
    });

    let leaderboardCommand = new LeaderboardCommand();
    let viewRewardsCommand = new ViewRewardsCommand();
    let viewJoinRolesCommand = new ViewJoinRolesCommand();

    // Commands
    let commands: Command[] = [
        // Chat Commands
        new DevCommand(),
        new HelpCommand(),
        new InfoCommand(),
        new XpCommand(),
        new EditChannelCommand(),
        new RewardAddRoleCommand(),
        new RewardRemoveRoleCommand(),
        new RewardRemoveRoleIdCommand(),
        new RewardRoleClearCommand(),
        new QuoteCommand(),
        new EightBallCommand(),
        new ServerInfoCommand(),
        new JoinRoleAddCommand(),
        new JoinRoleRemoveCommand(),
        new JoinRoleRemoveIdCommand(),
        new JoinRoleClearCommand(),
        new SettingsCommand(),
        new ChannelPermissionsCommand(),
        new EditTimeZoneCommand(),
        new MapCommand(),
        new ClaimRewardsCommand(),

        // Chat Commands with a corresponding button implementation
        leaderboardCommand,
        viewRewardsCommand,
        viewJoinRolesCommand,

        // Message Context Commands
        new QuoteMessage(),

        // User Context Commands
    ];

    // Buttons
    let buttons: Button[] = [
        new LeaderboardButton(leaderboardCommand),
        new ViewRewardsButton(viewRewardsCommand),
        new ViewJoinRolesButton(viewJoinRolesCommand),
    ];

    // Reactions
    let reactions: Reaction[] = [
        // TODO: Add new reactions here
    ];

    // Triggers
    let triggers: Trigger[] = [
        new GenericTrigger(levelUpService),
        new OldPrefixTrigger(),
        new GoodMorningTrigger(),
        new GoodNightTrigger(),
    ];

    // Event handlers
    let guildJoinHandler = new GuildJoinHandler(orm, eventDataService);
    let guildLeaveHandler = new GuildLeaveHandler();
    let commandHandler = new CommandHandler(commands, eventDataService);
    let buttonHandler = new ButtonHandler(buttons, eventDataService);
    let triggerHandler = new TriggerHandler(triggers, eventDataService);
    let messageHandler = new MessageHandler(triggerHandler);
    let reactionHandler = new ReactionHandler(reactions, eventDataService);

    // Jobs
    let jobs: Job[] = [
        new GiveVoiceXpJob(client, orm, levelUpService),
        new EventJob(client, orm),
        new GenerateXpEventsJob(client, orm),
    ];

    // Bot
    let bot = new Bot(
        Config.client.token,
        client,
        guildJoinHandler,
        guildLeaveHandler,
        messageHandler,
        commandHandler,
        buttonHandler,
        reactionHandler,
        new JobService(jobs)
    );

    // Register
    if (process.argv[2] == 'commands') {
        try {
            let rest = new REST({ version: '10' }).setToken(Config.client.token);
            let commandRegistrationService = new CommandRegistrationService(rest);
            let localCmds = [
                ...Object.values(ChatCommandMetadata).sort((a, b) => (a.name > b.name ? 1 : -1)),
                ...Object.values(MessageCommandMetadata).sort((a, b) => (a.name > b.name ? 1 : -1)),
                ...Object.values(UserCommandMetadata).sort((a, b) => (a.name > b.name ? 1 : -1)),
            ];
            await commandRegistrationService.process(localCmds, process.argv);
        } catch (error) {
            Logger.error(Logs.error.commandAction, error);
        }
        // Wait for any final logs to be written.
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit();
    }

    await bot.start();
}

process.on('unhandledRejection', (reason, _promise) => {
    Logger.error(Logs.error.unhandledRejection, reason);
});

start().catch(error => {
    Logger.error(Logs.error.unspecified, error);
});
