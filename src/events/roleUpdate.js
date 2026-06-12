import { AuditLogEvent, Events } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: Events.GuildRoleUpdate,
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
                    return;
                }
            }

            const fields = [];

            // Detect and log name changes
            if (oldRole.name !== newRole.name) {
                fields.push({ name: '🏷️ Old Name', value: oldRole.name, inline: true });
                fields.push({ name: '🏷️ New Name', value: newRole.name, inline: true });
            }

            // Detect and log color changes
            if (oldRole.color !== newRole.color) {
                fields.push({ name: '🎨 Old Color', value: oldRole.hexColor, inline: true });
                fields.push({ name: '🎨 New Color', value: newRole.hexColor, inline: true });
            }

            // Detect and log hoisting changes
            if (oldRole.hoist !== newRole.hoist) {
                fields.push({ name: 'Hoisted Change', value: `Hoisted: \`${oldRole.hoist ? 'Yes' : 'No'}\` ➡️ \`${newRole.hoist ? 'Yes' : 'No'}\``, inline: true });
            }

            // Detect and log mentionable changes
            if (oldRole.mentionable !== newRole.mentionable) {
                fields.push({ name: 'Mentionable Change', value: `Mentionable: \`${oldRole.mentionable ? 'Yes' : 'No'}\` ➡️ \`${newRole.mentionable ? 'Yes' : 'No'}\``, inline: true });
            }

            // Detect and log permission changes
            const oldPerms = oldRole.permissions.toArray();
            const newPerms = newRole.permissions.toArray();
            const addedPerms = newPerms.filter(p => !oldPerms.includes(p));
            const removedPerms = oldPerms.filter(p => !newPerms.includes(p));

            if (addedPerms.length > 0) {
                fields.push({ name: '💚 Permissions Added', value: addedPerms.join(', ').substring(0, 1024), inline: false });
            }
            if (removedPerms.length > 0) {
                fields.push({ name: '💔 Permissions Removed', value: removedPerms.join(', ').substring(0, 1024), inline: false });
            }

            // Only log if something actually changed
            if (fields.length > 0) {
                fields.unshift({ name: 'Role', value: `${newRole} (\`${newRole.id}\`)`, inline: false });

                await logEvent({
                    client: newRole.client,
                    guildId: newRole.guild.id,
                    eventType: EVENT_TYPES.ROLE_UPDATE,
                    data: {
                        description: `Role settings updated for **${newRole.name}**`,
                        fields
                    }
                });
            }

        } catch (error) {
            logger.error(`Error in roleUpdate event handler:`, error);
        }
    }
};
