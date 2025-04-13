import { Message } from 'discord.js';

import { EventData } from '../models/internal-models.js';
import { EventDataType } from '../enums/index.js';

export interface Trigger {
    requireGuild: boolean;
    requireEventData: EventDataType[];
    triggered(msg: Message): boolean;
    execute(msg: Message, data: EventData): Promise<void>;
}
