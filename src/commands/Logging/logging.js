import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import setchannel from './modules/logging_setchannel.js';
import filter from './modules/logging_filter.js';

export default {
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Manage audit logging for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the interactive logging dashboard — view status and toggle event categories.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Automatically create a dedicated logs category and channels for logging.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setchannel')
                .setDescription('Set the audit log channel for this server.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('The text channel for audit logs.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('disable')
                        .setDescription('Set to True to disable audit logging entirely.')
                        .setRequired(false),
                ),
        )
        .addSubcommandGroup((group) =>
            group
                .setName('filter')
                .setDescription('Manage the log ignore list (users and channels to skip).')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Add a user or channel to the log ignore list.')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Whether to ignore a user or channel.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'User', value: 'user' },
                                    { name: 'Channel', value: 'channel' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('The ID of the user or channel to ignore.')
                                .setRequired(true),
                        ),
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a user or channel from the log ignore list.')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Whether this is a user or channel.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'User', value: 'user' },
                                    { name: 'Channel', value: 'channel' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('The ID of the user or channel to remove from the ignore list.')
                                .setRequired(true),
                        ),
                ),
        ),

    async execute(interaction, config, client) {
        try {
            // setchannel and filter both need a reply deferred before their logic runs
            const subcommandGroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return await dashboard.execute(interaction, config, client);
            }

            if (subcommand === 'setup') {
                await InteractionHelper.safeDefer(interaction);
                const guild = interaction.guild;
                const me = guild.members.me;

                // Check permissions
                if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Permission Error', 'I need the **Manage Channels** permission to automatically set up log channels.')]
                    });
                }

                // 1. Create or Find category
                let category = guild.channels.cache.find(c => c.name.toLowerCase() === 'ragnir logs' && c.type === ChannelType.GuildCategory);
                if (!category) {
                    category = await guild.channels.create({
                        name: 'Ragnir Logs',
                        type: ChannelType.GuildCategory,
                        reason: 'Auto log setup category'
                    });
                }

                // Channels definition mapping configuration properties
                const logChannels = [
                    { name: 'general-logs', key: 'logChannelId' },
                    { name: 'moderation-logs', key: 'modLogChannelId' },
                    { name: 'ticket-logs', key: 'ticketLogsChannelId' },
                    { name: 'message-logs', key: 'messageLogChannelId' },
                    { name: 'member-logs', key: 'memberLogChannelId' },
                    { name: 'leveling-logs', key: 'levelingLogChannelId' }
                ];

                const createdChannels = [];
                const { getGuildConfig, setGuildConfig } = await import('../../services/guildConfig.js');
                const guildConfig = await getGuildConfig(client, guild.id);

                for (const chanDef of logChannels) {
                    let channel = guild.channels.cache.find(c => c.name === chanDef.name && c.parentId === category.id && c.type === ChannelType.GuildText);
                    if (!channel) {
                        channel = await guild.channels.create({
                            name: chanDef.name,
                            type: ChannelType.GuildText,
                            parent: category.id,
                            reason: 'Auto setup log channel'
                        });
                    }
                    guildConfig[chanDef.key] = channel.id;
                    createdChannels.push(`${chanDef.name}: ${channel}`);
                }

                // Enable global logging config too
                guildConfig.enableLogging = true;
                guildConfig.logging = {
                    ...(guildConfig.logging || {}),
                    enabled: true,
                    channelId: guildConfig.logChannelId
                };

                await setGuildConfig(client, guild.id, guildConfig);

                const embed = successEmbed(
                    'Setup Completed ✅',
                    `Successfully created logging category **Ragnir Logs** and channels:\n\n${createdChannels.join('\n')}\n\nAll events will now be routed to their respective log channels.`
                );

                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            await InteractionHelper.safeDefer(interaction);

            if (subcommand === 'setchannel') {
                return await setchannel.execute(interaction, config, client);
            }

            if (subcommandGroup === 'filter') {
                return await filter.execute(interaction, config, client);
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Unknown Subcommand', 'This subcommand is not recognised.')],
            });
        } catch (error) {
            logger.error('logging command error:', error);
            await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Error', 'An unexpected error occurred.')],
                ephemeral: true,
            }).catch(() => {});
        }
    },
};
