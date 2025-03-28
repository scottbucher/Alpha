import { CommandInteraction, Role, APIRole } from 'discord.js';
import { EventData } from '../models/index.js';
import { Lang } from '../services/lang.js';
import { InteractionUtils } from './interaction-utils.js';
import { PermissionUtils } from './index.js';

export class ValidationUtils {
    public static async validateRole(
        intr: CommandInteraction,
        data: EventData,
        role: NonNullable<Role | APIRole>
    ): Promise<Role | null> {
        if (!(role instanceof Role)) {
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed(
                    'validation',
                    'errorEmbeds.rawAPIInteractionDataReceived',
                    data.lang
                )
            );
            return null;
        }

        if (role.managed) {
            InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.roleManaged', data.lang)
            );
            return null;
        }

        if (role.id === intr.guild.id) {
            // can't blacklist everyone
            await InteractionUtils.send(
                intr,
                Lang.getErrorEmbed('validation', 'errorEmbeds.everyoneIsNotAValidRole', data.lang, {
                    EVERYONE: role.toString(),
                })
            );
            return null;
        }

        // Check the role's position
        if (!(await PermissionUtils.isRoleGivable(intr.guild, role))) {
            await InteractionUtils.send(
                intr,
                Lang.getEmbed('validation', 'embeds.cannotGiveRole', data.lang, {
                    BOT: intr.client.user.toString(),
                    ICON: intr.client.user.displayAvatarURL(),
                })
            );
            return null;
        }

        return role;
    }
}
