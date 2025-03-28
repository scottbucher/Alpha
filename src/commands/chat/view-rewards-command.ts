import {
    BaseMessageOptions,
    ButtonInteraction,
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionsString,
    Role,
} from 'discord.js';

import { EventDataType } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { ButtonData, EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils, ListUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';
import { PageStats } from '../../models/page-stats.js';

export class ViewRewardsCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.viewRewards', Language.Default)];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let page =
            intr.options.getInteger(Lang.getRef('commands', 'arguments.page', Language.Default)) ??
            1;

        await InteractionUtils.send(intr, await this.run(intr, { page }, data));
    }

    public async executeByButton(
        intr: ButtonInteraction,
        btnData: ButtonData,
        data: EventData
    ): Promise<void> {
        let args = {
            page: btnData.pg,
        };
        // Defer and disable buttons
        let options = await this.run(intr, args, data);
        await InteractionUtils.editReply(intr, options);
    }

    public async run(
        intr: ChatInputCommandInteraction | ButtonInteraction,
        args: {
            page: number;
        },
        data: EventData
    ): Promise<BaseMessageOptions> {
        let embedData: { embed: EmbedBuilder; pageStats: PageStats };
        embedData = await ListUtils.getRewardListEmbed(intr.guild, args.page, data);

        return <BaseMessageOptions>{
            embeds: [embedData.embed],
            components: [
                ListUtils.getListButtonComponentData(
                    intr.guild,
                    intr.channel.id,
                    this.names,
                    embedData.pageStats.page
                ),
            ],
        };
    }
}
