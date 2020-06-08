import { Client, Guild, GuildMember, Message, MessageReaction, User } from 'discord.js';
import schedule from 'node-schedule';

import {
    GuildJoinHandler,
    MessageHandler,
    ReactionAddHandler,
    ReactionRemoveHandler,
    UserJoinHandler,
} from './events';
import { TrackVoiceXp } from './jobs/trackVoiceXp';
import { Logger } from './services';
import { GuildRepo, UserRepo } from './services/database/repos';

let Config = require('../config/config.json');
let Logs = require('../lang/logs.json');
let Debug = require('../config/debug.json');

export class Bot {
    private ready = false;

    constructor(
        private token: string,
        private client: Client,
        private trackVoiceXpJob: TrackVoiceXp,
        private messageHandler: MessageHandler,
        private guildJoinHandler: GuildJoinHandler,
        private userJoinHandler: UserJoinHandler,
        private reactionAddHandler: ReactionAddHandler,
        private reactionRemoveHandler: ReactionRemoveHandler,
        private guildRepo: GuildRepo,
        private userRepo: UserRepo
    ) {}

    public async start(): Promise<void> {
        this.registerListeners();
        await this.login(this.token);
    }

    private registerListeners(): void {
        this.client.on('ready', () => this.onReady());
        this.client.on('shardReady', (shardId: number) => this.onShardReady(shardId));
        this.client.on('message', (msg: Message) => this.onMessage(msg));
        this.client.on('guildCreate', (guild: Guild) => this.onGuildJoin(guild));
        this.client.on('guildMemberAdd', (member: GuildMember) => this.onUserJoin(member));
        this.client.on('messageReactionAdd', (reaction: MessageReaction, user: User) =>
            this.onReactionAdd(reaction, user)
        );
        this.client.on('messageReactionRemove', (reaction: MessageReaction, user: User) =>
            this.onReactionRemove(reaction, user)
        );
    }

    private startJobs(): void {
        let voiceXpSchedule =
            Debug.enabled && Debug.overridePostScheduleEnabled
                ? Debug.overridePostScheduleEnabled
                : Config.postSchedule;
        schedule.scheduleJob(voiceXpSchedule, async () => {
            try {
                await this.trackVoiceXpJob.run();
            } catch (error) {
                Logger.error(Logs.error.trackVoiceXp, error);
                return;
            }
        });
    }

    private async login(token: string): Promise<void> {
        try {
            await this.client.login(token);
        } catch (error) {
            Logger.error(Logs.error.login, error);
            return;
        }
    }

    private onReady(): void {
        let userTag = this.client.user.tag;
        Logger.info(Logs.info.login.replace('{USER_TAG}', userTag));

        this.setupDatabase(this.client, this.guildRepo, this.userRepo);
        Logger.info(Logs.info.databaseReady);

        this.startJobs();
        Logger.info(Logs.info.startedVoiceXpJob);

        this.ready = true;
    }

    private onShardReady(shardId: number): void {
        Logger.setShardId(shardId);
    }

    private onMessage(msg: Message): void {
        if (!this.ready) {
            return;
        }

        this.messageHandler.process(msg);
    }

    private onGuildJoin(guild: Guild) {
        if (!this.ready) return;
        this.guildJoinHandler.process(guild);
    }

    private onUserJoin(event: any) {
        if (!this.ready) return;
        this.userJoinHandler.process(event);
    }

    private onReactionAdd(event: any, user: User) {
        if (!this.ready) return;
        this.reactionAddHandler.process(event, user);
    }
    private onReactionRemove(event: any, user: User) {
        if (!this.ready) return;
        this.reactionRemoveHandler.process(event, user);
    }

    private async setupDatabase(
        client: Client,
        guildRepo: GuildRepo,
        userRepo: UserRepo
    ): Promise<void> {
        let guilds = client.guilds.cache;

        for (let guild of guilds.array()) {
            guildRepo.syncGuild(guild.id, guild.members.cache.keyArray());
        }
    }
}
