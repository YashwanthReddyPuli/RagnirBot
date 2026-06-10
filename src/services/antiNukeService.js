import { AuditLogEvent, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getGuildConfig, setGuildConfig } from './guildConfig.js';
import { createEmbed } from '../utils/embeds.js';

// In-memory action tracker for rate limits
// Key: guildId:executorId:eventType -> Array of timestamps (ms)
const actionCache = new Map();

// Cleanup interval to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of actionCache.entries()) {
    const filtered = timestamps.filter(t => now - t < 60000); // clear anything older than 1 minute
    if (filtered.length === 0) {
      actionCache.delete(key);
    } else {
      actionCache.set(key, filtered);
    }
  }
}, 30000);

export const AntiNukeService = {
  /**
   * Check if an administrative action is whitelisted or triggers anti-nuke limits.
   * @param {Guild} guild The Discord guild object
   * @param {User|GuildMember} executor The user performing the action
   * @param {string} eventType The anti-nuke event type (e.g. 'channelDelete')
   * @returns {Promise<boolean>} True if executor triggered anti-nuke and was punished, false otherwise.
   */
  async checkAction(guild, executor, eventType) {
    try {
      if (!guild || !executor) return false;
      const client = guild.client;

      // 1. Get Guild Config
      const config = await getGuildConfig(client, guild.id);
      if (!config || !config.antinuke || !config.antinuke.enabled) {
        return false;
      }

      const antinuke = config.antinuke;
      const executorId = executor.id;

      // 2. Server Owner is always exempt
      if (executorId === guild.ownerId) {
        return false;
      }

      // 3. Bot itself is exempt
      if (executorId === client.user.id) {
        return false;
      }

      // 4. Check User and Role Whitelist
      const isUserWhitelisted = this.isUserWhitelisted(antinuke, executorId, eventType);
      const member = await guild.members.fetch(executorId).catch(() => null);
      const isRoleWhitelisted = member ? this.isRoleWhitelisted(antinuke, member, eventType) : false;

      if (isUserWhitelisted || isRoleWhitelisted) {
        return false; // Whitelisted!
      }

      // 5. Rate Limit evaluation
      const settings = antinuke.settings?.[eventType] || { limit: 3, timeframe: 15000, action: 'demote' };
      const cacheKey = `${guild.id}:${executorId}:${eventType}`;
      const now = Date.now();

      if (!actionCache.has(cacheKey)) {
        actionCache.set(cacheKey, []);
      }

      const timestamps = actionCache.get(cacheKey);
      // Filter out timestamps older than the configured timeframe
      const activeTimestamps = timestamps.filter(t => now - t < settings.timeframe);
      activeTimestamps.push(now);
      actionCache.set(cacheKey, activeTimestamps);

      if (activeTimestamps.length >= settings.limit) {
        // Clear rate-limit cache for this action to prevent double punish loop
        actionCache.delete(cacheKey);

        // Punish executor!
        await this.punishExecutor(guild, executor, settings.action, eventType, activeTimestamps.length);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error in AntiNukeService.checkAction for event ${eventType}:`, error);
      return false;
    }
  },

  /**
   * Helper to check if a user is whitelisted for an event.
   */
  isUserWhitelisted(antinuke, userId, eventType) {
    const wl = antinuke.whitelistedUsers?.[userId];
    if (wl === true) return true; // whitelisted for everything
    if (Array.isArray(wl) && (wl.includes(eventType) || wl.includes('all'))) return true;
    return false;
  },

  /**
   * Helper to check if any of member's roles are whitelisted for an event.
   */
  isRoleWhitelisted(antinuke, member, eventType) {
    if (!member.roles || !antinuke.whitelistedRoles) return false;
    for (const [roleId, wl] of Object.entries(antinuke.whitelistedRoles)) {
      if (member.roles.cache.has(roleId)) {
        if (wl === true) return true;
        if (Array.isArray(wl) && (wl.includes(eventType) || wl.includes('all'))) return true;
      }
    }
    return false;
  },

  /**
   * Resolve executor from the Guild Audit Logs.
   */
  async resolveExecutor(guild, auditLogEvent, targetId, retries = 3, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        const auditLogs = await guild.fetchAuditLogs({
          limit: 5,
          type: auditLogEvent
        });

        const entry = auditLogs.entries.find(e => {
          // Verify if this entry matches our target resource and happened recently (last 10 seconds)
          const timeDiff = Date.now() - e.createdTimestamp;
          return e.targetId === targetId && timeDiff < 10000;
        });

        if (entry && entry.executor) {
          return entry.executor;
        }
      } catch (err) {
        logger.warn(`Failed to fetch audit logs for event ${auditLogEvent}:`, err.message);
      }
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return null;
  },

  /**
   * Punish a rogue executor
   */
  async punishExecutor(guild, executor, action, eventType, count) {
    const client = guild.client;
    const config = await getGuildConfig(client, guild.id);
    const logChannelId = config.antinuke?.logChannelId || config.logChannelId;
    const reason = `[Anti-Nuke Triggered] Exceeded ${eventType} limit (${count} actions)`;

    const member = await guild.members.fetch(executor.id).catch(() => null);
    let success = false;
    let punishmentApplied = 'None';

    if (member) {
      // Check bot hierarchy safety
      const botMember = await guild.members.fetch(client.user.id).catch(() => null);
      if (botMember && member.roles.highest.position >= botMember.roles.highest.position) {
        logger.warn(`Anti-Nuke cannot punish ${executor.tag} due to role hierarchy`);
        punishmentApplied = 'Failed (Role Hierarchy)';
      } else {
        try {
          if (action === 'ban' && member.bannable) {
            await member.ban({ reason });
            success = true;
            punishmentApplied = 'Ban';
          } else if (action === 'kick' && member.kickable) {
            await member.kick(reason);
            success = true;
            punishmentApplied = 'Kick';
          } else if (action === 'demote') {
            // Strip administrative roles or all roles below bot's highest role
            const rolesToKeep = member.roles.cache.filter(r => r.managed || r.id === guild.id);
            const rolesToRemove = member.roles.cache.filter(r => !r.managed && r.id !== guild.id);
            if (rolesToRemove.size > 0) {
              await member.roles.set(rolesToKeep.map(r => r.id), reason);
              success = true;
              punishmentApplied = 'Demote (Roles Stripped)';
            }
          }
        } catch (err) {
          logger.error(`Failed to execute anti-nuke punishment on ${executor.tag}:`, err);
          punishmentApplied = `Failed (${err.message})`;
        }
      }
    }

    // Log the event
    if (logChannelId) {
      const channel = guild.channels.cache.get(logChannelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('🚨 Anti-Nuke Security Alert')
          .setColor('#ED4245')
          .setDescription(`An administrator triggered anti-nuke protection for **${eventType}**.`)
          .addFields(
            { name: 'Executor', value: `${executor} (\`${executor.id}\`)`, inline: true },
            { name: 'Event Triggered', value: `\`${eventType}\``, inline: true },
            { name: 'Actions Count', value: `\`${count}\``, inline: true },
            { name: 'Punishment Configured', value: `\`${action}\``, inline: true },
            { name: 'Punishment Result', value: `\`${punishmentApplied}\``, inline: true }
          )
          .setTimestamp();
        
        await channel.send({ embeds: [embed] }).catch(err => {
          logger.warn(`Failed to send anti-nuke alert log:`, err.message);
        });
      }
    }
  }
};
