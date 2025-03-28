import { Locale, LocalizationMap } from 'discord.js';

import { ChannelType } from '../../enums/index.js';
import { Lang } from '../../services/index.js';

interface ChannelTypeOptionData {
    displayName(langCode: Locale): string;
    localizationMap(): LocalizationMap;
}

export class ChannelTypeHelper {
    public static Data: {
        [key in ChannelType]: ChannelTypeOptionData;
    } = {
        WELCOME: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'claimRoleOptionDescs.welcome', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'claimRoleOptionDescs.welcome');
            },
        },
        LEVELING: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'claimRoleOptionDescs.leveling', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'claimRoleOptionDescs.leveling');
            },
        },
        QUOTE: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'claimRoleOptionDescs.quote', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'claimRoleOptionDescs.quote');
            },
        },
        POLL: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'claimRoleOptionDescs.poll', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'claimRoleOptionDescs.poll');
            },
        },
    };
}
