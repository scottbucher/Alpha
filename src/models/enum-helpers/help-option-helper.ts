import { Locale, LocalizationMap } from 'discord.js';

import { HelpOption } from '../../enums/index.js';
import { Lang } from '../../services/index.js';

interface HelpOptionData {
    displayName(langCode: Locale): string;
    localizationMap(): LocalizationMap;
}

export class HelpOptionHelper {
    public static Data: {
        [key in HelpOption]: HelpOptionData;
    } = {
        COMMANDS: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'helpOptionDescs.commands', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'helpOptionDescs.commands');
            },
        },
        PERMISSIONS: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'helpOptionDescs.permissions', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'helpOptionDescs.permissions');
            },
        },
    };
}
