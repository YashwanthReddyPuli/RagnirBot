import { ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { BackupService } from '../../services/backupService.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

const backupRestoreConfirmButton = {
    name: 'backup_restore_confirm',
    async execute(interaction, client, args) {
        const [backupId, userId] = args;

        if (interaction.user.id !== userId) {
            return await interaction.reply({
                embeds: [errorEmbed('❌ Access Denied', 'Only the owner who initiated the restore command can confirm it.')],
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await interaction.deferUpdate();

            // Notify that restore is starting
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🔄 Restoration In Progress')
                        .setDescription('Deconstructing current channels/roles and rebuilding from the backup snapshot. This may take a moment...')
                        .setColor('#F1C40F')
                ],
                components: []
            });

            // Perform the restore
            const result = await BackupService.restoreBackup(interaction.guild, backupId);

            if (!result.success) {
                try {
                    await interaction.editReply({
                        embeds: [errorEmbed('❌ Restore Failed', result.error)],
                        components: []
                    });
                } catch (e) {
                    // Falls back to DM if the channel was deleted
                    await interaction.user.send({
                        embeds: [errorEmbed('❌ Restore Failed', `Restoration failed: ${result.error}`)]
                    }).catch(() => null);
                }
                return;
            }

            // Send DM to the owner on successful restoration
            await interaction.user.send({
                embeds: [
                    successEmbed(
                        '🏰 Server Rebuilt Successfully',
                        `The server **${interaction.guild.name}** has been successfully restored from backup \`${backupId}\`!`
                    )
                ]
            }).catch(() => null);

            // Attempt to edit interaction response in case the target channel survived
            try {
                await interaction.editReply({
                    embeds: [successEmbed('🏰 Restore Complete', 'Rebuild complete. Check the new channels and roles.')],
                    components: []
                });
            } catch (err) {
                // Ignore: channel or message was likely deleted during deconstruction
                logger.debug('Could not edit interaction response after restore, likely due to channel deletion.');
            }
        } catch (error) {
            logger.error('Error handling restore confirm button:', error);
            try {
                await interaction.user.send({
                    embeds: [errorEmbed('❌ Restore Error', `An error occurred during restoration: ${error.message}`)]
                }).catch(() => null);
            } catch (e) {}
        }
    }
};

const backupRestoreCancelButton = {
    name: 'backup_restore_cancel',
    async execute(interaction, client, args) {
        const [, userId] = args;

        if (interaction.user.id !== userId) {
            return await interaction.reply({
                embeds: [errorEmbed('❌ Access Denied', 'Only the owner who initiated the restore command can cancel it.')],
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Restoration Cancelled')
                        .setDescription('The server restoration request was cancelled. No changes were made.')
                        .setColor('#95A5A6')
                ],
                components: []
            });
        } catch (error) {
            logger.error('Error handling restore cancel button:', error);
        }
    }
};

export default [
    backupRestoreConfirmButton,
    backupRestoreCancelButton
];
