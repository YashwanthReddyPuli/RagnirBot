import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription("Retrieve and display a user's profile banner or the server's banner.")
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user whose banner you want to retrieve')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('server')
                .setDescription('Get the server banner instead')
                .setRequired(false)
        ),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const getGuildBanner = interaction.options.getBoolean('server') || false;
            
            if (getGuildBanner) {
                const guild = interaction.guild;
                const bannerUrl = guild.bannerURL({ size: 1024 });

                if (!bannerUrl) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        content: `❌ **${guild.name}** does not have a server banner set.`
                    });
                }

                const embed = createEmbed({
                    title: `🖼️ Server Banner: ${guild.name}`,
                    color: 'primary'
                }).setImage(bannerUrl);

                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            const targetUserRaw = interaction.options.getUser('target') || interaction.user;
            
            // Force fetch user to get banner from Discord API
            const targetUser = await client.users.fetch(targetUserRaw.id, { force: true });
            const bannerUrl = targetUser.bannerURL({ size: 1024 });

            if (!bannerUrl) {
                return await InteractionHelper.safeEditReply(interaction, {
                    content: `❌ **${targetUser.username}** does not have a profile banner set.`
                });
            }

            const embed = createEmbed({
                title: `🖼️ Profile Banner: ${targetUser.username}`,
                color: 'primary'
            }).setImage(bannerUrl);

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error('Error in banner command:', error);
            await handleInteractionError(interaction, error, { commandName: 'banner' });
        }
    }
};
