import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel, client) {
        if (!newChannel.guild) return;

        try {
            const executor = await AntiNukeService.resolveExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(newChannel.guild, executor, 'channelUpdate');
                if (triggered) {
                    // Rollback: revert the changes back to oldChannel configurations
                    await newChannel.edit({
                        name: oldChannel.name,
                        topic: oldChannel.topic,
                        nsfw: oldChannel.nsfw,
                        parent: oldChannel.parentId,
                        rateLimitPerUser: oldChannel.rateLimitPerUser,
                        permissionOverwrites: oldChannel.permissionOverwrites.cache.map(p => ({
                            id: p.id,
                            allow: p.allow.toArray(),
                            deny: p.deny.toArray(),
                            type: p.type
                        })),
                        reason: '[Anti-Nuke Rollback] Unauthorized channel update'
                    }).catch(err => {
                        logger.error(`Failed to revert channel update for ${newChannel.name}:`, err);
                    });
                }
            }
        } catch (error) {
            logger.error(`Error in channelUpdate anti-nuke check:`, error);
        }
    }
};
