import {
    APIApplicationCommandBasicOption,
    APIApplicationCommandOptionChoice,
    ApplicationCommandOptionType,
} from 'discord.js';

import { ChannelType, HelpOption, InfoOption } from '../enums/index.js';
import {
    ChannelTypeHelper,
    HelpOptionHelper,
    InfoOptionHelper,
    Language,
} from '../models/enum-helpers/index.js';
import { Lang } from '../services/index.js';

export class Args {
    public static readonly HELP_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.option', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.option'),
        description: Lang.getRef('commands', 'argDescs.helpOption', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.helpOption'),
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: Object.values(HelpOption).map(
            choice =>
                <APIApplicationCommandOptionChoice<string>>{
                    name: HelpOptionHelper.Data[choice].displayName(Language.Default),
                    name_localizations: HelpOptionHelper.Data[choice].localizationMap(),
                    value: choice,
                }
        ),
    };

    public static readonly INFO_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.option', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.option'),
        description: Lang.getRef('commands', 'argDescs.infoOption', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.infoOption'),
        type: ApplicationCommandOptionType.String,
        choices: Object.values(InfoOption).map(
            choice =>
                <APIApplicationCommandOptionChoice<string>>{
                    name: InfoOptionHelper.Data[choice].displayName(Language.Default),
                    name_localizations: InfoOptionHelper.Data[choice].localizationMap(),
                    value: choice,
                }
        ),
    };

    public static readonly USER_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.user', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.user'),
        description: Lang.getRef('commands', 'argDescs.user', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.user'),
        type: ApplicationCommandOptionType.User,
    };

    public static readonly QUOTE_USER_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.user', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.user'),
        description: Lang.getRef('commands', 'argDescs.quoteUser', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.quoteUser'),
        type: ApplicationCommandOptionType.User,
    };

    public static readonly QUOTE_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.quote', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.quote'),
        description: Lang.getRef('commands', 'argDescs.quote', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.quote'),
        type: ApplicationCommandOptionType.String,
    };

    public static readonly QUESTION_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.question', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.question'),
        description: Lang.getRef('commands', 'argDescs.question', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.question'),
        type: ApplicationCommandOptionType.String,
    };

    public static readonly PAGE_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.page', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.page'),
        description: Lang.getRef('commands', 'argDescs.page', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.page'),
        type: ApplicationCommandOptionType.Integer,
    };

    public static readonly CHANNEL_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.channel', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.channel'),
        description: Lang.getRef('commands', 'argDescs.channel', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.channel'),
        type: ApplicationCommandOptionType.Channel.valueOf(),
    };

    public static readonly CHANNEL_TYPE_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.type', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.type'),
        description: Lang.getRef('commands', 'argDescs.channelType', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.channelType'),
        type: ApplicationCommandOptionType.String.valueOf(),
        choices: Object.values(ChannelType).map(
            choice =>
                <APIApplicationCommandOptionChoice<string>>{
                    name: ChannelTypeHelper.Data[choice].displayName(Language.Default),
                    name_localizations: ChannelTypeHelper.Data[choice].localizationMap(),
                    value: choice,
                }
        ),
    };

    public static readonly ROLE_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.role', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.role'),
        description: Lang.getRef('commands', 'argDescs.role', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.role'),
        type: ApplicationCommandOptionType.Role.valueOf(),
    };

    public static readonly LEVEL_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.level', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.level'),
        description: Lang.getRef('commands', 'argDescs.level', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.level'),
        type: ApplicationCommandOptionType.Integer,
        min_value: 1,
        max_value: 1000,
    };

    public static readonly LEVELING_REWARD_ALIAS_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.levelingRewardAlias', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.levelingRewardAlias'),
        description: Lang.getRef('commands', 'argDescs.alias', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.alias'),
        type: ApplicationCommandOptionType.String.valueOf(),
        required: true,
        autocomplete: true,
    };

    public static readonly ID_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('commands', 'arguments.id', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'arguments.id'),
        description: Lang.getRef('commands', 'argDescs.removeId', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'argDescs.removeId'),
        type: ApplicationCommandOptionType.String.valueOf(),
        required: true,
    };
}
