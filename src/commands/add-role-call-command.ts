import { Emoji, GuildEmoji, Message, MessageEmbed, Role, TextChannel } from 'discord.js';
import { FormatUtils, MessageUtils, ParseUtils } from '../utils';

import { Command } from './command';
import { Logger } from '../services';
import { RoleCallRepo } from '../services/database/repos/rolecall-repo';

let Config = require('../../config/config.json');

export class AddRoleCallCommand implements Command {
    public name: string = 'addrolecall';
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = false;
    public help: string = 'Add a role call.';

    constructor(
        private roleCallRepo: RoleCallRepo
    ) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        if (args.length < 3) { // Needs at least 3 arguments
            let embed = new MessageEmbed()
                .setDescription('Invalid Usage. Please provide a role and emote')
                .setColor(Config.errorColor);
            await channel.send(embed);
            return;
        }

        // Find mentioned role
        let roleInput: Role = msg.mentions.roles.first();

        if (!roleInput) {
            roleInput = msg.guild.roles.cache
                .find(role =>
                    role.name.toLowerCase().includes(args[1].toLowerCase())
                );
        }

        if (!roleInput || roleInput.guild.id !== msg.guild.id) {
            let embed = new MessageEmbed()
                .setDescription(`Invalid Role!`)
                .setColor(Config.errorColor);
            await channel.send(embed);
            return;
        }

        // Find Emote
        let guildEmote = FormatUtils.findGuildEmoji(args[2], msg.guild);
        let emoteInput: string;
        let emoteOutput = args[2];

        if (!guildEmote) {

            if(!FormatUtils.isUnicodeEmoji(args[2])) {
                let embed = new MessageEmbed()
                .setDescription('Invalid Emote!')
                .setColor(Config.errorColor);
            await channel.send(embed);
            return;
            } else {
                FormatUtils.findUnicodeEmoji(args[2]);
                emoteInput = args[2];
            }
        } else {
            emoteOutput = msg.guild.emojis.cache.get(guildEmote.id).toString();
            emoteInput = guildEmote.id;
        }

        if (!emoteInput) {
            let embed = new MessageEmbed()
                .setDescription('Invalid Emote.')
                .setDescription('You cannot use an emote from another guild!')
                .setColor(Config.errorColor);
            await channel.send(embed);
            return;
        }

        let category = 'MISC';
        Logger.info(args.toString());
        if (args.length > 3) {
            if (args[3].length > 30) {
                // Too Long
                let embed = new MessageEmbed()
                    .setDescription('Category name is too long.')
                    .setColor(Config.errorColor);
                await channel.send(embed);
                return;
            }
            category = args[3];
        }

        try {
            await this.roleCallRepo.addRoleCall(msg.guild.id, roleInput.id, emoteInput, category);
        } catch (error) {
            let embed = new MessageEmbed()
                .setTitle('Duplicate Entry! ')
                .setDescription('Each role can only be assigned to one emote!\nEmotes __can__ assign more than one role.')
                .setColor(Config.errorColor);
            await channel.send(embed);
            return;
        }

        let embed = new MessageEmbed()
            .setDescription(`Successfully assigned the role ${MessageUtils.getRoleName(roleInput.id, msg.guild)} to the emote ${emoteOutput} in the category **${category}**!`)
            .setColor(Config.successColor);
        await channel.send(embed);
    }
}