import { ButtonInteraction } from 'discord.js';

import { Button, ButtonDeferType } from './index.js';
import { Language } from '../models/enum-helpers/index.js';
import { ButtonData, EventData } from '../models/internal-models.js';
import { Lang } from '../services/index.js';
import { Command } from '../commands/index.js';
import { LeaderboardCommand } from '../commands/chat/index.js';

export class LeaderboardButton implements Button {
    public ids = [
        [Lang.getRef('commands', 'chatCommands.leaderboard', Language.Default)].join(' '),
    ];
    public deferType = ButtonDeferType.UPDATE;
    public requireGuild = true;
    public requireEmbedAuthorTag = false;
    public correspondingCommand: Command;
    constructor(private leaderboardCommand: LeaderboardCommand) {
        this.correspondingCommand = leaderboardCommand;
    }

    public async execute(
        intr: ButtonInteraction,
        btnData: ButtonData,
        data: EventData
    ): Promise<void> {
        // Execute the command
        await this.leaderboardCommand.executeByButton(intr, btnData, data);
    }
}
