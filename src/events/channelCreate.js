import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: 'channelCreate',
    async execute(channel, client) {
        if (!channel.guild) return;

        try {
            const executor = await AntiNukeService.resolveExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(channel.guild, executor, 'channelCreate');
                if (triggered) {
                    // Rollback: delete the newly created channel
                    await channel.delete('[Anti-Nuke Rollback] Unauthorized channel creation').catch(err => {
                        logger.error(`Failed to delete channel ${channel.name} during rollback:`, err);
                    });
                }
            }
        } catch (error) {
            logger.error(`Error in channelCreate anti-nuke check:`, error);
        }
    }
};
