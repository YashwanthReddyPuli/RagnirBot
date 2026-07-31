import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Broadcasts a message as the bot and deletes your trigger message.')
        .addStringOption(option => 
            option
                .setName('message')
                .setDescription('The message content to broadcast.')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, config, client) {
        try {
            let broadcastText = '';
            const isPrefix = !!interaction.message;

            if (isPrefix) {
                // For prefix commands, extract the text after 'say' from the raw message content
                const rawContent = interaction.message.content;
                const sayIndex = rawContent.toLowerCase().indexOf('say');
                if (sayIndex !== -1) {
                    broadcastText = rawContent.substring(sayIndex + 3).trim();
                } else {
                    broadcastText = interaction.options.getString('message') || '';
                }
            } else {
                // For slash commands, get the string option
                broadcastText = interaction.options.getString('message') || '';
            }

            if (!broadcastText) {
                if (isPrefix) {
                    await interaction.message.reply('❌ Please specify a message to broadcast.').catch(() => null);
                } else {
                    await interaction.reply({ content: '❌ Please specify a message to broadcast.', flags: MessageFlags.Ephemeral });
                }
                return;
            }

            // Send the broadcast message to the channel
            await interaction.channel.send({ content: broadcastText });

            // If prefix command, delete the original user's message
            if (isPrefix) {
                await interaction.message.delete().catch(err => {
                    logger.debug('Failed to delete say trigger message:', err.message);
                });
            } else {
                // Slash command needs an ephemeral reply to complete the interaction
                await interaction.reply({ content: '✅ Broadcast sent!', flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            logger.error('Error executing say command:', error);
            if (!interaction.replied && !interaction.deferred) {
                if (interaction.reply) {
                    await interaction.reply({ content: '❌ An error occurred while executing this command.', flags: MessageFlags.Ephemeral }).catch(() => null);
                }
            }
        }
    }
};
