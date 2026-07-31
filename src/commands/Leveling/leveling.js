import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { getLevelingConfig } from '../../services/leveling.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getColor } from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leveling')
        .setDescription('Configure and check Leveling configurations')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('View the current leveling configuration status')
        ),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;

            if (subcommand === 'config') {
                const levelingConfig = await getLevelingConfig(client, guildId);

                const status = levelingConfig.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
                const xpPerMsg = `${levelingConfig.xpPerMessage?.min || 15} - ${levelingConfig.xpPerMessage?.max || 25} XP`;
                const cooldown = `${levelingConfig.xpCooldown || 20} seconds`;
                const multiplier = `${levelingConfig.xpMultiplier || 1}x`;
                const announce = levelingConfig.announceLevelUp ? '📣 Announce in chat' : '🤫 Silent';
                const channel = levelingConfig.levelUpChannel ? `<#${levelingConfig.levelUpChannel}>` : '`Current Channel`';
                const msgTemplate = levelingConfig.levelUpMessage || '{user} has leveled up to level {level}!';

                const ignoredChans = levelingConfig.ignoredChannels?.map(id => `<#${id}>`).join(', ') || 'None';
                const ignoredRls = levelingConfig.ignoredRoles?.map(id => `<@&${id}>`).join(', ') || 'None';

                const embed = new EmbedBuilder()
                    .setTitle('📊 Leveling System Configuration')
                    .setColor(getColor('info'))
                    .addFields(
                        { name: 'System Status', value: status, inline: true },
                        { name: 'XP per Message', value: xpPerMsg, inline: true },
                        { name: 'XP Cooldown', value: cooldown, inline: true },
                        { name: 'XP Multiplier', value: multiplier, inline: true },
                        { name: 'Announcement Type', value: announce, inline: true },
                        { name: 'Announcements Channel', value: channel, inline: true },
                        { name: 'Level Up Message Template', value: `\`\`\`\n${msgTemplate}\n\`\`\``, inline: false },
                        { name: 'Ignored Channels', value: ignoredChans, inline: false },
                        { name: 'Ignored Roles', value: ignoredRls, inline: false }
                    )
                    .setTimestamp();

                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }
        } catch (error) {
            logger.error('Error executing leveling config:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Error', 'Could not retrieve leveling configuration.')]
            });
        }
    }
};
