import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';
import { logEvent } from '../services/loggingService.js';

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
                    return;
                }
            }

            // Perform channel update logs
            const changes = [];
            if (oldChannel.name !== newChannel.name) {
                changes.push(`**Name**: \`${oldChannel.name}\` ➡️ \`${newChannel.name}\``);
            }
            if (oldChannel.topic !== newChannel.topic) {
                changes.push(`**Topic**: \`${oldChannel.topic || 'None'}\` ➡️ \`${newChannel.topic || 'None'}\``);
            }
            if (oldChannel.nsfw !== newChannel.nsfw) {
                changes.push(`**NSFW**: \`${oldChannel.nsfw}\` ➡️ \`${newChannel.nsfw}\``);
            }
            if (oldChannel.parentId !== newChannel.parentId) {
                const oldParent = oldChannel.parent ? oldChannel.parent.name : 'None';
                const newParent = newChannel.parent ? newChannel.parent.name : 'None';
                changes.push(`**Category**: \`${oldParent}\` ➡️ \`${newParent}\``);
            }
            if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
                changes.push(`**Slowmode**: \`${oldChannel.rateLimitPerUser}s\` ➡️ \`${newChannel.rateLimitPerUser}s\``);
            }

            if (changes.length > 0) {
                await logEvent({
                    client: newChannel.client,
                    guildId: newChannel.guild.id,
                    eventType: 'message.delete', // Routes to message log channel (#message-logs)
                    data: {
                        title: '✏️ Channel Updated',
                        description: `Channel ${newChannel.toString()} was updated.\n\n**Changes:**\n${changes.join('\n')}`,
                        fields: [
                            { name: 'Channel Name', value: newChannel.name, inline: true },
                            { name: 'Channel ID', value: newChannel.id, inline: true }
                        ]
                    }
                });
            }
        } catch (error) {
            logger.error(`Error in channelUpdate:`, error);
        }
    }
};
