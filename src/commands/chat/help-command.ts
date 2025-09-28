import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';

import { EventDataType, HelpOption } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class HelpCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.help', Language.Default)];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let args = {
            option: intr.options.getString(
                Lang.getRef('commands', 'arguments.option', Language.Default)
            ) as HelpOption,
        };

        let embed: EmbedBuilder;
        switch (args.option) {
            case HelpOption.COMMANDS: {
                embed = Lang.getEmbed('info', 'help.commands', data.lang);
                break;
            }
            case HelpOption.PERMISSIONS: {
                embed = Lang.getEmbed('info', 'help.permissions', data.lang);
                break;
            }
            case HelpOption.XP: {
                embed = Lang.getEmbed('info', 'help.xp', data.lang);
                break;
            }
        }

        await InteractionUtils.send(intr, embed);
    }
}
