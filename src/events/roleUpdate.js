import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: 'roleUpdate',
    async execute(oldRole, newRole) {
        if (!newRole.guild) return;

        try {
            const executor = await AntiNukeService.resolveExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(newRole.guild, executor, 'roleUpdate');
                if (triggered) {
                    // Revert settings
                    await newRole.edit({
                        name: oldRole.name,
                        color: oldRole.color,
                        hoist: oldRole.hoist,
                        permissions: oldRole.permissions,
                        mentionable: oldRole.mentionable,
                        reason: '[Anti-Nuke Rollback] Unauthorized role update'
                    }).catch(err => {
                        logger.error(`Failed to revert role update for ${newRole.name}:`, err);
                    });
                }
            }
        } catch (error) {
            logger.error(`Error in roleUpdate anti-nuke check:`, error);
        }
    }
};
