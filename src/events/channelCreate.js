import { AuditLogEvent, Events } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: Events.ChannelCreate,
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
                    return;
                }
            }

            const channelTypeNames = {
                0: 'Text Channel',
                2: 'Voice Channel',
                4: 'Category',
                5: 'Announcement Channel',
                13: 'Stage Channel'
            };

            await logEvent({
                client: channel.client,
                guildId: channel.guild.id,
                eventType: 'message.delete', // Route to message log channels channel
                data: {
                    title: '📁 Channel Created',
                    description: `A new channel was created: ${channel.toString()}`,
                    fields: [
                        { name: 'Channel Name', value: channel.name, inline: true },
                        { name: 'Channel Type', value: channelTypeNames[channel.type] || 'Unknown', inline: true },
                        { name: 'Category Parent', value: channel.parent ? channel.parent.name : 'None', inline: true },
                        { name: 'Channel ID', value: channel.id, inline: true }
                    ]
                }
            });

        } catch (error) {
            logger.error(`Error in channelCreate:`, error);
        }
    }
};
