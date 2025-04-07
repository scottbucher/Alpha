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
                return Lang.getRef('commands', 'editChannelOptionDescs.welcome', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'editChannelOptionDescs.welcome');
            },
        },
        LEVELING: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'editChannelOptionDescs.leveling', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'editChannelOptionDescs.leveling');
            },
        },
        QUOTE: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'editChannelOptionDescs.quote', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'editChannelOptionDescs.quote');
            },
        },
        POLL: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'editChannelOptionDescs.poll', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'editChannelOptionDescs.poll');
            },
        },
        EVENT: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'editChannelOptionDescs.event', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'editChannelOptionDescs.event');
            },
        },
    };
}
