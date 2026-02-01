import {
    Embeddable,
    Embedded,
    Entity,
    ManyToOne,
    PrimaryKey,
    Property,
    Ref,
    SerializedPrimaryKey,
    Unique,
} from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

import { GuildUserData } from './index.js';
import { TimeUtils } from '../../utils/index.js';

@Embeddable()
export class XpStats {
    @Property()
    startingXp!: number;

    @Property()
    minutesSpentInVoice!: number;

    @Property()
    messagesSent!: number;

    constructor(startingXp: number, minutesSpentInVoice: number, messagesSent: number) {
        this.startingXp = startingXp;
        this.minutesSpentInVoice = minutesSpentInVoice;
        this.messagesSent = messagesSent;
    }
}

@Entity({ collection: 'guildUserDailyStatisticsDatas' })
@Unique({ properties: ['guildUser', 'dayString'] })
export class GuildUserDailyStatisticsData {
    @PrimaryKey()
    _id: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property()
    created = TimeUtils.now().toISO();

    @ManyToOne()
    guildUser!: Ref<GuildUserData>;

    @Embedded({ object: true, nullable: true })
    xpStats?: XpStats;

    // The date string for the statistics (YYYY-MM-DD) - This is used to group statistics by day, and can be used to update the statistics throughout the day
    @Property()
    dayString!: string;

    constructor(guildUserData: Ref<GuildUserData>, dayString: string, xpStats?: XpStats) {
        this.guildUser = guildUserData;
        this.dayString = dayString;
        this.xpStats = xpStats;
    }
}
