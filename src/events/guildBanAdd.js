import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

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
                }
            }
        } catch (error) {
            logger.error(`Error in guildBanAdd anti-nuke check:`, error);
        }
    }
};
