import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../services/guildConfig.js';
import { createEmbed, successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const EVENTS_CHOICES = [
  { name: 'All Events', value: 'all' },
  { name: 'Role Create', value: 'roleCreate' },
  { name: 'Role Update', value: 'roleUpdate' },
  { name: 'Role Delete', value: 'roleDelete' },
  { name: 'Channel Create', value: 'channelCreate' },
  { name: 'Channel Update', value: 'channelUpdate' },
  { name: 'Channel Delete', value: 'channelDelete' },
  { name: 'Member Ban', value: 'ban' },
  { name: 'Member Kick', value: 'kick' },
  { name: 'Webhook Modify', value: 'webhook' },
  { name: 'Bot Add', value: 'botAdd' },
  { name: 'Server Update', value: 'serverUpdate' },
  { name: 'Emoji Create', value: 'emojiCreate' },
  { name: 'Emoji Delete', value: 'emojiDelete' },
  { name: 'Emoji Update', value: 'emojiUpdate' }
];

export default {
  data: new SlashCommandBuilder()
    .setName('anti-nuke')
    .setDescription('Configure and manage Anti-Nuke server protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcmd =>
      subcmd.setName('enable').setDescription('Enable the Anti-Nuke security system')
    )
    .addSubcommand(subcmd =>
      subcmd.setName('disable').setDescription('Disable the Anti-Nuke security system')
    )
    .addSubcommand(subcmd =>
      subcmd.setName('logging')
        .setDescription('Set the channel for Anti-Nuke security logs')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Log channel').setRequired(true)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('whitelist-user')
        .setDescription('Manage whitelisted users')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action to take').setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
        )
        .addUserOption(opt =>
          opt.setName('user').setDescription('Target user').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('event').setDescription('Specific event (default: all)').setRequired(false)
            .addChoices(...EVENTS_CHOICES)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('whitelist-role')
        .setDescription('Manage whitelisted roles')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action to take').setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
        )
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Target role').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('event').setDescription('Specific event (default: all)').setRequired(false)
            .addChoices(...EVENTS_CHOICES)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('whitelist-list').setDescription('List all whitelisted users and roles')
    )
    .addSubcommand(subcmd =>
      subcmd.setName('panel').setDescription('Open the interactive Anti-Nuke Control Panel')
    ),

  category: 'Moderation',

  async execute(interaction, config, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // Load or initialize config
    let guildConfig = await getGuildConfig(client, guildId);
    if (!guildConfig.antinuke) {
      guildConfig.antinuke = {
        enabled: false,
        logChannelId: null,
        whitelistedUsers: {},
        whitelistedRoles: {},
        settings: {
          roleCreate: { limit: 3, timeframe: 15000, action: 'demote' },
          roleUpdate: { limit: 3, timeframe: 15000, action: 'demote' },
          roleDelete: { limit: 3, timeframe: 15000, action: 'demote' },
          channelCreate: { limit: 3, timeframe: 15000, action: 'demote' },
          channelUpdate: { limit: 3, timeframe: 15000, action: 'demote' },
          channelDelete: { limit: 3, timeframe: 15000, action: 'demote' },
          ban: { limit: 3, timeframe: 15000, action: 'ban' },
          kick: { limit: 3, timeframe: 15000, action: 'ban' },
          webhook: { limit: 1, timeframe: 10000, action: 'ban' },
          botAdd: { limit: 1, timeframe: 10000, action: 'ban' },
          serverUpdate: { limit: 1, timeframe: 10000, action: 'ban' },
          emojiCreate: { limit: 5, timeframe: 15000, action: 'demote' },
          emojiDelete: { limit: 5, timeframe: 15000, action: 'demote' },
          emojiUpdate: { limit: 5, timeframe: 15000, action: 'demote' }
        }
      };
    }

    try {
      if (subcommand === 'enable') {
        guildConfig.antinuke.enabled = true;
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('🛡️ Anti-Nuke Enabled', 'Anti-Nuke protection has been activated for this server.')]
        });
      }

      if (subcommand === 'disable') {
        guildConfig.antinuke.enabled = false;
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('🔓 Anti-Nuke Disabled', 'Anti-Nuke protection has been deactivated.')]
        });
      }

      if (subcommand === 'logging') {
        const channel = interaction.options.getChannel('channel');
        guildConfig.antinuke.logChannelId = channel.id;
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('📝 Log Channel Set', `Anti-Nuke alerts will now be logged to ${channel}.`)]
        });
      }

      if (subcommand === 'whitelist-user') {
        const action = interaction.options.getString('action');
        const user = interaction.options.getUser('user');
        const event = interaction.options.getString('event') || 'all';

        if (action === 'add') {
          const current = guildConfig.antinuke.whitelistedUsers[user.id];
          if (event === 'all') {
            guildConfig.antinuke.whitelistedUsers[user.id] = true;
          } else {
            const list = Array.isArray(current) ? current : [];
            if (!list.includes(event)) list.push(event);
            guildConfig.antinuke.whitelistedUsers[user.id] = list;
          }
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('👤 User Whitelisted', `Successfully whitelisted **${user.tag}** for \`${event}\` events.`)]
          });
        } else {
          delete guildConfig.antinuke.whitelistedUsers[user.id];
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('👤 User Removed', `Removed **${user.tag}** from the whitelist.`)]
          });
        }
      }

      if (subcommand === 'whitelist-role') {
        const action = interaction.options.getString('action');
        const role = interaction.options.getRole('role');
        const event = interaction.options.getString('event') || 'all';

        if (action === 'add') {
          const current = guildConfig.antinuke.whitelistedRoles[role.id];
          if (event === 'all') {
            guildConfig.antinuke.whitelistedRoles[role.id] = true;
          } else {
            const list = Array.isArray(current) ? current : [];
            if (!list.includes(event)) list.push(event);
            guildConfig.antinuke.whitelistedRoles[role.id] = list;
          }
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('👥 Role Whitelisted', `Successfully whitelisted role **${role.name}** for \`${event}\` events.`)]
          });
        } else {
          delete guildConfig.antinuke.whitelistedRoles[role.id];
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('👥 Role Removed', `Removed role **${role.name}** from the whitelist.`)]
          });
        }
      }

      if (subcommand === 'whitelist-list') {
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Anti-Nuke Whitelist Status')
          .setColor('#336699')
          .setTimestamp();

        let usersDesc = '';
        for (const [userId, val] of Object.entries(guildConfig.antinuke.whitelistedUsers || {})) {
          const formatted = val === true ? 'All Events' : Array.isArray(val) ? val.join(', ') : 'None';
          usersDesc += `<@${userId}>: \`${formatted}\`\n`;
        }
        embed.addFields({ name: 'Whitelisted Users', value: usersDesc || 'No users whitelisted' });

        let rolesDesc = '';
        for (const [roleId, val] of Object.entries(guildConfig.antinuke.whitelistedRoles || {})) {
          const formatted = val === true ? 'All Events' : Array.isArray(val) ? val.join(', ') : 'None';
          rolesDesc += `<@&${roleId}>: \`${formatted}\`\n`;
        }
        embed.addFields({ name: 'Whitelisted Roles', value: rolesDesc || 'No roles whitelisted' });

        return await InteractionHelper.universalReply(interaction, { embeds: [embed] });
      }

      if (subcommand === 'panel') {
        return await this.sendPanel(interaction, guildConfig, client);
      }

    } catch (err) {
      logger.error('Error in anti-nuke command execution:', err);
      return await InteractionHelper.universalReply(interaction, {
        embeds: [errorEmbed('An error occurred while running the Anti-Nuke command.')]
      });
    }
  },

  async sendPanel(interaction, guildConfig, client) {
    const generatePanelEmbed = (config) => {
      const antinuke = config.antinuke;
      const status = antinuke.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
      const logChannel = antinuke.logChannelId ? `<#${antinuke.logChannelId}>` : '`Not Configured`';

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Anti-Nuke Control Panel')
        .setDescription('Manage your server security, configure whitelist perms for specific roles or users, and toggle settings below.')
        .setColor('#336699')
        .addFields(
          { name: 'Status', value: status, inline: true },
          { name: 'Logging Channel', value: logChannel, inline: true }
        )
        .setTimestamp();

      return embed;
    };

    const rowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('an_toggle_state')
        .setLabel(guildConfig.antinuke.enabled ? 'Disable Anti-Nuke' : 'Enable Anti-Nuke')
        .setStyle(guildConfig.antinuke.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('an_refresh')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
    );

    const rowUserSelect = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('an_select_user')
        .setPlaceholder('Select a user to configure whitelisted events')
    );

    const rowRoleSelect = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('an_select_role')
        .setPlaceholder('Select a role to configure whitelisted events')
    );

    const response = await (interaction.deferred || interaction.replied
      ? interaction.editReply({
          embeds: [generatePanelEmbed(guildConfig)],
          components: [rowButtons, rowUserSelect, rowRoleSelect],
          fetchReply: true
        })
      : interaction.reply({
          embeds: [generatePanelEmbed(guildConfig)],
          components: [rowButtons, rowUserSelect, rowRoleSelect],
          fetchReply: true
        })
    );

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120000
    });

    let selectedTargetId = null;
    let selectedType = null; // 'user' or 'role'

    collector.on('collect', async (i) => {
      try {
        let currentConfig = await getGuildConfig(client, interaction.guild.id);

        if (i.customId === 'an_toggle_state') {
          currentConfig.antinuke.enabled = !currentConfig.antinuke.enabled;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          rowButtons.components[0]
            .setLabel(currentConfig.antinuke.enabled ? 'Disable Anti-Nuke' : 'Enable Anti-Nuke')
            .setStyle(currentConfig.antinuke.enabled ? ButtonStyle.Danger : ButtonStyle.Success);
          return await i.editReply({
            embeds: [generatePanelEmbed(currentConfig)],
            components: [rowButtons, rowUserSelect, rowRoleSelect]
          });
        }

        if (i.customId === 'an_refresh') {
          await i.deferUpdate();
          return await i.editReply({
            embeds: [generatePanelEmbed(currentConfig)],
            components: [rowButtons, rowUserSelect, rowRoleSelect]
          });
        }

        if (i.customId === 'an_select_user') {
          selectedTargetId = i.values[0];
          selectedType = 'user';
          const val = currentConfig.antinuke.whitelistedUsers[selectedTargetId] || [];
          const currentEvents = val === true ? ['all'] : val;

          const eventSelect = new StringSelectMenuBuilder()
            .setCustomId('an_toggle_events')
            .setPlaceholder(`Perms for chosen User`)
            .setMinValues(1)
            .setMaxValues(EVENTS_CHOICES.length)
            .addOptions(EVENTS_CHOICES.map(choice => ({
              label: choice.name,
              value: choice.value,
              default: currentEvents.includes(choice.value)
            })));

          const actionRow = new ActionRowBuilder().addComponents(eventSelect);
          const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('an_back_to_main').setLabel('Back').setStyle(ButtonStyle.Secondary)
          );

          await i.deferUpdate();
          return await i.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`👤 Edit Permissions: <@${selectedTargetId}>`)
                .setDescription('Select all events you want to whitelist for this user. Deselecting all will remove them from whitelist.')
                .setColor('#336699')
            ],
            components: [actionRow, backButton]
          });
        }

        if (i.customId === 'an_select_role') {
          selectedTargetId = i.values[0];
          selectedType = 'role';
          const val = currentConfig.antinuke.whitelistedRoles[selectedTargetId] || [];
          const currentEvents = val === true ? ['all'] : val;

          const eventSelect = new StringSelectMenuBuilder()
            .setCustomId('an_toggle_events')
            .setPlaceholder(`Perms for chosen Role`)
            .setMinValues(1)
            .setMaxValues(EVENTS_CHOICES.length)
            .addOptions(EVENTS_CHOICES.map(choice => ({
              label: choice.name,
              value: choice.value,
              default: currentEvents.includes(choice.value)
            })));

          const actionRow = new ActionRowBuilder().addComponents(eventSelect);
          const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('an_back_to_main').setLabel('Back').setStyle(ButtonStyle.Secondary)
          );

          await i.deferUpdate();
          return await i.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`👥 Edit Permissions: <@&${selectedTargetId}>`)
                .setDescription('Select all events you want to whitelist for this role. Deselecting all will remove them from whitelist.')
                .setColor('#336699')
            ],
            components: [actionRow, backButton]
          });
        }

        if (i.customId === 'an_toggle_events') {
          const selectedEvents = i.values;
          const configKey = selectedType === 'user' ? 'whitelistedUsers' : 'whitelistedRoles';
          
          if (selectedEvents.includes('all')) {
            currentConfig.antinuke[configKey][selectedTargetId] = true;
          } else {
            currentConfig.antinuke[configKey][selectedTargetId] = selectedEvents;
          }

          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();

          return await i.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ Permissions Updated')
                .setDescription(`Successfully updated events whitelist perms for ${selectedType === 'user' ? `<@${selectedTargetId}>` : `<@&${selectedTargetId}>`}.`)
                .setColor('#57F287')
            ],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('an_back_to_main').setLabel('Return to Panel').setStyle(ButtonStyle.Success)
              )
            ]
          });
        }

        if (i.customId === 'an_back_to_main') {
          await i.deferUpdate();
          return await i.editReply({
            embeds: [generatePanelEmbed(currentConfig)],
            components: [rowButtons, rowUserSelect, rowRoleSelect]
          });
        }

      } catch (err) {
        logger.error('Collector interaction error in Anti-Nuke panel:', err);
      }
    });

    collector.on('end', () => {
      response.edit({ components: [] }).catch(() => null);
    });
  }
};
