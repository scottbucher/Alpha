import { Loaded } from '@mikro-orm/core';
import { MongoDriver, MongoEntityManager } from '@mikro-orm/mongodb';
import { Locale } from 'discord.js';

import { GuildData, GuildUserData, LevelingRewardData } from '../database/entities/index.js';

// This class is used to store and pass data along in events
export class EventData {
    constructor(
        public lang: Locale,
        public langGuild: Locale,
        public em: MongoEntityManager<MongoDriver>,
        public guildData?: Loaded<GuildData>,
        public levelingRewardDatas?: Loaded<LevelingRewardData, 'guild'>,
        // Used when we get the guild user data for the command user or a user used in an argument of the command
        // TODO: better name?
        public guildUserData?: Loaded<GuildUserData>,
        // Used when we get the guild user data for all members in the guild
        // TODO: better name?
        public allGuildUserData?: GuildUserData[]
    ) {}
}

export interface ButtonData {
    id?: string; // Button ID
    lc?: string; // Link Command
    lg?: Locale; // Language
    pg?: number; // Page
}
