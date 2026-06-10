import { Events, AuditLogEvent } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';
import { buildRoleAuditFields } from '../utils/roleLogFields.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
  name: Events.GuildRoleDelete,
  once: false,

  async execute(role) {
    try {
      if (!role.guild) return;

      const executor = await AntiNukeService.resolveExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
      if (executor) {
        const triggered = await AntiNukeService.checkAction(role.guild, executor, 'roleDelete');
        if (triggered) {
          try {
            await role.guild.roles.create({
              name: role.name,
              color: role.color,
              hoist: role.hoist,
              permissions: role.permissions,
              mentionable: role.mentionable,
              position: role.position,
              reason: '[Anti-Nuke Rollback] Unauthorized role deletion'
            });
            logger.info(`Recreated deleted role ${role.name} due to anti-nuke rollback`);
          } catch (err) {
            logger.error(`Failed to recreate role ${role.name}:`, err);
          }
          return;
        }
      }

      const fields = buildRoleAuditFields(role, { includeMemberCount: true });

      await logEvent({
        client: role.client,
        guildId: role.guild.id,
        eventType: EVENT_TYPES.ROLE_DELETE,
        data: {
          description: `A role was deleted: ${role.name}`,
          fields
        }
      });

    } catch (error) {
      logger.error('Error in roleDelete event:', error);
    }
  }
};
