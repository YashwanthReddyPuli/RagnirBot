import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/guildConfig.js';

export default {
    data: new SlashCommandBuilder()
        .setName('np')
        .setDescription('Configure No Prefix Mode users')
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a user to No Prefix mode')
                .addUserOption(option => option.setName('user').setDescription('The user to add').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove a user from No Prefix mode')
                .addUserOption(option => option.setName('user').setDescription('The user to remove').setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    category: 'utility',
    async execute(interaction, config, client) {
        let subcommand = '';
        let targetUser = null;

        if (typeof interaction.options.getSubcommand === 'function') {
            try {
                subcommand = interaction.options.getSubcommand();
            } catch (err) {
                // If it is mock but getSubcommand threw error
                subcommand = interaction.args?.[0]?.toLowerCase();
            }
            targetUser = interaction.options.getUser('user');
        } else {
            subcommand = interaction.args?.[0]?.toLowerCase();
            targetUser = interaction.options.getUser('user');
        }

        if (!subcommand || (subcommand !== 'add' && subcommand !== 'remove')) {
            return await interaction.reply({
                embeds: [errorEmbed('Usage Error', 'Please use `add` or `remove` subcommand.\nExample: `np add @user`')]
            });
        }

        if (!targetUser) {
            return await interaction.reply({
                embeds: [errorEmbed('User Not Found', 'Could not resolve the target user.')]
            });
        }

        const noPrefixUsers = [...(config?.noPrefixUsers || [])];

        if (subcommand === 'add') {
            if (noPrefixUsers.includes(targetUser.id)) {
                return await interaction.reply({
                    embeds: [errorEmbed('Already Added', `${targetUser.tag || targetUser.username} is already in No Prefix mode.`)]
                });
            }
            noPrefixUsers.push(targetUser.id);
            const updatedConfig = { ...config, noPrefixUsers };
            await setGuildConfig(client, interaction.guild.id, updatedConfig);
            return await interaction.reply({
                embeds: [successEmbed('No Prefix Mode Enabled', `Successfully added **${targetUser.tag || targetUser.username}** to No Prefix users list.`)]
            });
        } else if (subcommand === 'remove') {
            if (!noPrefixUsers.includes(targetUser.id)) {
                return await interaction.reply({
                    embeds: [errorEmbed('Not Found', `${targetUser.tag || targetUser.username} is not in No Prefix mode.`)]
                });
            }
            const filteredUsers = noPrefixUsers.filter(id => id !== targetUser.id);
            const updatedConfig = { ...config, noPrefixUsers: filteredUsers };
            await setGuildConfig(client, interaction.guild.id, updatedConfig);
            return await interaction.reply({
                embeds: [successEmbed('No Prefix Mode Removed', `Successfully removed **${targetUser.tag || targetUser.username}** from No Prefix users list.`)]
            });
        }
    }
};
