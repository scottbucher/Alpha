import { Locale, PermissionsString } from 'discord.js';

import { Lang } from '../../services/index.js';

interface PermissionData {
    displayName(langCode: Locale): string;
}

export class Permission {
    public static Data: {
        [key in PermissionsString]: PermissionData;
    } = {
        AddReactions: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.AddReactions', langCode);
            },
        },
        Administrator: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.Administrator', langCode);
            },
        },
        AttachFiles: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.AttachFiles', langCode);
            },
        },
        BanMembers: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.BanMembers', langCode);
            },
        },
        BypassSlowmode: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.BypassSlowmode', langCode);
            },
        },
        ChangeNickname: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ChangeNickname', langCode);
            },
        },
        Connect: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.Connect', langCode);
            },
        },
        CreateEvents: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.CreateEvents', langCode);
            },
        },
        CreateGuildExpressions: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.CreateGuildExpressions', langCode);
            },
        },
        CreateInstantInvite: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.CreateInstantInvite', langCode);
            },
        },
        CreatePrivateThreads: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.CreatePrivateThreads', langCode);
            },
        },
        CreatePublicThreads: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.CreatePublicThreads', langCode);
            },
        },
        DeafenMembers: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.DeafenMembers', langCode);
            },
        },
        EmbedLinks: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.EmbedLinks', langCode);
            },
        },
        KickMembers: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.KickMembers', langCode);
            },
        },
        ManageChannels: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageChannels', langCode);
            },
        },
        ManageEmojisAndStickers: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageEmojisAndStickers', langCode);
            },
        },
        ManageEvents: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageEvents', langCode);
            },
        },
        ManageGuild: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageGuild', langCode);
            },
        },
        ManageGuildExpressions: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageGuildExpressions', langCode);
            },
        },
        ManageMessages: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageMessages', langCode);
            },
        },
        ManageNicknames: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageNicknames', langCode);
            },
        },
        ManageRoles: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageRoles', langCode);
            },
        },
        ManageThreads: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageThreads', langCode);
            },
        },
        ManageWebhooks: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ManageWebhooks', langCode);
            },
        },
        MentionEveryone: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.MentionEveryone', langCode);
            },
        },
        ModerateMembers: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ModerateMembers', langCode);
            },
        },
        MoveMembers: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.MoveMembers', langCode);
            },
        },
        MuteMembers: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.MuteMembers', langCode);
            },
        },
        PinMessages: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.PinMessages', langCode);
            },
        },
        PrioritySpeaker: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.PrioritySpeaker', langCode);
            },
        },
        ReadMessageHistory: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ReadMessageHistory', langCode);
            },
        },
        RequestToSpeak: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.RequestToSpeak', langCode);
            },
        },
        SendMessages: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.SendMessages', langCode);
            },
        },
        SendMessagesInThreads: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.SendMessagesInThreads', langCode);
            },
        },
        SendPolls: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.SendPolls', langCode);
            },
        },
        SendTTSMessages: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.SendTTSMessages', langCode);
            },
        },
        SendVoiceMessages: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.SendVoiceMessages', langCode);
            },
        },
        Speak: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.Speak', langCode);
            },
        },
        Stream: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.Stream', langCode);
            },
        },
        UseApplicationCommands: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.UseApplicationCommands', langCode);
            },
        },
        UseEmbeddedActivities: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.UseEmbeddedActivities', langCode);
            },
        },
        UseExternalApps: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.UseExternalApps', langCode);
            },
        },
        UseExternalEmojis: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.UseExternalEmojis', langCode);
            },
        },
        UseExternalSounds: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.UseExternalSounds', langCode);
            },
        },
        UseExternalStickers: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.UseExternalStickers', langCode);
            },
        },
        UseSoundboard: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.UseSoundboard', langCode);
            },
        },
        UseVAD: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.UseVAD', langCode);
            },
        },
        ViewAuditLog: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ViewAuditLog', langCode);
            },
        },
        ViewChannel: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ViewChannel', langCode);
            },
        },
        ViewCreatorMonetizationAnalytics: {
            displayName(langCode: Locale): string {
                return Lang.getRef(
                    'info',
                    'permissions.ViewCreatorMonetizationAnalytics',
                    langCode
                );
            },
        },
        ViewGuildInsights: {
            displayName(langCode: Locale): string {
                return Lang.getRef('info', 'permissions.ViewGuildInsights', langCode);
            },
        },
    };
}
