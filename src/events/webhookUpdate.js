import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: 'webhookUpdate',
    async execute(channel) {
        const { guild } = channel;
        if (!guild) return;

        try {
            // Find the most recent webhook action in this channel
            const auditLogs = await guild.fetchAuditLogs({
                limit: 5
            });

            // Look for webhook create/delete/update logs
            const entry = auditLogs.entries.find(e => {
                const isWebhookEvent = [
                    AuditLogEvent.WebhookCreate,
                    AuditLogEvent.WebhookUpdate,
                    AuditLogEvent.WebhookDelete
                ].includes(e.action);
                const isSameChannel = e.extra?.channel?.id === channel.id || e.targetId === channel.id;
                const isRecent = (Date.now() - e.createdTimestamp) < 10000;
                return isWebhookEvent && isSameChannel && isRecent;
            });

            if (entry && entry.executor) {
                const triggered = await AntiNukeService.checkAction(guild, entry.executor, 'webhook');
                if (triggered && entry.action === AuditLogEvent.WebhookCreate) {
                    // Rollback: if a webhook was created, delete it
                    const webhooks = await channel.fetchWebhooks().catch(() => null);
                    if (webhooks) {
                        const createdWebhook = webhooks.get(entry.targetId);
                        if (createdWebhook) {
                            await createdWebhook.delete('[Anti-Nuke Rollback] Unauthorized webhook creation').catch(err => {
                                logger.error(`Failed to delete webhook during rollback:`, err);
                            });
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Error in webhookUpdate anti-nuke check:`, error);
        }
    }
};
