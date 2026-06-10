import { EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getGuildConfig } from './guildConfig.js';
import { WarningService } from './warningService.js';
import { ModerationService } from './moderationService.js';

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

      // Bypass: Ignored channels
      if (automod.ignoredChannels?.includes(channelId)) {
        return false;
      }

      // Bypass: Ignored roles and security bypass role
      const member = await message.guild.members.fetch(authorId).catch(() => null);
      if (member) {
        if (member.roles.cache.some(r => r.name.toLowerCase() === 'security bypass')) {
          return false;
        }
        if (automod.ignoredRoles?.some(roleId => member.roles.cache.has(roleId))) {
          return false;
        }
      }

      // 3. Filter Checks
      const content = message.content || '';

      // --- Filter 1: Anti-Spam ---
      if (automod.spam?.enabled) {
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
          await this.executePunishment(message, spam.action, 'Spamming messages', client);
          return true;
        }
      }

      // --- Filter 2: Mass Mentions ---
      if (automod.mentions?.enabled) {
        const mentions = automod.mentions;
        const totalMentions = message.mentions.users.size + 
                             message.mentions.roles.size + 
                             (content.includes('@everyone') ? 1 : 0) + 
                             (content.includes('@here') ? 1 : 0);

        if (totalMentions > mentions.limit) {
          await this.executePunishment(message, mentions.action, `Mass mentions (${totalMentions} pings)`, client);
          return true;
        }
      }

      // --- Filter 3: Invite Links ---
      if (automod.invite?.enabled) {
        const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discord(app)?\.com\/invite\/.+)/i;
        if (inviteRegex.test(content)) {
          await this.executePunishment(message, automod.invite.action, 'Posting invite links', client);
          return true;
        }
      }

      // --- Filter 4: External Links (Exclude invites if invite filter is disabled)
      if (automod.link?.enabled) {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        if (urlRegex.test(content)) {
          await this.executePunishment(message, automod.link.action, 'Posting external links', client);
          return true;
        }
      }

      // --- Filter 5: Banned Words ---
      if (automod.words?.enabled && automod.words.list?.length > 0) {
        const wordsList = automod.words.list;
        const lowercaseContent = content.toLowerCase();
        
        const matchedWord = wordsList.find(word => {
          const regex = new RegExp(`\\b${this.escapeRegExp(word)}\\b`, 'i');
          return regex.test(lowercaseContent);
        });

        if (matchedWord) {
          await this.executePunishment(message, automod.words.action, `Using banned word: ||${matchedWord}||`, client);
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
  async executePunishment(message, action, reason, client) {
    const { guild, author, member } = message;
    const logChannelId = guild.client.config?.logChannelId || guild.systemChannelId;

    try {
      // 1. Delete Message
      if (action === 'delete' || action === 'warn' || action === 'timeout') {
        await message.delete().catch(err => {
          logger.warn(`Failed to delete AutoMod message:`, err.message);
        });
      }

      // 2. Warn User
      if (action === 'warn') {
        const result = await WarningService.addWarning({
          guildId: guild.id,
          userId: author.id,
          moderatorId: client.user.id,
          reason: `[AutoMod] ${reason}`
        });

        if (result.success) {
          await message.channel.send({
            content: `⚠️ ${author}, you have been warned for **${reason}**. (Total warnings: ${result.totalCount})`
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }
      }

      // 3. Timeout User
      if (action === 'timeout') {
        const botMember = await guild.members.fetch(client.user.id).catch(() => null);
        if (botMember && member && member.moderatable && botMember.roles.highest.position > member.roles.highest.position) {
          const tenMinutesMs = 10 * 60 * 1000;
          await ModerationService.timeoutUser({
            guild,
            member,
            moderator: botMember,
            durationMs: tenMinutesMs,
            reason: `[AutoMod] ${reason}`
          });

          await message.channel.send({
            content: `🔇 ${author} has been timed out for 10 minutes due to: **${reason}**.`
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
        } else {
          // Fallback to warn if bot hierarchy prevents timeout
          await WarningService.addWarning({
            guildId: guild.id,
            userId: author.id,
            moderatorId: client.user.id,
            reason: `[AutoMod Retry] ${reason}`
          });
        }
      }

      // 4. Log Alert to Log Channel
      if (action !== 'none' && logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🛡️ AutoMod Violation Alert')
            .setColor('#FEE75C')
            .setDescription(`A message sent by **${author.tag}** in ${message.channel} triggered AutoMod protection.`)
            .addFields(
              { name: 'User', value: `${author} (\`${author.id}\`)`, inline: true },
              { name: 'Violation', value: `\`${reason}\``, inline: true },
              { name: 'Action Taken', value: `\`${action.toUpperCase()}\``, inline: true },
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
