import { Events, AuditLogEvent } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';
import { buildRoleAuditFields } from '../utils/roleLogFields.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
  name: Events.GuildRoleCreate,
  once: false,

  async execute(role) {
    try {
      if (!role.guild) return;

      const executor = await AntiNukeService.resolveExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
      if (executor) {
        const triggered = await AntiNukeService.checkAction(role.guild, executor, 'roleCreate');
        if (triggered) {
          await role.delete('[Anti-Nuke Rollback] Unauthorized role creation').catch(err => {
            logger.error(`Failed to delete role ${role.name} during rollback:`, err);
          });
          return;
        }
      }

      const fields = buildRoleAuditFields(role);

      await logEvent({
        client: role.client,
        guildId: role.guild.id,
        eventType: EVENT_TYPES.ROLE_CREATE,
        data: {
          description: `A new role was created: ${role.toString()}`,
          fields
        }
      });

    } catch (error) {
      logger.error('Error in roleCreate event:', error);
    }
  }
};
