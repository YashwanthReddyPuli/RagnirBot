import { PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getGuildConfig, setGuildConfig } from './guildConfig.js';

export const LockdownService = {
    async enableLockdown(guild, client) {
        try {
            const config = await getGuildConfig(client, guild.id);
            const originalPermissions = {};

            for (const [channelId, channel] of guild.channels.cache) {
                if (channel.isTextBased() && channel.type !== 11 && channel.type !== 12) { // Skip threads
                    const overwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
                    originalPermissions[channelId] = {
                        deny: overwrite ? overwrite.deny.toArray() : [],
                        allow: overwrite ? overwrite.allow.toArray() : []
                    };

                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false,
                        AddReactions: false
                    }, { reason: 'Emergency Lockdown Enabled' }).catch(() => null);
                }
            }

            const updatedConfig = {
                ...config,
                lockdownActive: true,
                lockdownPermissions: originalPermissions
            };
            await setGuildConfig(client, guild.id, updatedConfig);
            return { success: true };
        } catch (err) {
            logger.error(`Error enabling lockdown for guild ${guild.id}:`, err);
            return { success: false, error: err.message };
        }
    },

    async disableLockdown(guild, client) {
        try {
            const config = await getGuildConfig(client, guild.id);
            const originalPermissions = config.lockdownPermissions || {};

            for (const [channelId, channel] of guild.channels.cache) {
                if (channel.isTextBased() && channel.type !== 11 && channel.type !== 12) {
                    // Reset SendMessages/AddReactions to inherit/null
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null,
                        AddReactions: null
                    }, { reason: 'Emergency Lockdown Disabled' }).catch(() => null);
                }
            }

            const updatedConfig = {
                ...config,
                lockdownActive: false,
                lockdownPermissions: null
            };
            await setGuildConfig(client, guild.id, updatedConfig);
            return { success: true };
        } catch (err) {
            logger.error(`Error disabling lockdown for guild ${guild.id}:`, err);
            return { success: false, error: err.message };
        }
    }
};
