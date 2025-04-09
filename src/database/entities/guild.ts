import {
    Cascade,
    Collection,
    Embeddable,
    Embedded,
    Entity,
    OneToMany,
    PrimaryKey,
    Property,
    SerializedPrimaryKey,
    Unique,
} from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

import { EventData, GuildUserData, LevelingRewardData } from './index.js';
import { LangCode } from '../../enums/index.js';
import { TimeUtils } from '../../utils/index.js';

@Embeddable()
export class GuildSettings {
    @Property()
    language = LangCode.EN_US;

    @Property()
    timeZone?: string;
}

@Embeddable()
export class EventSettings {
    @Property()
    channelDiscordId?: string;
}

@Embeddable()
export class LevelingSettings {
    @Property()
    channelDiscordId?: string;
}

@Embeddable()
export class WelcomeSettings {
    @Property()
    channelDiscordId?: string;

    @Property()
    joinRoleDiscordIds: string[] = [];
}

@Embeddable()
export class QuoteSettings {
    @Property()
    channelDiscordId?: string;
}

@Embeddable()
export class PollSettings {
    @Property()
    channelDiscordId?: string;
}

@Entity({ collection: 'guilds' })
@Unique({ properties: ['discordId'] })
export class GuildData {
    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property()
    discordId!: string;

    @Embedded({ object: true })
    generalSettings = new GuildSettings();

    @Embedded({ object: true })
    levelingSettings = new LevelingSettings();

    @Embedded({ object: true })
    welcomeSettings = new WelcomeSettings();

    @Embedded({ object: true })
    quoteSettings = new QuoteSettings();

    @Embedded({ object: true })
    pollSettings = new PollSettings();

    @Embedded({ object: true })
    eventSettings = new EventSettings();

    @Property()
    created = TimeUtils.now().toISO();

    @OneToMany(() => LevelingRewardData, reward => reward.guild, { cascade: [Cascade.ALL] })
    levelingRewardDatas = new Collection<LevelingRewardData>(this);

    @OneToMany(() => GuildUserData, guildUser => guildUser.guild, { cascade: [Cascade.ALL] })
    userDatas = new Collection<GuildUserData>(this);

    @OneToMany(() => EventData, event => event.guild, { cascade: [Cascade.ALL] })
    eventDatas = new Collection<EventData>(this);

    constructor(discordId: string) {
        this.discordId = discordId;
    }
}
