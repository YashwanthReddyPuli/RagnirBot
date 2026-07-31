import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set an AFK status so others know you are busy')
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for going AFK')
                .setRequired(false)
        ),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            let reason = '';
            if (interaction.message) {
                // Prefix command
                reason = interaction.args?.join(' ') || 'AFK';
            } else {
                // Slash command
                reason = interaction.options.getString('reason') || 'AFK';
            }

            const afkKey = `guild:${interaction.guild.id}:afk:${interaction.user.id}`;
            const afkData = {
                reason,
                timestamp: Date.now()
            };

            await client.db.set(afkKey, afkData);

            // Change nickname to include [AFK] if possible
            if (interaction.member && interaction.member.manageable) {
                const currentNickname = interaction.member.nickname || interaction.user.username;
                if (!currentNickname.startsWith('[AFK] ')) {
                    await interaction.member.setNickname(`[AFK] ${currentNickname.substring(0, 26)}`).catch(() => null);
                }
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed('AFK Status Set', `💤 You are now AFK.\n**Reason:** ${reason}`)]
            });
        } catch (error) {
            logger.error('Error in afk command:', error);
            await handleInteractionError(interaction, error, { commandName: 'afk' });
        }
    }
};
