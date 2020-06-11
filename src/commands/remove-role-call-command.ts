import { Message, MessageEmbed, Role, TextChannel } from 'discord.js';

import { RoleCallRepo } from '../services/database/repos';
import { MessageUtils } from '../utils';
import { Command } from './command';

let Config = require('../../config/config.json');

export class RemoveRoleCallCommand implements Command {
    public name: string = 'removerolecall';
    public aliases = ['deleterolecall'];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = false;
    public help: string = 'Remove a role from role call';

    constructor(private roleCallRepo: RoleCallRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        if (args.length < 2) {
            let embed = new MessageEmbed()
                .setDescription('Please supply a role you would like to clear.')
                .setColor(Config.colors.error);
            await channel.send(embed);
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
            await channel.send(embed);
            return;
        }

        await this.roleCallRepo.removeRoleCall(roleInput.id);

        let embed = new MessageEmbed()
            .setDescription(
                `Successfully removed the ${MessageUtils.getRoleName(
                    roleInput.id,
                    msg.guild
                )} from role-call!`
            )
            .setColor(Config.colors.success);

        await channel.send(embed);
    }
}
