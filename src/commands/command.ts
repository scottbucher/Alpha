import { DMChannel, Message, TextChannel } from 'discord.js';

export interface Command {
    name: string;
    aliases: string[];
    trigger: RegExp;
    guildOnly: boolean;
    adminOnly: boolean;
    ownerOnly: boolean;
    execute(args: string[], msg: Message, channel: TextChannel | DMChannel): Promise<void>;
}
