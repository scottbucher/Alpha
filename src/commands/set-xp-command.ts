import { GuildMember, Message, MessageEmbed, TextChannel } from 'discord.js';
import { MessageUtils, ParseUtils } from '../utils';

import { Command } from './command';
import { UserRepo } from '../services/database/repos';

let Config = require('../../config/config.json');

export class SetXpCommand implements Command {
    public name: string = 'setxp';
    public aliases: string[] = [];
    public trigger = null;
    public guildOnly: boolean = true;
    public adminOnly: boolean = false;
    public ownerOnly: boolean = true;
    public help: string = 'Sets the user\'s xp.';

    constructor(private userRepo: UserRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        if (args.length < 3) {
            let embed = new MessageEmbed()
                .setDescription('Please supply a user and xp value!')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        let target: GuildMember;

        target =
            msg.mentions.members.first() ||
            msg.guild.members.cache.find(
                member =>
                    member.displayName.toLowerCase().includes(args[1].toLowerCase()) ||
                    member.user.username.toLowerCase().includes(args[1].toLowerCase())
            );

        if (!target) {
            let embed = new MessageEmbed()
                .setDescription('Could not find that user!')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        if (target.user.bot) {
            let embed = new MessageEmbed()
                .setDescription('You may not set a bot\'s level.')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        let xp;

        if (args[2]) {
            try {
                xp = ParseUtils.parseInt(args[2]);
            } catch (error) {
                // Not A Number
            }
            if (!xp) {
                let embed = new MessageEmbed()
                    .setDescription('Invalid XP value!')
                    .setColor(Config.colors.error);
                await channel.send(embed);
                return;
            }
        }

        await this.userRepo.updateUser(target.id, msg.guild.id,  xp);

        let embed = new MessageEmbed()
            .setDescription(`Successfully set ${target.toString()}'s xp to **${xp}**!`)
            .setColor(Config.colors.default);

        await channel.send(embed);
    }
}
