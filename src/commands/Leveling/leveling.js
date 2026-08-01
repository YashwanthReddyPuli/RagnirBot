import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { getLevelingConfig, addLevels, removeLevels, setUserLevel, getUserLevelData } from '../../services/leveling.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { checkUserPermissions } from '../../utils/permissionGuard.js';
import { RagnirBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getColor } from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leveling')
        .setDescription('Configure and manage Leveling system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('View the current leveling configuration status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add levels to a user')
                .addUserOption(option => option.setName('user').setDescription('The user to add levels to').setRequired(true))
                .addIntegerOption(option => option.setName('levels').setDescription('Number of levels to add').setRequired(true).setMinValue(1))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove levels from a user')
                .addUserOption(option => option.setName('user').setDescription('The user to remove levels from').setRequired(true))
                .addIntegerOption(option => option.setName('levels').setDescription('Number of levels to remove').setRequired(true).setMinValue(1))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription("Set a user's level to a specific value")
                .addUserOption(option => option.setName('user').setDescription('The user to set the level for').setRequired(true))
                .addIntegerOption(option => option.setName('level').setDescription('The level to set').setRequired(true).setMinValue(0))
        ),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;

            const hasPermission = await checkUserPermissions(
                interaction,
                PermissionFlagsBits.ManageGuild,
                'You need ManageGuild permission to use this command.'
            );
            if (!hasPermission) return;

            const levelingConfig = await getLevelingConfig(client, guildId);

            if (subcommand === 'config') {
                const status = levelingConfig.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
                const xpPerMsg = `${levelingConfig.xpPerMessage?.min || 15} - ${levelingConfig.xpPerMessage?.max || 25} XP`;
                const cooldown = `${levelingConfig.xpCooldown || 20} seconds`;
                const multiplier = `${levelingConfig.xpMultiplier || 1}x`;
                const announce = levelingConfig.announceLevelUp ? '📣 Announce in chat' : '🤫 Silent';
                const channel = levelingConfig.levelUpChannel ? `<#${levelingConfig.levelUpChannel}>` : '`Current Channel`';
                const msgTemplate = levelingConfig.levelUpMessage || '{user} has leveled up to level {level}!';

                const ignoredChans = levelingConfig.ignoredChannels?.map(id => `<#${id}>`).join(', ') || 'None';
                const ignoredRls = levelingConfig.ignoredRoles?.map(id => `<@&${id}>`).join(', ') || 'None';

                const embed = new EmbedBuilder()
                    .setTitle('📊 Leveling System Configuration')
                    .setColor(getColor('info'))
                    .addFields(
                        { name: 'System Status', value: status, inline: true },
                        { name: 'XP per Message', value: xpPerMsg, inline: true },
                        { name: 'XP Cooldown', value: cooldown, inline: true },
                        { name: 'XP Multiplier', value: multiplier, inline: true },
                        { name: 'Announcement Type', value: announce, inline: true },
                        { name: 'Announcements Channel', value: channel, inline: true },
                        { name: 'Level Up Message Template', value: `\`\`\`\n${msgTemplate}\n\`\`\``, inline: false },
                        { name: 'Ignored Channels', value: ignoredChans, inline: false },
                        { name: 'Ignored Roles', value: ignoredRls, inline: false }
                    )
                    .setTimestamp();

                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            else if (subcommand === 'add') {
                if (!levelingConfig?.enabled) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [new EmbedBuilder().setColor('#f1c40f').setDescription('The leveling system is currently disabled on this server.')],
                        flags: MessageFlags.Ephemeral
                    });
                }

                const targetUser = interaction.options.getUser('user');
                const levelsToAdd = interaction.options.getInteger('levels');

                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!member) {
                    throw new RagnirBotError(`User ${targetUser.id} not found in this guild`, ErrorTypes.USER_INPUT, 'The specified user is not in this server.');
                }

                const userData = await addLevels(client, guildId, targetUser.id, levelsToAdd);

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '✅ Levels Added',
                            description: `Successfully added ${levelsToAdd} levels to ${targetUser.tag}.\n**New Level:** ${userData.level}`,
                            color: 'success'
                        })
                    ]
                });

                logger.info(`[ADMIN] User ${interaction.user.tag} added ${levelsToAdd} levels to ${targetUser.tag} in guild ${guildId}`);
            }

            else if (subcommand === 'remove') {
                if (!levelingConfig?.enabled) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [new EmbedBuilder().setColor('#f1c40f').setDescription('The leveling system is currently disabled on this server.')],
                        flags: MessageFlags.Ephemeral
                    });
                }

                const targetUser = interaction.options.getUser('user');
                const levelsToRemove = interaction.options.getInteger('levels');

                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!member) {
                    throw new RagnirBotError(`User ${targetUser.id} not found in this guild`, ErrorTypes.USER_INPUT, 'The specified user is not in this server.');
                }

                const userData = await getUserLevelData(client, guildId, targetUser.id);
                if (userData.level === 0) {
                    throw new RagnirBotError(`User ${targetUser.id} is already at minimum level`, ErrorTypes.VALIDATION, `${targetUser.tag} is already at level 0 and cannot have levels removed.`);
                }

                const updatedData = await removeLevels(client, guildId, targetUser.id, levelsToRemove);

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '✅ Levels Removed',
                            description: `Successfully removed ${levelsToRemove} levels from ${targetUser.tag}.\n**New Level:** ${updatedData.level}`,
                            color: 'success'
                        })
                    ]
                });

                logger.info(`[ADMIN] User ${interaction.user.tag} removed ${levelsToRemove} levels from ${targetUser.tag} in guild ${guildId}`);
            }

            else if (subcommand === 'set') {
                if (!levelingConfig?.enabled) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [new EmbedBuilder().setColor('#f1c40f').setDescription('The leveling system is currently disabled on this server.')],
                        flags: MessageFlags.Ephemeral
                    });
                }

                const targetUser = interaction.options.getUser('user');
                const newLevel = interaction.options.getInteger('level');

                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!member) {
                    throw new RagnirBotError(`User ${targetUser.id} not found in this guild`, ErrorTypes.USER_INPUT, 'The specified user is not in this server.');
                }

                const userData = await setUserLevel(client, guildId, targetUser.id, newLevel);

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '✅ Level Set',
                            description: `Successfully set ${targetUser.tag}'s level to **${newLevel}**.\n**Total XP:** ${userData.totalXp}`,
                            color: 'success'
                        })
                    ]
                });

                logger.info(`[ADMIN] User ${interaction.user.tag} set ${targetUser.tag}'s level to ${newLevel} in guild ${guildId}`);
            }
        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'leveling'
            });
        }
    }
};
