import { ButtonInteraction } from 'discord.js';

import { ButtonData, EventData } from '../models/internal-models.js';
import { Command } from '../commands/index.js';

export interface Button {
    ids: string[];
    correspondingCommand: Command;
    deferType: ButtonDeferType;
    requireGuild: boolean;
    requireEmbedAuthorTag: boolean;
    execute(intr: ButtonInteraction, btnData: ButtonData, data: EventData): Promise<void>;
}

export enum ButtonDeferType {
    REPLY = 'REPLY',
    UPDATE = 'UPDATE',
    NONE = 'NONE',
}
