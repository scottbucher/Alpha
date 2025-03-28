import { Locale, LocalizationMap } from 'discord.js';

import { InfoOption } from '../../enums/index.js';
import { Lang } from '../../services/index.js';

interface InfoOptionData {
    displayName(langCode: Locale): string;
    localizationMap(): LocalizationMap;
}

export class InfoOptionHelper {
    public static Data: {
        [key in InfoOption]: InfoOptionData;
    } = {
        ABOUT: {
            displayName(langCode: Locale): string {
                return Lang.getRef('commands', 'infoOptionDescs.about', langCode);
            },
            localizationMap(): LocalizationMap {
                return Lang.getRefLocalizationMap('commands', 'infoOptionDescs.about');
            },
        },
    };
}
