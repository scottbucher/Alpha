import { ChatInputCommandInteraction, Guild, PermissionsString } from 'discord.js';

import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';
import { EventDataType } from '../../enums/index.js';

export class SettingsCommand implements Command {
    public names = [Lang.getRef('commands', 'chatCommands.settings', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireEventData: EventDataType[] = [EventDataType.GUILD_DATA];
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let guildData = data.guildData;
        let notSet = Lang.getRef('info', 'terms.notSet', data.lang);
        let date = new Date().getFullYear().toString();
        let deletedChannel = `**${Lang.getRef('info', 'terms.deletedChannel', data.lang)}**`;

        const serverLanguage = Language.Data[guildData.generalSettings.language].nativeName;
        const serverTimeZone = guildData.generalSettings.timeZone ?? notSet;
        const channelSettings = {
            WELCOME_CHANNEL: guildData.welcomeSettings.channelDiscordId,
            LEVELING_CHANNEL: guildData.levelingSettings.channelDiscordId,
            QUOTE_CHANNEL: guildData.quoteSettings.channelDiscordId,
            POLL_CHANNEL: guildData.pollSettings.channelDiscordId,
            EVENT_CHANNEL: guildData.eventSettings.channelDiscordId,
        };

        let channelDisplays = await Promise.all(
            Object.entries(channelSettings).map(async ([key, channelId]) => [
                key,
                await this.getChannelDisplay(channelId, intr.guild, notSet, deletedChannel),
            ])
        );

        let embed = Lang.getEmbed('info', 'embeds.settings', data.lang, {
            ...Object.fromEntries(channelDisplays),
            SERVER_LANGUAGE: serverLanguage,
            SERVER_TIME_ZONE: serverTimeZone,
            SERVER_NAME: intr.guild.name,
            GUILD_ID: intr.guild.id,
            DATE: date,
            ICON: intr.client.user.displayAvatarURL(),
        });

        await InteractionUtils.send(intr, embed);
    }

    private async getChannelDisplay(
        channelDiscordId: string,
        guild: Guild,
        notSet: string,
        deletedChannel: string
    ): Promise<string> {
        return !channelDiscordId
            ? notSet
            : guild.channels.resolve(channelDiscordId)?.toString() || deletedChannel;
    }
}
