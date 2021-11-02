import { EmojiResolvable, Message, MessageEmbed, Permissions, TextChannel } from 'discord.js';

import { RoleCallRepo } from '../services/database/repos';
import { FormatUtils, MessageUtils } from '../utils';
import { Command } from './command';

let Config = require('../../config/config.json');

export class CreateRoleCallCommand implements Command {
    public name: string = 'createrolecall';
    public aliases = ['updaterolecall'];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = false;
    public help: string = 'Create the role call message';

    constructor(private roleCallRepo: RoleCallRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        if (
            !channel
                .permissionsFor(msg.guild.me)
                .has([Permissions.FLAGS.MANAGE_MESSAGES, Permissions.FLAGS.ADD_REACTIONS])
        ) {
            let embed = new MessageEmbed()
                .setDescription('I require the `ADD_REACTIONS` & `MANAGE_MESSAGES` to do this!`')
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        let roleCallData = await this.roleCallRepo.getRoleCalls(msg.guild.id);
        if (roleCallData.length === 0) {
            // Need at least one rolecall saved
            let embed = new MessageEmbed()
                .setDescription('Could not find any saved roles.')
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        msg.delete();

        let message = await MessageUtils.send(
            channel,
            await FormatUtils.getRoleCallEmbed(msg.guild, roleCallData)
        );

        let roleCallEmotes = roleCallData.map(roleCall => roleCall.Emote);

        for (let emote of roleCallEmotes) {
            let roleCallRoles = roleCallData // Get an array of Roles under this category
                .filter(roleCall => roleCall.Emote === emote)
                .map(roleCall => roleCall.RoleDiscordId);

            let roleCheck = false;

            for (let role of roleCallRoles) {
                let giveRole = msg.guild.roles.resolve(role);

                if (!giveRole) continue;
                else roleCheck = true;
            }

            if (!roleCheck) continue;

            let emoji: EmojiResolvable =
                FormatUtils.findGuildEmoji(emote, msg.guild) || FormatUtils.findUnicodeEmoji(emote);
            if (!emoji) continue; // Continue if there is no emoji
            await MessageUtils.react(message, emoji); // React with the emote
        }
        await MessageUtils.react(message, Config.emotes.refresh); // Add Administrative Recycle Emote
    }
}
