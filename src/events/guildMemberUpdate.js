import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';
import { logModerationAction } from '../utils/moderation.js';

export default {
  name: Events.GuildMemberUpdate,
  once: false,

  async execute(oldMember, newMember) {
    try {
      if (!newMember.guild) return;

      const fields = [];

      fields.push({
        name: '👤 Member',
        value: `${newMember.user.tag} (${newMember.user.id})`,
        inline: true
      });

      // Server Boost Messages Detection
      if (!oldMember.premiumSince && newMember.premiumSince) {
        const systemChannel = newMember.guild.systemChannel;
        if (systemChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🚀 Server Boosted!')
            .setDescription(`Thank you so much **${newMember.user}** for boosting **${newMember.guild.name}**!\nYour support is greatly appreciated! Enjoy your boosting perks! ✨`)
            .setColor('#FF73FA')
            .setThumbnail(newMember.user.displayAvatarURL())
            .setImage('https://i.imgur.com/8FkS2l8.gif') // cool nitro boost banner
            .setTimestamp()
            .setFooter({ text: `${newMember.guild.name} now has ${newMember.guild.premiumSubscriptionCount} boosts!` });

          await systemChannel.send({ content: `🎉 **SERVER BOOST!** Thank you ${newMember.user}!`, embeds: [embed] }).catch(err => {
            logger.error('Failed to send boost message to system channel:', err);
          });
      // Timeout / Mute Detection
      if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
        try {
          const executor = await AntiNukeService.resolveExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.user.id);
          const moderatorText = executor ? `${executor.tag} (${executor.id})` : 'Unknown Moderator';
          const moderatorId = executor ? executor.id : null;

          const auditLogs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberUpdate }).catch(() => null);
          const entry = auditLogs?.entries.find(e => e.targetId === newMember.user.id && Date.now() - e.createdTimestamp < 10000);
          const reason = entry?.reason || 'No reason provided';
          
          if (newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > Date.now()) {
            const durationMs = newMember.communicationDisabledUntilTimestamp - Date.now();
            const durationMinutes = Math.round(durationMs / 60000);
            
            await logModerationAction({
              client: newMember.client,
              guild: newMember.guild,
              event: {
                action: 'Member Timed Out',
                target: `${newMember.user.tag} (${newMember.user.id})`,
                executor: moderatorText,
                reason,
                duration: `${durationMinutes} minutes`,
                metadata: {
                  userId: newMember.user.id,
                  moderatorId,
                  durationMs
                }
              }
            }).catch(err => logger.error('Failed to log direct timeout:', err));
          } else if (oldMember.communicationDisabledUntilTimestamp && (!newMember.communicationDisabledUntilTimestamp || newMember.communicationDisabledUntilTimestamp <= Date.now())) {
            await logModerationAction({
              client: newMember.client,
              guild: newMember.guild,
              event: {
                action: 'Member Untimeouted',
                target: `${newMember.user.tag} (${newMember.user.id})`,
                executor: moderatorText,
                reason,
                metadata: {
                  userId: newMember.user.id,
                  moderatorId
                }
              }
            }).catch(err => logger.error('Failed to log timeout removal:', err));
          }
        } catch (err) {
          logger.error('Error logging timeout modification:', err);
        }
      }

      if (oldMember.nickname !== newMember.nickname) {
        fields.push({
          name: '🏷️ Old Nickname',
          value: oldMember.nickname || '*(no nickname)*',
          inline: true
        });

        fields.push({
          name: '🏷️ New Nickname',
          value: newMember.nickname || '*(no nickname)*',
          inline: true
        });

        await logEvent({
          client: newMember.client,
          guildId: newMember.guild.id,
          eventType: EVENT_TYPES.MEMBER_NAME_CHANGE,
          data: {
            description: `Member nickname changed: ${newMember.user.tag}`,
            userId: newMember.user.id,
            fields
          }
        });

        return;
      }

    } catch (error) {
      logger.error('Error in guildMemberUpdate event:', error);
    }
  }
};
