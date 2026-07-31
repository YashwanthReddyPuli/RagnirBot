import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('Displays the total members, humans, and bot count of this server.'),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const guild = interaction.guild;
            await guild.members.fetch();

            const total = guild.memberCount;
            const bots = guild.members.cache.filter(m => m.user.bot).size;
            const humans = total - bots;

            const embed = createEmbed({
                title: `👥 Server Member Count`,
                description: `Detailed member statistics for **${guild.name}**`,
                color: 'primary'
            })
            .setThumbnail(guild.iconURL({ size: 128 }))
            .addFields(
                { name: '👥 Total Members', value: `**${total}**`, inline: true },
                { name: '👤 Humans', value: `**${humans}**`, inline: true },
                { name: '🤖 Bots', value: `**${bots}**`, inline: true }
            );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error('Error in membercount command:', error);
            await handleInteractionError(interaction, error, { commandName: 'membercount' });
        }
    }
};
