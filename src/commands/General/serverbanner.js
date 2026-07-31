import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('serverbanner')
        .setDescription("Retrieve and display the server's banner image."),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const guild = interaction.guild;
            const bannerUrl = guild.bannerURL({ size: 1024 });

            if (!bannerUrl) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: `❌ **${guild.name}** does not have a server banner set.`
                });
            }

            const embed = createEmbed({
                title: `🖼️ Server Banner: ${guild.name}`,
                description: `[Download Link](${bannerUrl})`,
                color: 'primary'
            }).setImage(bannerUrl);

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error('Error in serverbanner command:', error);
            await handleInteractionError(interaction, error, { commandName: 'serverbanner' });
        }
    }
};
