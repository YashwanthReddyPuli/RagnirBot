import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed, warningEmbed } from '../../utils/embeds.js';
import { LockdownService } from '../../services/lockdownService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Emergency server-wide text lockdown')
        .addSubcommand(subcommand =>
            subcommand.setName('enable')
                .setDescription('Lock down all text channels (deny @everyone write)')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('disable')
                .setDescription('Disable lockdown and restore permissions')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    category: 'security',
    async execute(interaction, config, client) {
        let subcommand = '';
        if (typeof interaction.options.getSubcommand === 'function') {
            try {
                subcommand = interaction.options.getSubcommand();
            } catch (err) {
                subcommand = interaction.args?.[0]?.toLowerCase();
            }
        } else {
            subcommand = interaction.args?.[0]?.toLowerCase();
        }

        if (!subcommand || (subcommand !== 'enable' && subcommand !== 'disable')) {
            return await interaction.reply({
                embeds: [errorEmbed('Usage Error', 'Please use `enable` or `disable` subcommand.\nExample: `lockdown enable`')]
            });
        }

        await interaction.deferReply({ ephemeral: false });

        if (subcommand === 'enable') {
            if (config?.lockdownActive) {
                return await interaction.editReply({
                    embeds: [warningEmbed('Already Locked', 'Emergency lockdown is already active on this server.')]
                });
            }
            const res = await LockdownService.enableLockdown(interaction.guild, client);
            if (res.success) {
                return await interaction.editReply({
                    embeds: [successEmbed('🚨 Server Locked Down', 'Emergency lockdown has been enabled. Writing and reactions have been disabled for @everyone across all text channels.')]
                });
            } else {
                return await interaction.editReply({
                    embeds: [errorEmbed('Failed Lockdown', `Failed to enable lockdown: ${res.error}`)]
                });
            }
        } else if (subcommand === 'disable') {
            if (!config?.lockdownActive) {
                return await interaction.editReply({
                    embeds: [warningEmbed('Not Locked', 'Emergency lockdown is not active on this server.')]
                });
            }
            const res = await LockdownService.disableLockdown(interaction.guild, client);
            if (res.success) {
                return await interaction.editReply({
                    embeds: [successEmbed('🔓 Lockdown Lifted', 'Emergency lockdown has been lifted. Text channel write permissions have been restored to default.')]
                });
            } else {
                return await interaction.editReply({
                    embeds: [errorEmbed('Failed Unlock', `Failed to disable lockdown: ${res.error}`)]
                });
            }
        }
    }
};
