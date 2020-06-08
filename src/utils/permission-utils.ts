import { Permissions, TextChannel } from 'discord.js';

export abstract class PermissionUtils {
    public static canSend(channel: TextChannel): boolean {
        return channel
            .permissionsFor(channel.client.user)
            .has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.EMBED_LINKS]);
    }
}
