import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    PermissionFlagsBits,
    PermissionsBitField,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';

import { Args } from './index.js';
import { Language } from '../models/enum-helpers/index.js';
import { Lang } from '../services/index.js';

export const ChatCommandMetadata: {
    [command: string]: RESTPostAPIChatInputApplicationCommandsJSONBody;
} = {
    DEV: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.dev', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.dev'),
        description: Lang.getRef('commands', 'commandDescs.dev', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.dev'),
        dm_permission: true,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.Administrator,
        ]).toString(),
    },
    HELP: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.help', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.help'),
        description: Lang.getRef('commands', 'commandDescs.help', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.help'),
        dm_permission: true,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.HELP_OPTION,
                required: true,
            },
        ],
    },
    INFO: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.info', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.info'),
        description: Lang.getRef('commands', 'commandDescs.info', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.info'),
        dm_permission: true,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.INFO_OPTION,
                required: true,
            },
        ],
    },
    MAP: {
        name: Lang.getRef('commands', 'chatCommands.map', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.map'),
        description: Lang.getRef('commands', 'commandDescs.map', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.map'),
        dm_permission: true,
        default_member_permissions: undefined,
    },
    CHANNEL_PERMISSIONS: {
        name: Lang.getRef('commands', 'chatCommands.channelPermissions', Language.Default),
        name_localizations: Lang.getRefLocalizationMap(
            'commands',
            'chatCommands.channelPermissions'
        ),
        description: Lang.getRef('commands', 'commandDescs.channelPermissions', Language.Default),
        description_localizations: Lang.getRefLocalizationMap(
            'commands',
            'commandDescs.channelPermissions'
        ),
        dm_permission: false,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageGuild,
        ]).toString(),
        options: [
            {
                ...Args.CHANNEL_PERMISSIONS_OPTION,
                required: false,
            },
        ],
    },
    XP: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.xp', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.xp'),
        description: Lang.getRef('commands', 'commandDescs.xp', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.xp'),
        dm_permission: false,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.USER_OPTION,
                required: false,
            },
        ],
    },
    LEADERBOARD: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.leaderboard', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.leaderboard'),
        description: Lang.getRef('commands', 'commandDescs.leaderboard', Language.Default),
        description_localizations: Lang.getRefLocalizationMap(
            'commands',
            'commandDescs.leaderboard'
        ),
        dm_permission: false,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.PAGE_OPTION,
                required: false,
            },
        ],
    },
    EDIT: {
        name: Lang.getRef('commands', 'chatCommands.edit', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.edit'),
        description: Lang.getRef('commands', 'commandDescs.edit', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.edit'),
        dm_permission: false,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageGuild,
        ]).toString(),
        options: [
            {
                name: Lang.getRef('commands', 'chatCommands.channel', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.channel'),
                description: Lang.getRef('commands', 'commandDescs.channel', Language.Default),
                description_localizations: Lang.getRefLocalizationMap(
                    'commands',
                    'commandDescs.channel'
                ),
                type: ApplicationCommandOptionType.Subcommand.valueOf(),
                options: [
                    {
                        ...Args.CHANNEL_TYPE_OPTION,
                        required: true,
                    },
                    {
                        ...Args.CHANNEL_OPTION,
                        required: false,
                    },
                ],
            },
            {
                name: Lang.getRef('commands', 'chatCommands.timeZone', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.timeZone'),
                description: Lang.getRef('commands', 'commandDescs.timeZone', Language.Default),
                description_localizations: Lang.getRefLocalizationMap(
                    'commands',
                    'commandDescs.timeZone'
                ),
                type: ApplicationCommandOptionType.Subcommand.valueOf(),
                options: [
                    {
                        ...Args.TIME_ZONE_OPTION,
                        required: true,
                    },
                ],
            },
        ],
    },
    LEVEL_REWARD: {
        name: Lang.getRef('commands', 'chatCommands.reward', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.reward'),
        description: Lang.getRef('commands', 'commandDescs.reward', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.reward'),
        dm_permission: false,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageGuild,
        ]).toString(),
        options: [
            {
                name: Lang.getRef('commands', 'chatCommands.addRole', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.addRole'),
                description: Lang.getRef('commands', 'commandDescs.levelRoleAdd', Language.Default),
                description_localizations: Lang.getRefLocalizationMap(
                    'commands',
                    'commandDescs.levelRoleAdd'
                ),
                type: ApplicationCommandOptionType.Subcommand.valueOf(),
                options: [
                    {
                        ...Args.ROLE_OPTION,
                        required: true,
                    },
                    {
                        ...Args.LEVEL_OPTION,
                        required: true,
                    },
                ],
            },
            {
                name: Lang.getRef('commands', 'chatCommands.remove', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.remove'),
                description: Lang.getRef(
                    'commands',
                    'commandDescs.removeLevelRole',
                    Language.Default
                ),
                description_localizations: Lang.getRefLocalizationMap(
                    'commands',
                    'commandDescs.removeLevelRole'
                ),
                type: ApplicationCommandOptionType.SubcommandGroup.valueOf(),
                options: [
                    {
                        name: Lang.getRef('commands', 'chatCommands.role', Language.Default),
                        name_localizations: Lang.getRefLocalizationMap(
                            'commands',
                            'chatCommands.role'
                        ),
                        description: Lang.getRef(
                            'commands',
                            'commandDescs.removeLevelRole',
                            Language.Default
                        ),
                        description_localizations: Lang.getRefLocalizationMap(
                            'commands',
                            'commandDescs.removeLevelRole'
                        ),
                        type: ApplicationCommandOptionType.Subcommand.valueOf(),
                        options: [
                            {
                                ...Args.LEVEL_OPTION,
                                required: true,
                            },
                            {
                                ...Args.ROLE_OPTION,
                                required: true,
                            },
                        ],
                    },
                    {
                        name: Lang.getRef('commands', 'chatCommands.id', Language.Default),
                        name_localizations: Lang.getRefLocalizationMap(
                            'commands',
                            'chatCommands.id'
                        ),
                        description: Lang.getRef(
                            'commands',
                            'commandDescs.removeId',
                            Language.Default
                        ),
                        description_localizations: Lang.getRefLocalizationMap(
                            'commands',
                            'commandDescs.removeId'
                        ),
                        type: ApplicationCommandOptionType.Subcommand.valueOf(),
                        options: [
                            {
                                ...Args.LEVEL_OPTION,
                                required: true,
                            },
                            {
                                ...Args.ID_OPTION,
                                required: true,
                            },
                        ],
                    },
                ],
            },
            {
                name: Lang.getRef('commands', 'chatCommands.clearRoles', Language.Default),
                name_localizations: Lang.getRefLocalizationMap(
                    'commands',
                    'chatCommands.clearRoles'
                ),
                description: Lang.getRef(
                    'commands',
                    'commandDescs.levelRoleClear',
                    Language.Default
                ),
                type: ApplicationCommandOptionType.Subcommand.valueOf(),
                options: [
                    {
                        ...Args.LEVEL_OPTION,
                        required: true,
                    },
                ],
            },
        ],
    },
    VIEW_REWARDS: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.viewRewards', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.viewRewards'),
        description: Lang.getRef('commands', 'commandDescs.viewRewards', Language.Default),
        description_localizations: Lang.getRefLocalizationMap(
            'commands',
            'commandDescs.viewRewards'
        ),
        dm_permission: false,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.PAGE_OPTION,
                required: false,
            },
        ],
    },
    QUOTE: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.quote', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.quote'),
        description: Lang.getRef('commands', 'commandDescs.quote', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.quote'),
        dm_permission: false,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.QUOTE_OPTION,
                required: true,
            },
            {
                ...Args.QUOTE_USER_OPTION,
                required: false,
            },
        ],
    },
    EIGHT_BALL: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.eightBall', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.eightBall'),
        description: Lang.getRef('commands', 'commandDescs.eightBall', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.eightBall'),
        dm_permission: false,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.QUESTION_OPTION,
                required: true,
            },
        ],
    },
    SERVER_INFO: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.serverInfo', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.serverInfo'),
        description: Lang.getRef('commands', 'commandDescs.serverInfo', Language.Default),
        description_localizations: Lang.getRefLocalizationMap(
            'commands',
            'commandDescs.serverInfo'
        ),
        dm_permission: false,
        default_member_permissions: undefined,
    },
    JOIN_ROLE: {
        name: Lang.getRef('commands', 'chatCommands.joinRoles', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.joinRoles'),
        description: Lang.getRef('commands', 'commandDescs.joinRoles', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.joinRoles'),
        dm_permission: false,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageGuild,
        ]).toString(),
        options: [
            {
                name: Lang.getRef('commands', 'chatCommands.add', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.add'),
                description: Lang.getRef('commands', 'commandDescs.addJoinRole', Language.Default),
                description_localizations: Lang.getRefLocalizationMap(
                    'commands',
                    'commandDescs.addJoinRole'
                ),
                type: ApplicationCommandOptionType.Subcommand.valueOf(),
                options: [
                    {
                        ...Args.ROLE_OPTION,
                        required: true,
                    },
                ],
            },
            {
                name: Lang.getRef('commands', 'chatCommands.remove', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.remove'),
                description: Lang.getRef(
                    'commands',
                    'commandDescs.removeJoinRole',
                    Language.Default
                ),
                description_localizations: Lang.getRefLocalizationMap(
                    'commands',
                    'commandDescs.removeJoinRole'
                ),
                type: ApplicationCommandOptionType.SubcommandGroup.valueOf(),
                options: [
                    {
                        name: Lang.getRef('commands', 'chatCommands.role', Language.Default),
                        name_localizations: Lang.getRefLocalizationMap(
                            'commands',
                            'chatCommands.role'
                        ),
                        description: Lang.getRef(
                            'commands',
                            'commandDescs.removeJoinRole',
                            Language.Default
                        ),
                        description_localizations: Lang.getRefLocalizationMap(
                            'commands',
                            'commandDescs.removeJoinRole'
                        ),
                        type: ApplicationCommandOptionType.Subcommand.valueOf(),
                        options: [
                            {
                                ...Args.ROLE_OPTION,
                                required: true,
                            },
                        ],
                    },
                    {
                        name: Lang.getRef('commands', 'chatCommands.id', Language.Default),
                        name_localizations: Lang.getRefLocalizationMap(
                            'commands',
                            'chatCommands.id'
                        ),
                        description: Lang.getRef(
                            'commands',
                            'commandDescs.removeJoinRoleId',
                            Language.Default
                        ),
                        description_localizations: Lang.getRefLocalizationMap(
                            'commands',
                            'commandDescs.removeJoinRoleId'
                        ),
                        type: ApplicationCommandOptionType.Subcommand.valueOf(),
                        options: [
                            {
                                ...Args.ID_OPTION,
                                required: true,
                            },
                        ],
                    },
                ],
            },
            {
                name: Lang.getRef('commands', 'chatCommands.clear', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.clear'),
                description: Lang.getRef(
                    'commands',
                    'commandDescs.clearJoinRoles',
                    Language.Default
                ),
                description_localizations: Lang.getRefLocalizationMap(
                    'commands',
                    'commandDescs.clearJoinRoles'
                ),
                type: ApplicationCommandOptionType.Subcommand.valueOf(),
            },
        ],
    },
    VIEW_JOIN_ROLES: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('commands', 'chatCommands.viewJoinRoles', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.viewJoinRoles'),
        description: Lang.getRef('commands', 'commandDescs.viewJoinRoles', Language.Default),
        description_localizations: Lang.getRefLocalizationMap(
            'commands',
            'commandDescs.viewJoinRoles'
        ),
        dm_permission: false,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.PAGE_OPTION,
                required: false,
            },
        ],
    },
    SETTINGS: {
        name: Lang.getRef('commands', 'chatCommands.settings', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'chatCommands.settings'),
        description: Lang.getRef('commands', 'commandDescs.settings', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commands', 'commandDescs.settings'),
        dm_permission: false,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageGuild,
        ]).toString(),
    },
};

export const MessageCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {
    QUOTE: {
        type: ApplicationCommandType.Message,
        name: Lang.getRef('commands', 'messageCommands.quote', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('commands', 'messageCommands.quote'),
        default_member_permissions: undefined,
        dm_permission: false,
    },
};

export const UserCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {};
