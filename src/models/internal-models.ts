import { Loaded } from '@mikro-orm/core';
import { MongoEntityManager, MongoDriver } from '@mikro-orm/mongodb';
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
        public guildUserData?: Loaded<GuildUserData>
    ) {}
}

export interface ButtonData {
    id?: string; // Button ID
    lc?: string; // Link Command
    lg?: Locale; // Language
    pg?: number; // Page
}
