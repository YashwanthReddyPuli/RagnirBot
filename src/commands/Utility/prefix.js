import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/guildConfig.js';

export default {
    slash: false,
    data: new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('Get or change the server prefix')
        .addStringOption(option =>
            option.setName('new_prefix')
                .setDescription('The new prefix to set (max 5 characters)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    category: 'utility',
    async execute(interaction, config, client) {
        const newPrefix = interaction.options.getString('new_prefix');
        if (!newPrefix) {
            const currentPrefix = config?.prefix || ';';
            return await interaction.reply({
                embeds: [successEmbed('Server Prefix', `The current prefix is \`${currentPrefix}\`. Use \`/prefix <new_prefix>\` or \`${currentPrefix}prefix <new_prefix>\` to change it.`)]
            });
        }

        if (newPrefix.length > 5) {
            return await interaction.reply({
                embeds: [errorEmbed('Invalid Prefix', 'Prefix length cannot exceed 5 characters.')]
            });
        }

        const updatedConfig = { ...config, prefix: newPrefix };
        await setGuildConfig(client, interaction.guild.id, updatedConfig);

        await interaction.reply({
            embeds: [successEmbed('Prefix Changed', `The server prefix has been set to \`${newPrefix}\`.`)]
        });
    }
};
