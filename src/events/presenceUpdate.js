import { Events } from 'discord.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.PresenceUpdate,
    once: false,
    async execute(oldPresence, newPresence, client) {
        try {
            const member = newPresence.member;
            if (!member || member.user.bot) return;

            const guild = newPresence.guild;
            const config = await getGuildConfig(client, guild.id);
            const vanityConfig = config?.vanity;

            if (!vanityConfig || !vanityConfig.enabled || !vanityConfig.roleId || !vanityConfig.text) {
                return;
            }

            const role = guild.roles.cache.get(vanityConfig.roleId);
            if (!role) return;

            // Check custom status text (Type 4 is custom status)
            let hasVanityText = false;
            const customStatus = newPresence.activities?.find(act => act.type === 4);
            if (customStatus && customStatus.state) {
                if (customStatus.state.toLowerCase().includes(vanityConfig.text.toLowerCase())) {
                    hasVanityText = true;
                }
            }

            const hasRole = member.roles.cache.has(vanityConfig.roleId);

            if (hasVanityText && !hasRole) {
                await member.roles.add(role, 'Custom Status Vanity Reward').catch(err => {
                    logger.error(`Failed to assign vanity status role in guild ${guild.id} to ${member.user.tag}:`, err.message);
                });
            } else if (!hasVanityText && hasRole) {
                await member.roles.remove(role, 'Custom Status Vanity Removed').catch(err => {
                    logger.error(`Failed to remove vanity status role in guild ${guild.id} from ${member.user.tag}:`, err.message);
                });
            }
        } catch (error) {
            logger.error('Error in presenceUpdate event:', error);
        }
    }
};
