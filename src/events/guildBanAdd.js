import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';

export default {
    name: 'guildBanAdd',
    async execute(ban) {
        const { guild, user } = ban;
        if (!guild) return;

        try {
            const executor = await AntiNukeService.resolveExecutor(guild, AuditLogEvent.MemberBanAdd, user.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(guild, executor, 'ban');
                if (triggered) {
                    // Rollback: unban the user
                    await guild.bans.remove(user.id, '[Anti-Nuke Rollback] Unauthorized member ban').catch(err => {
                        logger.error(`Failed to unban user ${user.tag} during rollback:`, err);
                    });
                } else {
                    // Log the ban event to the mod logs channel
                    await logEvent({
                        client: guild.client,
                        guildId: guild.id,
                        eventType: EVENT_TYPES.MODERATION_BAN,
                        data: {
                            description: `Member banned: ${user.tag}`,
                            userId: user.id,
                            fields: [
                                { name: '👤 Member', value: `${user.tag} (${user.id})`, inline: true },
                                { name: '🛡️ Moderator', value: `${executor.tag} (${executor.id})`, inline: true }
                            ]
                        }
                    }).catch(err => logger.error('Failed to log direct ban:', err));
                }
            }
        } catch (error) {
            logger.error(`Error in guildBanAdd anti-nuke check:`, error);
        }
    }
};
