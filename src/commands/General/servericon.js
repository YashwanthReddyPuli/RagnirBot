import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('servericon')
        .setDescription("Retrieve and display the server's icon image."),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const guild = interaction.guild;
            const iconUrl = guild.iconURL({ size: 1024, dynamic: true });

            if (!iconUrl) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: `❌ **${guild.name}** does not have an icon set.`
                });
            }

            const embed = createEmbed({
                title: `🖼️ Server Icon: ${guild.name}`,
                description: `[Download Link](${iconUrl})`,
                color: 'primary'
            }).setImage(iconUrl);

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error('Error in servericon command:', error);
            await handleInteractionError(interaction, error, { commandName: 'servericon' });
        }
    }
};
