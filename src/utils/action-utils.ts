import { Guild, GuildMember, Role } from 'discord.js';

export abstract class ActionUtils {
    public static giveRole(member: GuildMember, role: Role) {
        try {
            member.roles.add(role);
        } catch (error) {
            // Can't give that role
        }
    }

    public static removeRole(member: GuildMember, role: Role) {
        try {
            member.roles.remove(role);
        } catch (error) {
            // Can't take that role
        }
    }
}
