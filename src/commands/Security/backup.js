import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags
} from 'discord.js';
import { BackupService } from '../../services/backupService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Create and restore server layouts and roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a backup snapshot of the current server')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('A custom name for the backup')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all saved backups for this server')
        )
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Show details of a specific backup')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('The ID of the backup')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a saved backup')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('The ID of the backup to delete')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('restore')
                .setDescription('Restore the server layout from a backup (WARNING: Deletes channels & roles!)')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('The ID of the backup to restore')
                        .setRequired(true)
                )
        ),

    category: 'Security',

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const userId = interaction.user.id;

        try {
            if (subcommand === 'create') {
                await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
                const name = interaction.options.getString('name');
                const result = await BackupService.createBackup(guild, userId, name);

                if (!result.success) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('❌ Backup Failed', result.error)]
                    });
                }

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            '💾 Backup Created Successfully',
                            `**Backup ID:** \`${result.backupId}\`\n**Name:** *${result.name}*\n**Roles Saved:** ${result.rolesCount}\n**Channels Saved:** ${result.channelsCount}\n\n*Keep the backup ID safe. Use \`/backup restore ${result.backupId}\` to restore.*`
                        )
                    ]
                });
            }

            if (subcommand === 'list') {
                await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
                const backups = await BackupService.listBackups(guild.id);

                if (backups.length === 0) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [infoEmbed('📂 Server Backups', 'No backups found for this server.')]
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📂 Saved Server Backups')
                    .setColor('#336699')
                    .setDescription('Here are the backups saved for this server. Use `/backup info <id>` to inspect details.')
                    .setTimestamp();

                const fields = backups.map(b => ({
                    name: `ID: \`${b.id}\``,
                    value: `**Name:** *${b.backup_name}*\n**Created By:** <@${b.created_by}>\n**Date:** <t:${Math.floor(b.created_at.getTime() / 1000)}:R>`,
                    inline: false
                }));

                embed.addFields(fields.slice(0, 10)); // Limit to first 10 for safety

                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            if (subcommand === 'info') {
                await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
                const backupId = interaction.options.getString('id');
                const backup = await BackupService.getBackup(backupId);

                if (!backup || backup.guild_id !== guild.id) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('❌ Not Found', 'No backup was found matching that ID in this server.')]
                    });
                }

                const data = backup.data;
                const embed = new EmbedBuilder()
                    .setTitle(`📄 Backup Details: ${backup.id}`)
                    .setColor('#336699')
                    .addFields(
                        { name: 'Backup Name', value: backup.backup_name || 'Unnamed', inline: true },
                        { name: 'Created By', value: `<@${backup.created_by}>`, inline: true },
                        { name: 'Created At', value: `<t:${Math.floor(backup.created_at.getTime() / 1000)}:F>`, inline: false },
                        { name: 'Roles Captured', value: `\`${data.roles?.length || 0}\` roles`, inline: true },
                        { name: 'Categories Captured', value: `\`${data.categories?.length || 0}\` categories`, inline: true },
                        { name: 'Channels Captured', value: `\`${data.channels?.length || 0}\` channels`, inline: true }
                    )
                    .setTimestamp();

                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            if (subcommand === 'delete') {
                await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
                const backupId = interaction.options.getString('id');
                const backup = await BackupService.getBackup(backupId);

                if (!backup || backup.guild_id !== guild.id) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('❌ Not Found', 'No backup was found matching that ID in this server.')]
                    });
                }

                const deleted = await BackupService.deleteBackup(backupId);
                if (!deleted) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('❌ Delete Failed', 'Could not delete the backup from the database.')]
                    });
                }

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('🗑️ Backup Deleted', `Successfully deleted backup \`${backupId}\`.`)]
                });
            }

            if (subcommand === 'restore') {
                // Do not defer! We want to reply with the warning button prompt.
                const backupId = interaction.options.getString('id');
                const backup = await BackupService.getBackup(backupId);

                if (!backup || backup.guild_id !== guild.id) {
                    return await interaction.reply({
                        embeds: [errorEmbed('❌ Not Found', 'No backup was found matching that ID in this server.')],
                        flags: MessageFlags.Ephemeral
                    });
                }

                // Check ownership/permissions double check
                if (interaction.user.id !== guild.ownerId) {
                    return await interaction.reply({
                        embeds: [errorEmbed('❌ Access Denied', 'Only the primary Server Owner can restore server backups to prevent catastrophic abuse.')],
                        flags: MessageFlags.Ephemeral
                    });
                }

                const warningEmbed = new EmbedBuilder()
                    .setTitle('⚠️ CATASTROPHIC ACTION WARNING')
                    .setDescription(`You are about to restore the server structure from backup **${backup.backup_name}** (\`${backupId}\`).\n\n**CRITICAL IMPACTS:**\n• **All existing channels and categories will be DELETED.**\n• **All custom roles will be DELETED.**\n• Server layouts, channels, and roles will be rebuilt to the backup snapshot.\n\n*Are you absolutely sure you want to proceed? This cannot be undone.*`)
                    .setColor('#ED4245')
                    .setTimestamp();

                const confirmButton = new ButtonBuilder()
                    .setCustomId(`backup_restore_confirm:${backupId}:${userId}`)
                    .setLabel('Yes, Restore Server')
                    .setStyle(ButtonStyle.Danger);

                const cancelButton = new ButtonBuilder()
                    .setCustomId(`backup_restore_cancel:${backupId}:${userId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary);

                const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                await interaction.reply({
                    embeds: [warningEmbed],
                    components: [actionRow],
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (err) {
            logger.error('Error in backup command execution:', err);
            try {
                const errResponse = { embeds: [errorEmbed('❌ System Error', 'An error occurred while executing the backup command.')], flags: MessageFlags.Ephemeral };
                if (interaction.deferred) {
                    await InteractionHelper.safeEditReply(interaction, errResponse);
                } else {
                    await interaction.reply(errResponse);
                }
            } catch (replyErr) {
                logger.error('Failed to reply with error:', replyErr);
            }
        }
    }
};
