import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';
import { logModerationAction } from '../utils/moderation.js';

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
                    const auditLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
                    const entry = auditLogs?.entries.find(e => e.targetId === user.id && Date.now() - e.createdTimestamp < 10000);
                    const reason = entry?.reason || 'No reason provided';

                    // Log the ban event to database & channel
                    await logModerationAction({
                        client: guild.client,
                        guild,
                        event: {
                            action: 'Member Banned',
                            target: `${user.tag} (${user.id})`,
                            executor: `${executor.tag} (${executor.id})`,
                            reason,
                            metadata: {
                                userId: user.id,
                                moderatorId: executor.id,
                                permanent: true
                            }
                        }
                    }).catch(err => logger.error('Failed to log direct ban:', err));
                }
            }
        } catch (error) {
            logger.error(`Error in guildBanAdd anti-nuke check:`, error);
        }
    }
};
