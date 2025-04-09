import {
    Cascade,
    Collection,
    Entity,
    OneToMany,
    PrimaryKey,
    Property,
    SerializedPrimaryKey,
    Unique,
} from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

import { GuildUserData } from './index.js';
import { TimeUtils } from '../../utils/index.js';

@Entity({ collection: 'users' })
@Unique({ properties: ['discordId'] })
export class UserData {
    @PrimaryKey()
    _id: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property()
    discordId!: string;

    @Property()
    created = TimeUtils.now().toISO();

    @OneToMany(() => GuildUserData, guildUser => guildUser.user, { cascade: [Cascade.ALL] })
    guildDatas = new Collection<GuildUserData>(this);

    constructor(userDiscordId: string) {
        this.discordId = userDiscordId;
    }
}
