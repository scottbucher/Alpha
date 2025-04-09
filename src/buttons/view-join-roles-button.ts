import { ButtonInteraction } from 'discord.js';

import { Button, ButtonDeferType } from './index.js';
import { Language } from '../models/enum-helpers/index.js';
import { ButtonData, EventData } from '../models/internal-models.js';
import { Lang } from '../services/index.js';
import { Command } from '../commands/index.js';
import { ViewJoinRolesCommand } from '../commands/chat/index.js';
import { EventDataType } from '../enums/index.js';

export class ViewJoinRolesButton implements Button {
    public ids = [Lang.getRef('commands', 'chatCommands.viewJoinRoles', Language.Default)];
    public deferType = ButtonDeferType.UPDATE;
    public requireGuild = true;
    public requireEmbedAuthorTag = false;
    public correspondingCommand: Command;
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    constructor(private viewJoinRolesCommand: ViewJoinRolesCommand) {
        this.correspondingCommand = viewJoinRolesCommand;
    }

    public async execute(
        intr: ButtonInteraction,
        btnData: ButtonData,
        data: EventData
    ): Promise<void> {
        // Execute the command
        await this.viewJoinRolesCommand.executeByButton(intr, btnData, data);
    }
}
