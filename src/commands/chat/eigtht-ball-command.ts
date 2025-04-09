import {
    ChatInputCommandInteraction,
    ColorResolvable,
    EmbedBuilder,
    PermissionsString,
} from 'discord.js';
import { createRequire } from 'node:module';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const require = createRequire(import.meta.url);
// TODO: Eightball should be in the lang system
let EightBall = require('../../../config/eight-ball.json');

export class EightBallCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.eightBall', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireEventData: EventDataType[] = [];
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let question = intr.options.getString(
            Lang.getRef('commands', 'arguments.question', Language.Default)
        );

        if (!question.endsWith('?')) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.noPunctuation', data.lang)
            );
            return;
        }

        const outcomes = ['yes', 'maybe', 'no'];
        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        let response = `${Lang.getRef('info', 'terms.question', data.lang)}: ${question}\n\n${Lang.getRef('info', 'terms.eightBallSays', data.lang)}: `;
        let color: string;

        switch (outcome) {
            case 'yes':
                response +=
                    EightBall.data.yes[Math.floor(Math.random() * EightBall.data.yes.length)];
                color = Lang.getCom('colors.success');
                break;
            case 'maybe':
                response +=
                    EightBall.data.maybe[Math.floor(Math.random() * EightBall.data.maybe.length)];
                color = Lang.getCom('colors.warn');
                break;
            case 'no':
                response += EightBall.data.no[Math.floor(Math.random() * EightBall.data.no.length)];
                color = Lang.getCom('colors.error');
                break;
        }

        await InteractionUtils.send(
            intr,
            new EmbedBuilder().setColor(color as ColorResolvable).setDescription(response)
        );
    }
}
