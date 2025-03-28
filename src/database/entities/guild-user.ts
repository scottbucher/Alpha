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

import { TimeUtils } from '../../utils/index.js';
import { GuildData } from './guild.js';
import { UserData } from './index.js';

@Entity({ collection: 'guildUser' })
@Unique({ properties: ['guildDiscordId', 'userDiscordId'] })
@Index({ properties: ['guildDiscordId'] })
@Index({ properties: ['userDiscordId'] })
export class GuildUserData {
    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property()
    guildDiscordId!: string;

    @Property()
    userDiscordId!: string;

    @Property()
    experience = 0;

    @Property()
    created = TimeUtils.now().toISO();

    @Property()
    lastGivenMessageXp = TimeUtils.now().toISO();

    @ManyToOne()
    guild!: Ref<GuildData>;

    @ManyToOne()
    user!: Ref<UserData>;

    constructor(
        guildData: Ref<GuildData>,
        userData: Ref<UserData>,
        experience: number,
        lastGivenMessageXp: string
    ) {
        this.guild = guildData;
        this.user = userData;
        this.experience = experience;
        this.lastGivenMessageXp = lastGivenMessageXp;
    }
}
