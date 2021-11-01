import { EmojiResolvable, Message, MessageEmbed, Role, TextChannel } from 'discord.js';
import { FormatUtils, MessageUtils } from '../utils';

import { Command } from './command';
import { RoleCallRepo } from '../services/database/repos';

let Config = require('../../config/config.json');

export class AddRoleCallCommand implements Command {
    public name: string = 'addrolecall';
    public aliases = [];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = false;
    public help: string = 'Add a role call.';

    constructor(private roleCallRepo: RoleCallRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        // Needs at least 3 arguments
        if (args.length < 3) {
            let embed = new MessageEmbed()
                .setDescription('Invalid Usage. Please provide a role and emote')
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        // Find mentioned role
        let roleInput: Role = msg.mentions.roles.first();

        if (!roleInput) {
            roleInput = msg.guild.roles.cache.find(role =>
                role.name.toLowerCase().includes(args[1].toLowerCase())
            );
        }

        if (
            !roleInput ||
            roleInput.guild.id !== msg.guild.id ||
            args[1].toLowerCase() === 'everyone'
        ) {
            let embed = new MessageEmbed()
                .setDescription(`Invalid Role!`)
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        if (roleInput.managed) {
            let embed = new MessageEmbed()
                .setTitle(`Invalid Role!`)
                .setDescription('That role is managed by an external service!')
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        if (args[2] === Config.emotes.refresh) {
            let embed = new MessageEmbed()
                .setTitle('Invalid Emote!')
                .setDescription('Sorry, ♻️ is a reserved emote!')
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        // Find Emote
        let emoji: EmojiResolvable =
            FormatUtils.findGuildEmoji(args[2], msg.guild) || FormatUtils.findUnicodeEmoji(args[2]);

        if (!emoji) {
            let embed = new MessageEmbed()
                .setTitle('Invalid Emote.')
                .setDescription(
                    'You must use a valid unicode emote or a custom emote from this guild!'
                )
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        let emoteInput = FormatUtils.findGuildEmoji(args[2], msg.guild)?.id || emoji.toString();
        let emoteOutput =
            FormatUtils.findGuildEmoji(args[2], msg.guild)?.toString() || emoji.toString();

        let category: string;

        if (args.length > 3) {
            if (args[3].length > 30) {
                // Too Long
                let embed = new MessageEmbed()
                    .setDescription('Category name is too long.')
                    .setColor(Config.colors.error);
                await MessageUtils.send(channel, embed);
                return;
            }
            category = args[3];
        }

        try {
            await this.roleCallRepo.addRoleCall(msg.guild.id, roleInput.id, emoteInput, category);
        } catch (error) {
            let embed = new MessageEmbed()
                .setTitle('Duplicate Entry! ')
                .setDescription(
                    'Each role can only be assigned to one emote!\nEmotes __can__ assign more than one role.'
                )
                .setColor(Config.colors.error);
            await MessageUtils.send(channel, embed);
            return;
        }

        let embed = new MessageEmbed().setColor(Config.colors.success);
        if (args.length === 3)
            embed.setDescription(
                `Successfully assigned the role ${MessageUtils.getRoleName(
                    roleInput.id,
                    msg.guild
                )} to the emote ${emoteOutput}!`
            );
        else
            embed.setDescription(
                `Successfully assigned the role ${MessageUtils.getRoleName(
                    roleInput.id,
                    msg.guild
                )} to the emote ${emoteOutput} in the category **${category}**!`
            );

        await MessageUtils.send(channel, embed);
    }
}
