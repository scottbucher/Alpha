import { BotSiteConfig } from '../../models/bot-site-config';
import { HttpService } from '../http-service';
import { BotSite } from './bot-site';

export class BotsOnDiscordXyzSite implements BotSite {
    public enabled = false;
    public name = 'bots.ondiscord.xyz';

    constructor(private config: BotSiteConfig, private httpService: HttpService) {
        this.enabled = this.config.enabled;
    }

    public async updateServerCount(serverCount: number): Promise<void> {
        this.httpService.post(this.config.url, this.config.token, { guildCount: serverCount });
    }
}
