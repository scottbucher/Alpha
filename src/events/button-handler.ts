import { ButtonInteraction } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';
import { createRequire } from 'node:module';

import { EventHandler } from './index.js';
import { Button, ButtonDeferType } from '../buttons/index.js';
import { ButtonData } from '../models/internal-models.js';
import { EventDataService } from '../services/index.js';
import { CommandUtils, InteractionUtils, MessageUtils, PermissionUtils } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

export class ButtonHandler implements EventHandler {
    private rateLimiter = new RateLimiter(
        Config.rateLimiting.buttons.amount,
        Config.rateLimiting.buttons.interval * 1000
    );

    constructor(
        private buttons: Button[],
        private eventDataService: EventDataService
    ) {}

    public async process(intr: ButtonInteraction): Promise<void> {
        // Don't respond to self, or other bots
        if (intr.user.id === intr.client.user?.id || intr.user.bot) {
            return;
        }

        // Check if user is rate limited
        let limited = this.rateLimiter.take(intr.user.id);
        if (limited) {
            return;
        }

        // Parse button data
        let btnData: ButtonData;
        try {
            btnData = JSON.parse(intr.customId);
        } catch (error) {
            // Ignore
            return;
        }

        // Try to find the button the user wants
        let button = this.findButton(btnData.id);
        if (!button) {
            return;
        }

        if (button.requireGuild && !intr.guild) {
            return;
        }

        // Check if the embeds author equals the users tag
        if (
            button.requireEmbedAuthorTag &&
            intr.message.embeds[0]?.author?.name !== intr.user.globalName
        ) {
            return;
        }

        // Check if we have permission to edit the message since all Birthday Bot's buttons edit the message
        // TODO: If we add buttons that don't edit the message in the future, this will need to be changed
        if (!PermissionUtils.canSend(intr.channel)) {
            return;
        }

        // Defer interaction
        // NOTE: Anything after this point we should be responding to the interaction
        switch (button.deferType) {
            case ButtonDeferType.REPLY: {
                await InteractionUtils.deferReply(intr);
                break;
            }
            case ButtonDeferType.UPDATE: {
                await InteractionUtils.deferAndDisableButtonsForLists(intr, intr.message, btnData);
                break;
            }
        }

        // Return if defer was unsuccessful
        if (button.deferType !== ButtonDeferType.NONE && !intr.deferred) {
            return;
        }

        // Get data from database
        // TODO: Implement new database data
        let data = await this.eventDataService.create({
            guild: intr.guild,
            requireEventData: button.requireEventData,
        });

        // Check if interaction passes command checks
        let passesChecks = await CommandUtils.runChecks(button.correspondingCommand, intr, data);
        if (!passesChecks) {
            // we need to re-enable the buttons
            await MessageUtils.enableButtons(intr.message, button.correspondingCommand.names);
            return;
        }

        // Execute the button
        await button.execute(intr, btnData, data);
    }

    private findButton(id: string): Button {
        return this.buttons.find(button => button.ids.includes(id));
    }
}
