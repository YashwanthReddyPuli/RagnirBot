import { 
    getJoinToCreateConfig, 
    removeJoinToCreateTrigger,
    unregisterTemporaryChannel,
    getTicketData,
    saveTicketData
} from '../utils/database.js';
import { getServerCounters, saveServerCounters } from '../services/serverstatsService.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';
import { AuditLogEvent, Events } from 'discord.js';

export default {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        // Anti-nuke check
        if (channel.guild) {
            const executor = await AntiNukeService.resolveExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(channel.guild, executor, 'channelDelete');
                if (triggered) {
                    try {
                        await channel.guild.channels.create({
                            name: channel.name,
                            type: channel.type,
                            topic: channel.topic,
                            nsfw: channel.nsfw,
                            parent: channel.parentId,
                            permissionOverwrites: channel.permissionOverwrites.cache.map(p => ({
                                id: p.id,
                                allow: p.allow.toArray(),
                                deny: p.deny.toArray(),
                                type: p.type
                            })),
                            rateLimitPerUser: channel.rateLimitPerUser,
                            position: channel.position
                        });
                        logger.info(`Recreated deleted channel ${channel.name} due to anti-nuke rollback`);
                    } catch (err) {
                        logger.error(`Failed to recreate channel ${channel.name}:`, err);
                    }
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
                eventType: 'message.delete', // Route to message log channel
                data: {
                    title: '🗑️ Channel Deleted',
                    description: `A channel was deleted: **${channel.name}**`,
                    fields: [
                        { name: 'Channel Name', value: channel.name, inline: true },
                        { name: 'Channel Type', value: channelTypeNames[channel.type] || 'Unknown', inline: true },
                        { name: 'Category Parent', value: channel.parent ? channel.parent.name : 'None', inline: true },
                        { name: 'Channel ID', value: channel.id, inline: true }
                    ]
                }
            });
        }

        // Handle ticket text channel deletion
        if (channel.type === 0 && channel.guild) {
            try {
                const ticketData = await getTicketData(channel.guild.id, channel.id);
                if (ticketData && ticketData.status === 'open') {
                    ticketData.status = 'deleted';
                    ticketData.closedAt = new Date().toISOString();
                    await saveTicketData(channel.guild.id, channel.id, ticketData);
                    logger.info(`Ticket channel ${channel.id} was manually deleted in guild ${channel.guild.id}, marked as deleted`);
                }
            } catch (err) {
                logger.warn(`Could not clean up ticket record for deleted channel ${channel.id}:`, err);
            }
        }

if (channel.type !== 2 && channel.type !== 4) {
            return;
        }

        const guildId = channel.guild.id;

        try {
            // Check if this channel is a counter channel
            const counters = await getServerCounters(client, guildId);
            const orphanedCounter = counters.find(c => c.channelId === channel.id);
            
            if (orphanedCounter) {
                logger.info(`Counter channel ${channel.name} (${channel.id}) was deleted, removing counter ${orphanedCounter.id} from database`);
                
                const updatedCounters = counters.filter(c => c.channelId !== channel.id);
                const success = await saveServerCounters(client, guildId, updatedCounters);
                
                if (success) {
                    logger.info(`Successfully removed orphaned counter ${orphanedCounter.id} (type: ${orphanedCounter.type}) from guild ${guildId}`);
                } else {
                    logger.warn(`Failed to remove orphaned counter ${orphanedCounter.id} from guild ${guildId}`);
                }
            }

            const config = await getJoinToCreateConfig(client, guildId);

            if (!config.enabled) {
                return;
            }

            if (config.triggerChannels.includes(channel.id)) {
                logger.info(`Join to Create trigger channel ${channel.name} (${channel.id}) was deleted, removing from configuration`);
                
                const success = await removeJoinToCreateTrigger(client, guildId, channel.id);
                if (success) {
                    logger.info(`Successfully removed trigger channel ${channel.id} from Join to Create configuration`);
                } else {
                    logger.warn(`Failed to remove trigger channel ${channel.id} from Join to Create configuration`);
                }
            }

            if (config.temporaryChannels[channel.id]) {
                logger.info(`Join to Create temporary channel ${channel.name} (${channel.id}) was deleted, cleaning up database`);
                
                const success = await unregisterTemporaryChannel(client, guildId, channel.id);
                if (success) {
                    logger.info(`Successfully cleaned up temporary channel ${channel.id} from database`);
                } else {
                    logger.warn(`Failed to cleanup temporary channel ${channel.id} from database`);
                }
            }

            if (config.categoryId === channel.id) {
                logger.warn(`Category ${channel.name} (${channel.id}) used for Join to Create temporary channels was deleted. Join to Create will be disabled.`);
                
                config.categoryId = null;
                config.enabled = false;
                
                try {
                    await client.db.set(`guild:${guildId}:jointocreate`, config);
                    logger.info(`Disabled Join to Create for guild ${guildId} due to category deletion`);
                } catch (error) {
                    logger.error(`Failed to disable Join to Create for guild ${guildId}:`, error);
                }
            }

        } catch (error) {
            logger.error(`Error in channelDelete event for guild ${guildId}:`, error);
        }
    }
};


