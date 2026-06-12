import { EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getGuildConfig } from './guildConfig.js';
import { WarningService } from './warningService.js';
import { ModerationService } from './moderationService.js';
import { logModerationAction } from '../utils/moderation.js';

// In-memory rate limiting for anti-spam
// Key: guildId:userId -> Array of timestamps
const spamTracker = new Map();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of spamTracker.entries()) {
    const filtered = timestamps.filter(t => now - t < 30000); // Keep last 30s
    if (filtered.length === 0) {
      spamTracker.delete(key);
    } else {
      spamTracker.set(key, filtered);
    }
  }
}, 30000);

export const AutoModService = {
  /**
   * Process a message through all enabled AutoMod filters.
   * @param {Message} message The Discord message object
   * @param {Client} client The Discord client
   * @returns {Promise<boolean>} True if action was blocked/moderated, false otherwise
   */
  async processMessage(message, client) {
    try {
      if (!message || !message.guild || message.author.bot) return false;

      // 1. Get Guild Config
      const config = await getGuildConfig(client, message.guild.id);
      if (!config || !config.automod || !config.automod.enabled) {
        return false;
      }

      const automod = config.automod;
      const authorId = message.author.id;
      const channelId = message.channel.id;

      // 2. Bypass rules: Server Owner
      if (authorId === message.guild.ownerId) {
        return false;
      }

      // Bypass: Bot itself
      if (authorId === client.user.id) {
        return false;
      }

      // Bypass: Ignored channels (Global)
      if (automod.ignoredChannels?.includes(channelId)) {
        return false;
      }

      // Bypass: Ignored roles (Global) and security bypass role
      const member = await message.guild.members.fetch(authorId).catch(() => null);
      if (member) {
        if (member.roles.cache.some(r => r.name.toLowerCase() === 'security bypass')) {
          return false;
        }
        if (automod.ignoredRoles?.some(roleId => member.roles.cache.has(roleId))) {
          return false;
        }
      }

      // Helper to check per-filter bypass
      const isFilterBypassed = (filterSettings) => {
        if (!filterSettings) return false;
        if (filterSettings.ignoredChannels?.includes(channelId)) {
          return true;
        }
        if (member && filterSettings.ignoredRoles?.some(roleId => member.roles.cache.has(roleId))) {
          return true;
        }
        return false;
      };

      // Helper to increment stats
      const incrementStat = async (filterName) => {
        try {
          const statsKey = `moderation:automod_stats:${message.guild.id}`;
          const currentStats = await import('../utils/database.js').then(db => db.getFromDb(statsKey, {}));
          currentStats.total = (currentStats.total || 0) + 1;
          currentStats[filterName] = (currentStats[filterName] || 0) + 1;
          await import('../utils/database.js').then(db => db.setInDb(statsKey, currentStats));
        } catch (err) {
          logger.error('Error incrementing AutoMod stats:', err);
        }
      };

      // 3. Filter Checks
      const content = message.content || '';

      // --- Filter 1: Anti-Spam ---
      if (automod.spam?.enabled && !isFilterBypassed(automod.spam)) {
        const spam = automod.spam;
        const trackerKey = `${message.guild.id}:${authorId}`;
        const now = Date.now();

        if (!spamTracker.has(trackerKey)) {
          spamTracker.set(trackerKey, []);
        }

        const timestamps = spamTracker.get(trackerKey);
        const activeTimestamps = timestamps.filter(t => now - t < spam.timeframe);
        activeTimestamps.push(now);
        spamTracker.set(trackerKey, activeTimestamps);

        if (activeTimestamps.length >= spam.limit) {
          spamTracker.delete(trackerKey); // reset tracker to avoid double trigger loops
          const actions = spam.actions || (spam.action ? [spam.action] : ['delete', 'timeout']);
          await incrementStat('spam');
          await this.executePunishment(message, actions, 'Spamming messages', client, config);
          return true;
        }
      }

      // --- Filter 2: Mass Mentions ---
      if (automod.mentions?.enabled && !isFilterBypassed(automod.mentions)) {
        const mentions = automod.mentions;
        const totalMentions = message.mentions.users.size + 
                             message.mentions.roles.size + 
                             (content.includes('@everyone') ? 1 : 0) + 
                             (content.includes('@here') ? 1 : 0);

        if (totalMentions > mentions.limit) {
          const actions = mentions.actions || (mentions.action ? [mentions.action] : ['delete']);
          await incrementStat('mentions');
          await this.executePunishment(message, actions, `Mass mentions (${totalMentions} pings)`, client, config);
          return true;
        }
      }

      // --- Filter 3: Invite Links ---
      if (automod.invite?.enabled && !isFilterBypassed(automod.invite)) {
        const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discord(app)?\.com\/invite\/.+)/i;
        if (inviteRegex.test(content)) {
          const actions = automod.invite.actions || (automod.invite.action ? [automod.invite.action] : ['delete']);
          await incrementStat('invite');
          await this.executePunishment(message, actions, 'Posting invite links', client, config);
          return true;
        }
      }

      // --- Filter 4: External Links (Exclude invites if invite filter is disabled)
      if (automod.link?.enabled && !isFilterBypassed(automod.link)) {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urls = content.match(urlRegex);
        if (urls && urls.length > 0) {
          const link = automod.link;
          const whitelist = link.whitelist || [];
          const blacklist = link.blacklist || [];
          
          let triggerBlock = false;
          let blockReason = 'Posting external links';

          for (const url of urls) {
            try {
              const urlObj = new URL(url);
              const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');

              // Check blacklist first
              const isBlacklisted = blacklist.some(b => {
                const cleanB = b.toLowerCase().replace(/^www\./, '');
                return domain === cleanB || domain.endsWith('.' + cleanB);
              });

              if (isBlacklisted) {
                triggerBlock = true;
                blockReason = `Posting blacklisted link (${domain})`;
                break;
              }

              // Check whitelist if whitelist is configured
              if (whitelist.length > 0) {
                const isWhitelisted = whitelist.some(w => {
                  const cleanW = w.toLowerCase().replace(/^www\./, '');
                  return domain === cleanW || domain.endsWith('.' + cleanW);
                });

                if (!isWhitelisted) {
                  triggerBlock = true;
                  blockReason = `Posting link not in whitelist (${domain})`;
                  break;
                }
              } else {
                // If no whitelist is configured, but link filter is enabled (and not blacklisted, which was checked), block all links by default
                triggerBlock = true;
              }
            } catch (urlErr) {
              // Fallback for malformed URLs
              triggerBlock = true;
            }
          }

          if (triggerBlock) {
            const actions = link.actions || (link.action ? [link.action] : ['delete']);
            await incrementStat('link');
            await this.executePunishment(message, actions, blockReason, client, config);
            return true;
          }
        }
      }

      // --- Filter 5: Banned Words ---
      if (automod.words?.enabled && !isFilterBypassed(automod.words) && automod.words.list?.length > 0) {
        const wordsList = automod.words.list;
        const lowercaseContent = content.toLowerCase();
        
        const matchedWord = wordsList.find(word => {
          const regex = new RegExp(`\\b${this.escapeRegExp(word)}\\b`, 'i');
          return regex.test(lowercaseContent);
        });

        if (matchedWord) {
          const actions = automod.words.actions || (automod.words.action ? [automod.words.action] : ['delete']);
          await incrementStat('words');
          await this.executePunishment(message, actions, `Using banned word: ||${matchedWord}||`, client, config);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error in AutoMod processing:', error);
      return false;
    }
  },

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Enforce moderation punishments on the user.
   */
  async executePunishment(message, actions, reason, client, guildConfig) {
    const { guild, author, member } = message;
    const logChannelId = guildConfig.automod?.logChannelId || guildConfig.logChannelId || guild.client.config?.logChannelId || guild.systemChannelId;

    try {
      const actionsExecuted = [];

      // 1. Delete Message
      if (actions.includes('delete')) {
        await message.delete().catch(err => {
          logger.warn(`Failed to delete AutoMod message:`, err.message);
        });
        actionsExecuted.push('DELETE');
      }

      // 2. Warn User
      let currentWarnCount = 0;
      if (actions.includes('warn')) {
        const result = await WarningService.addWarning({
          guildId: guild.id,
          userId: author.id,
          moderatorId: client.user.id,
          reason: `[AutoMod] ${reason}`
        });

        if (result.success) {
          currentWarnCount = result.totalCount;
          await logModerationAction({
            client,
            guild,
            event: {
              action: "User Warned",
              target: `${author.tag} (${author.id})`,
              executor: `${client.user.tag} (${client.user.id})`,
              reason: `[AutoMod] ${reason}`,
              metadata: {
                userId: author.id,
                moderatorId: client.user.id,
                totalWarns: result.totalCount,
                warningNumber: result.totalCount,
                warningId: result.id
              }
            }
          });

          await message.channel.send({
            content: `⚠️ ${author}, you have been warned for **${reason}**. (Total warnings: ${result.totalCount})`
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
          actionsExecuted.push(`WARN (${result.totalCount} warnings)`);
        }
      }

      // 3. Timeout User
      if (actions.includes('timeout')) {
        const botMember = await guild.members.fetch(client.user.id).catch(() => null);
        if (botMember && member && member.moderatable && botMember.roles.highest.position > member.roles.highest.position) {
          const timeoutDurationMs = guildConfig.automod?.timeoutDuration || 10 * 60 * 1000;
          await ModerationService.timeoutUser({
            guild,
            member,
            moderator: botMember,
            durationMs: timeoutDurationMs,
            reason: `[AutoMod] ${reason}`
          });

          const durationMinutesText = `${timeoutDurationMs / 60000}m`;
          await logModerationAction({
            client,
            guild,
            event: {
              action: "Member Timed Out",
              target: `${author.tag} (${author.id})`,
              executor: `${client.user.tag} (${client.user.id})`,
              reason: `[AutoMod] ${reason}`,
              duration: durationMinutesText,
              metadata: {
                userId: author.id,
                moderatorId: client.user.id,
                durationMs: timeoutDurationMs
              }
            }
          });

          await message.channel.send({
            content: `🔇 ${author} has been timed out for ${durationMinutesText} due to: **${reason}**.`
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
          actionsExecuted.push(`TIMEOUT (${durationMinutesText})`);
        } else {
          // Fallback to warn if bot hierarchy prevents timeout
          const result = await WarningService.addWarning({
            guildId: guild.id,
            userId: author.id,
            moderatorId: client.user.id,
            reason: `[AutoMod Retry] ${reason}`
          });

          if (result.success) {
            currentWarnCount = result.totalCount;
            await logModerationAction({
              client,
              guild,
              event: {
                action: "User Warned",
                target: `${author.tag} (${author.id})`,
                executor: `${client.user.tag} (${client.user.id})`,
                reason: `[AutoMod Retry] ${reason}`,
                metadata: {
                  userId: author.id,
                  moderatorId: client.user.id,
                  totalWarns: result.totalCount,
                  warningNumber: result.totalCount,
                  warningId: result.id
                }
              }
            });
            actionsExecuted.push(`WARN (Hierarchy fallback - total warnings: ${result.totalCount})`);
          }
        }
      }

      // Check for Warning Escalation
      const escalation = guildConfig.automod?.escalation;
      if (escalation && escalation.enabled && currentWarnCount > 0 && escalation.rules?.length > 0) {
        // Find matching escalation rule
        const rule = escalation.rules
          .filter(r => r.warnCount === currentWarnCount && r.action !== 'none')
          .sort((a, b) => b.warnCount - a.warnCount)[0]; // match highest/current count rule

        if (rule) {
          const botMember = await guild.members.fetch(client.user.id).catch(() => null);
          if (botMember && member && member.moderatable && botMember.roles.highest.position > member.roles.highest.position) {
            const ruleReason = `[AutoMod Warning Escalation] Reached warning threshold of ${rule.warnCount} warnings.`;
            
            if (rule.action === 'timeout') {
              const durationMs = rule.durationMs || 3600000;
              await ModerationService.timeoutUser({
                guild,
                member,
                moderator: botMember,
                durationMs,
                reason: ruleReason
              });
              actionsExecuted.push(`ESCALATED TIMEOUT (${durationMs / 60000}m)`);
              await message.channel.send({
                content: `🔇 ${author} has been timed out for ${durationMs / 60000}m due to accumulating ${rule.warnCount} warnings.`
              }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
            } else if (rule.action === 'kick') {
              await ModerationService.kickUser({
                guild,
                member,
                moderator: botMember,
                reason: ruleReason
              });
              actionsExecuted.push('ESCALATED KICK');
              await message.channel.send({
                content: `👢 ${author.tag} has been kicked from the server due to accumulating ${rule.warnCount} warnings.`
              }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
            } else if (rule.action === 'ban') {
              await ModerationService.banUser({
                guild,
                user: author,
                moderator: botMember,
                reason: ruleReason
              });
              actionsExecuted.push('ESCALATED BAN');
              await message.channel.send({
                content: `🔨 ${author.tag} has been banned from the server due to accumulating ${rule.warnCount} warnings.`
              }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
            }
          }
        }
      }

      // 4. Log Alert to Log Channel (always log violations, even if no punishment is executed)
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🛡️ AutoMod Violation Alert')
            .setColor('#FEE75C')
            .setDescription(`A message sent by **${author.tag}** in ${message.channel} triggered AutoMod protection.`)
            .addFields(
              { name: 'User', value: `${author} (\`${author.id}\`)`, inline: true },
              { name: 'Violation', value: `\`${reason}\``, inline: true },
              { name: 'Actions Executed', value: `\`${actionsExecuted.join(', ') || 'NONE'}\``, inline: true },
              { name: 'Message Content snippet', value: `\`\`\`\n${(message.content || '').substring(0, 1000)}\n\`\`\`` }
            )
            .setTimestamp();

          await logChannel.send({ embeds: [embed] }).catch(err => {
            logger.warn(`Failed to send AutoMod alert log:`, err.message);
          });
        }
      }
    } catch (err) {
      logger.error('Error executing AutoMod punishment:', err);
    }
  }
};
