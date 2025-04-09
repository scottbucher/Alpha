import {
    Entity,
    Index,
    ManyToOne,
    PrimaryKey,
    Property,
    Ref,
    SerializedPrimaryKey,
    Unique,
} from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

import { GuildData } from './index.js';
import { RandomUtils, TimeUtils } from '../../utils/index.js';

@Entity({ collection: 'levelingRewards' })
@Unique({ properties: ['guild', 'alias'] })
@Unique({ properties: ['guild', 'level'] })
@Index({ properties: ['guild'] })
export class LevelingRewardData {
    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property()
    guildDiscordId!: string;

    // Arguably we have no use of aliases now, but I could see a future where we want to use them so I'm keeping it here
    @Property()
    alias = RandomUtils.friendlyId(6);

    @Property()
    roleDiscordIds: string[] = [];

    @Property()
    level!: number;

    // Times
    @Property()
    created = TimeUtils.now().toISO();

    // Relationships
    @ManyToOne()
    guild!: Ref<GuildData>;

    constructor(guildDiscordId: string, roleDiscordIds: string | string[], level: number) {
        this.guildDiscordId = guildDiscordId;
        this.roleDiscordIds = Array.isArray(roleDiscordIds) ? roleDiscordIds : [roleDiscordIds];
        this.level = level;
    }
}
