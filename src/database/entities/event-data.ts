import {
    Embeddable,
    Embedded,
    Entity,
    Index,
    ManyToOne,
    PrimaryKey,
    Property,
    Ref,
    SerializedPrimaryKey,
} from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { TimeUtils } from '../../utils/index.js';
import { GuildData } from './guild.js';

// Used to ensure we have language keys for all multipliers
export type XpMultiplier = 2 | 3 | 4;

// The idea of this is we could add things like, message xp min/max, voice xp amount, etc.
@Embeddable()
export class XpProperties {
    @Property()
    multiplier!: XpMultiplier;
}

@Embeddable()
export class TimeProperties {
    @Property()
    startTime!: string;

    @Property()
    endTime!: string;

    // Used so we don't send duplicate messages when the event starts
    @Property()
    hasStarted = false;

    // Used so we don't send duplicate messages when the event ends
    @Property()
    hasEnded = false;

    // Used so we don't send duplicate announcement messages when the event is announced that it will be in 2 weeks
    @Property()
    hasAnnounced = false;

    // Used for fast checks if the event is active
    @Property()
    isActive = false;
}

@Entity({ collection: 'events' })
@Index({ properties: ['guild'] })
export class EventData {
    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property()
    created = TimeUtils.now().toISO();

    @Embedded({ object: true })
    timeProperties = new TimeProperties();

    @Embedded({ object: true })
    xpProperties = new XpProperties();

    @ManyToOne()
    guild!: Ref<GuildData>;

    constructor(guild: Ref<GuildData>, startTime: string, endTime: string) {
        this.guild = guild;
        this.timeProperties.startTime = startTime;
        this.timeProperties.endTime = endTime;
    }
}
