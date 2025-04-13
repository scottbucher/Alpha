import { ButtonInteraction } from 'discord.js';

import { Button, ButtonDeferType } from './index.js';
import { ViewRewardsCommand } from '../commands/chat/index.js';
import { Command } from '../commands/index.js';
import { EventDataType } from '../enums/index.js';
import { Language } from '../models/enum-helpers/index.js';
import { ButtonData, EventData } from '../models/internal-models.js';
import { Lang } from '../services/index.js';

export class ViewRewardsButton implements Button {
    public ids = [Lang.getRef('commands', 'chatCommands.viewRewards', Language.Default)];
    public deferType = ButtonDeferType.UPDATE;
    public requireGuild = true;
    public requireEmbedAuthorTag = false;
    public correspondingCommand: Command;
    public requireEventData: EventDataType[] = [
        EventDataType.GUILD_DATA,
        EventDataType.LEVELING_REWARD_DATA,
    ];

    constructor(private viewRewardsCommand: ViewRewardsCommand) {
        this.correspondingCommand = viewRewardsCommand;
    }

    public async execute(
        intr: ButtonInteraction,
        btnData: ButtonData,
        data: EventData
    ): Promise<void> {
        // Execute the command
        await this.viewRewardsCommand.executeByButton(intr, btnData, data);
    }
}
