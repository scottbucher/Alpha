import { Message, MessageEmbed, Role, TextChannel } from 'discord.js';

import { Command } from './command';
import { GuildRepo } from '../services/database/repos';
import { PermissionUtils } from '../utils';

let Config = require('../../config/config.json');

export class SetJoinRoleCommand implements Command {
    public name: string = 'setjoinrole';
    public aliases = ['updatejoinrole'];
    public trigger = null;
    public guildOnly = true;
    public adminOnly = true;
    public ownerOnly = false;
    public help: string = 'Sets the Role a user gets when they join the server.';

    constructor(private guildRepo: GuildRepo) {}

    public async execute(args: string[], msg: Message, channel: TextChannel): Promise<void> {
        if (!msg.guild.me.hasPermission('MANAGE_ROLES')) {
            let embed = new MessageEmbed()
                .setTitle('Not Enough Permissions!')
                .setDescription('The bot must have permission to manage roles!')
                .setColor(Config.colors.error);
            await channel.send(embed);
            return;
        }

        // Find role with desired attributes
        let joinRole: Role = msg.mentions.roles.first();

        if (!joinRole) {
            joinRole = msg.guild.roles.cache.find(role =>
                role.name.toLowerCase().includes(args[1].toLowerCase())
            );
        }

        if (
            !joinRole ||
            joinRole.guild.id !== msg.guild.id ||
            args[1].toLowerCase() === 'everyone'
        ) {
            let embed = new MessageEmbed()
                .setDescription(`Invalid Role!`)
                .setColor(Config.colors.error);
            channel.send(embed);
            return;
        }

        if (
            joinRole.position >
            msg.guild.members.resolve(msg.client.user).roles.highest.position
        ) {
            let embed = new MessageEmbed()
                .setDescription(`Join Role must be bellow the Bot's role!`)
                .setColor(Config.colors.error);
            channel.send(embed);
            return;
        }

        if (joinRole.managed) {
            let embed = new MessageEmbed()
                .setDescription(`Join Role cannot be managed by an external service!`)
                .setColor(Config.colors.error);
            channel.send(embed);
            return;
        }

        await this.guildRepo.updateGuildJoinRole(msg.guild.id, joinRole?.id);

        let embed = new MessageEmbed()
            .setDescription(`Successfully set the join role to ${joinRole.toString()}!`)
            .setColor(Config.colors.success);
        await channel.send(embed);
    }
}
