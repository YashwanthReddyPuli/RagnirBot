import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../services/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ACTIONS_CHOICES = [
  { name: 'Delete Message Only', value: 'delete' },
  { name: 'Delete & Warn User', value: 'warn' },
  { name: 'Delete & Timeout (10m)', value: 'timeout' },
  { name: 'Log Alert Only', value: 'none' }
];

export default {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure and manage Auto-Moderation settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcmd =>
      subcmd.setName('config').setDescription('Display the current AutoMod settings')
    )
    .addSubcommand(subcmd =>
      subcmd.setName('toggle')
        .setDescription('Enable or disable AutoMod globally')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Enable AutoMod globally').setRequired(true)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('filter-invite')
        .setDescription('Configure invite links filter')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Enable invite links filter').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action to take').setRequired(true)
            .addChoices(...ACTIONS_CHOICES)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('filter-link')
        .setDescription('Configure external links filter')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Enable links filter').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action to take').setRequired(true)
            .addChoices(...ACTIONS_CHOICES)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('filter-words')
        .setDescription('Configure prohibited words filter')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Enable word filter').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action to take').setRequired(true)
            .addChoices(...ACTIONS_CHOICES)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('blacklist-word')
        .setDescription('Add or remove prohibited words')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action (add/remove)').setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
        )
        .addStringOption(opt =>
          opt.setName('word').setDescription('Word to add/remove').setRequired(true)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('filter-mentions')
        .setDescription('Configure mass mention limits')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Enable mentions limit').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('limit').setDescription('Max mentions allowed per message').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action to take').setRequired(true)
            .addChoices(...ACTIONS_CHOICES)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('filter-spam')
        .setDescription('Configure anti-spam rate limits')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Enable anti-spam').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('limit').setDescription('Max messages allowed').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('timeframe_ms').setDescription('Timeframe in milliseconds (e.g. 5000)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action to take').setRequired(true)
            .addChoices(...ACTIONS_CHOICES)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('whitelist-channel')
        .setDescription('Manage whitelisted channels exempt from AutoMod')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action (add/remove)').setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
        )
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Target channel').setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('whitelist-role')
        .setDescription('Manage whitelisted roles exempt from AutoMod')
        .addStringOption(opt =>
          opt.setName('action').setDescription('Action (add/remove)').setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
        )
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Target role').setRequired(true)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('panel').setDescription('Open the interactive AutoMod Control Panel')
    )
    .addSubcommand(subcmd =>
      subcmd.setName('logging')
        .setDescription('Set the channel for AutoMod logs')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Log channel').setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    ),

  category: 'Moderation',

  async execute(interaction, config, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // Load or initialize config
    let guildConfig = await getGuildConfig(client, guildId);
    if (!guildConfig.automod) {
      guildConfig.automod = {
        enabled: false,
        logChannelId: null,
        ignoredChannels: [],
        ignoredRoles: [],
        invite: { enabled: false, actions: ['delete'] },
        link: { enabled: false, actions: ['delete'] },
        words: { enabled: false, actions: ['delete'], list: [] },
        mentions: { enabled: false, limit: 5, actions: ['delete'] },
        spam: { enabled: false, limit: 5, timeframe: 5000, actions: ['delete', 'timeout'] }
      };
    }

    try {
      if (subcommand === 'config') {
        const am = guildConfig.automod;
        const status = am.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
        const logChannel = am.logChannelId ? `<#${am.logChannelId}>` : '`Global Log Channel`';

        const getActionsText = (settings) => {
          const acts = settings.actions || (settings.action ? [settings.action] : []);
          return acts.length > 0 ? acts.map(a => `\`${a}\``).join(', ') : '`none`';
        };

        const embed = new EmbedBuilder()
          .setTitle('🛡️ AutoMod Configuration Status')
          .setColor('#336699')
          .addFields(
            { name: 'Global State', value: status, inline: true },
            { name: 'Logs Channel', value: logChannel, inline: true },
            { 
              name: 'Invite Filter', 
              value: `State: ${am.invite.enabled ? '🟢' : '🔴'}\nActions: ${getActionsText(am.invite)}`, 
              inline: false 
            },
            { 
              name: 'Links Filter', 
              value: `State: ${am.link.enabled ? '🟢' : '🔴'}\nActions: ${getActionsText(am.link)}`, 
              inline: false 
            },
            { 
              name: 'Word Blacklist', 
              value: `State: ${am.words.enabled ? '🟢' : '🔴'}\nActions: ${getActionsText(am.words)}\nWords: \`${am.words.list?.length || 0} loaded\``, 
              inline: false 
            },
            { 
              name: 'Mentions Limit', 
              value: `State: ${am.mentions.enabled ? '🟢' : '🔴'}\nLimit: \`${am.mentions.limit} pings\`\nActions: ${getActionsText(am.mentions)}`, 
              inline: false 
            },
            { 
              name: 'Anti-Spam Rate', 
              value: `State: ${am.spam.enabled ? '🟢' : '🔴'}\nThreshold: \`${am.spam.limit} msgs / ${am.spam.timeframe}ms\`\nActions: ${getActionsText(am.spam)}`, 
              inline: false 
            }
          )
          .setTimestamp();

        let chanList = am.ignoredChannels?.map(id => `<#${id}>`).join(', ') || 'None';
        let roleList = am.ignoredRoles?.map(id => `<@&${id}>`).join(', ') || 'None';
        embed.addFields(
          { name: 'Whitelisted Channels', value: chanList, inline: false },
          { name: 'Whitelisted Roles', value: roleList, inline: false }
        );

        return await InteractionHelper.universalReply(interaction, { embeds: [embed] });
      }

      if (subcommand === 'logging') {
        const channel = interaction.options.getChannel('channel');
        guildConfig.automod.logChannelId = channel.id;
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('⚙️ AutoMod Logs Channel Set', `AutoMod alerts will now be logged to ${channel}.`)]
        });
      }

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled');
        guildConfig.automod.enabled = enabled;
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('⚙️ AutoMod Toggled', `AutoMod has been globally **${enabled ? 'enabled' : 'disabled'}**.`)]
        });
      }

      if (subcommand === 'filter-invite') {
        const enabled = interaction.options.getBoolean('enabled');
        const action = interaction.options.getString('action');
        guildConfig.automod.invite = { enabled, action };
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('⚙️ Invite Filter Updated', `Invite filter is now **${enabled ? 'enabled' : 'disabled'}** (Action: \`${action}\`).`)]
        });
      }

      if (subcommand === 'filter-link') {
        const enabled = interaction.options.getBoolean('enabled');
        const action = interaction.options.getString('action');
        guildConfig.automod.link = { enabled, action };
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('⚙️ Link Filter Updated', `Links filter is now **${enabled ? 'enabled' : 'disabled'}** (Action: \`${action}\`).`)]
        });
      }

      if (subcommand === 'filter-words') {
        const enabled = interaction.options.getBoolean('enabled');
        const action = interaction.options.getString('action');
        guildConfig.automod.words.enabled = enabled;
        guildConfig.automod.words.action = action;
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('⚙️ Prohibited Words Updated', `Words filter is now **${enabled ? 'enabled' : 'disabled'}** (Action: \`${action}\`).`)]
        });
      }

      if (subcommand === 'blacklist-word') {
        const action = interaction.options.getString('action');
        const word = interaction.options.getString('word').trim().toLowerCase();
        if (!guildConfig.automod.words.list) guildConfig.automod.words.list = [];

        if (action === 'add') {
          if (guildConfig.automod.words.list.includes(word)) {
            return await InteractionHelper.universalReply(interaction, {
              embeds: [errorEmbed('❌ Word Exists', `**${word}** is already blacklisted.`)]
            });
          }
          guildConfig.automod.words.list.push(word);
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('📝 Word Blacklisted', `Added **${word}** to the blacklist.`)]
          });
        } else {
          if (!guildConfig.automod.words.list.includes(word)) {
            return await InteractionHelper.universalReply(interaction, {
              embeds: [errorEmbed('❌ Word Not Found', `**${word}** is not in the blacklist.`)]
            });
          }
          guildConfig.automod.words.list = guildConfig.automod.words.list.filter(w => w !== word);
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('📝 Word Removed', `Removed **${word}** from the blacklist.`)]
          });
        }
      }

      if (subcommand === 'filter-mentions') {
        const enabled = interaction.options.getBoolean('enabled');
        const limit = interaction.options.getInteger('limit');
        const action = interaction.options.getString('action');
        guildConfig.automod.mentions = { enabled, limit, action };
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('⚙️ Mentions Filter Updated', `Mass mentions limit is now **${enabled ? 'enabled' : 'disabled'}** at limit \`${limit}\` (Action: \`${action}\`).`)]
        });
      }

      if (subcommand === 'filter-spam') {
        const enabled = interaction.options.getBoolean('enabled');
        const limit = interaction.options.getInteger('limit');
        const timeframe = interaction.options.getInteger('timeframe_ms');
        const action = interaction.options.getString('action');
        guildConfig.automod.spam = { enabled, limit, timeframe, action };
        await setGuildConfig(client, guildId, guildConfig);
        return await InteractionHelper.universalReply(interaction, {
          embeds: [successEmbed('⚙️ Anti-Spam Updated', `Anti-spam is now **${enabled ? 'enabled' : 'disabled'}** (Limit: \`${limit} msgs / ${timeframe}ms\`, Action: \`${action}\`).`)]
        });
      }

      if (subcommand === 'whitelist-channel') {
        const action = interaction.options.getString('action');
        const channel = interaction.options.getChannel('channel');

        if (action === 'add') {
          if (guildConfig.automod.ignoredChannels.includes(channel.id)) {
            return await InteractionHelper.universalReply(interaction, {
              embeds: [errorEmbed('❌ Already Whitelisted', `${channel} is already whitelisted.`)]
            });
          }
          guildConfig.automod.ignoredChannels.push(channel.id);
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('⚙️ Channel Whitelisted', `Whitelisted ${channel} from AutoMod scans.`)]
          });
        } else {
          if (!guildConfig.automod.ignoredChannels.includes(channel.id)) {
            return await InteractionHelper.universalReply(interaction, {
              embeds: [errorEmbed('❌ Not Whitelisted', `${channel} is not whitelisted.`)]
            });
          }
          guildConfig.automod.ignoredChannels = guildConfig.automod.ignoredChannels.filter(id => id !== channel.id);
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('⚙️ Channel Removed', `Removed ${channel} from whitelisted channels.`)]
          });
        }
      }

      if (subcommand === 'whitelist-role') {
        const action = interaction.options.getString('action');
        const role = interaction.options.getRole('role');

        if (action === 'add') {
          if (guildConfig.automod.ignoredRoles.includes(role.id)) {
            return await InteractionHelper.universalReply(interaction, {
              embeds: [errorEmbed('❌ Already Whitelisted', `Role **${role.name}** is already whitelisted.`)]
            });
          }
          guildConfig.automod.ignoredRoles.push(role.id);
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('⚙️ Role Whitelisted', `Whitelisted role **${role.name}** from AutoMod scans.`)]
          });
        } else {
          if (!guildConfig.automod.ignoredRoles.includes(role.id)) {
            return await InteractionHelper.universalReply(interaction, {
              embeds: [errorEmbed('❌ Not Whitelisted', `Role **${role.name}** is not whitelisted.`)]
            });
          }
          guildConfig.automod.ignoredRoles = guildConfig.automod.ignoredRoles.filter(id => id !== role.id);
          await setGuildConfig(client, guildId, guildConfig);
          return await InteractionHelper.universalReply(interaction, {
            embeds: [successEmbed('⚙️ Role Removed', `Removed role **${role.name}** from whitelisted roles.`)]
          });
        }
      }

      if (subcommand === 'panel') {
        return await this.sendPanel(interaction, guildConfig, client);
      }

    } catch (err) {
      logger.error('Error in automod command execution:', err);
      return await InteractionHelper.universalReply(interaction, {
        embeds: [errorEmbed('An error occurred while running the AutoMod configuration.')]
      });
    }
  },

  async sendPanel(interaction, guildConfig, client) {
    const generateMainEmbed = (config) => {
      const am = config.automod;
      const status = am.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
      const logChannel = am.logChannelId ? `<#${am.logChannelId}>` : '`Global Log Channel`';

      const getActionsText = (settings) => {
        const acts = settings.actions || (settings.action ? [settings.action] : []);
        return acts.length > 0 ? acts.map(a => `\`${a}\``).join(', ') : '`none`';
      };

      return new EmbedBuilder()
        .setTitle('🛡️ AutoMod Control Panel')
        .setDescription('Manage your server auto-moderation filters, rules, action punishments, and whitelists directly below.')
        .setColor('#336699')
        .addFields(
          { name: 'Global State', value: status, inline: true },
          { name: 'Logs Channel', value: logChannel, inline: true },
          { 
            name: 'Invite Filter', 
            value: `State: ${am.invite.enabled ? '🟢' : '🔴'}\nActions: ${getActionsText(am.invite)}`, 
            inline: false 
          },
          { 
            name: 'Links Filter', 
            value: `State: ${am.link.enabled ? '🟢' : '🔴'}\nActions: ${getActionsText(am.link)}`, 
            inline: false 
          },
          { 
            name: 'Word Blacklist', 
            value: `State: ${am.words.enabled ? '🟢' : '🔴'}\nActions: ${getActionsText(am.words)}\nWords: \`${am.words.list?.length || 0} loaded\``, 
            inline: false 
          },
          { 
            name: 'Mentions Limit', 
            value: `State: ${am.mentions.enabled ? '🟢' : '🔴'}\nLimit: \`${am.mentions.limit} pings\`\nActions: ${getActionsText(am.mentions)}`, 
            inline: false 
          },
          { 
            name: 'Anti-Spam Rate', 
            value: `State: ${am.spam.enabled ? '🟢' : '🔴'}\nThreshold: \`${am.spam.limit} msgs / ${am.spam.timeframe}ms\`\nActions: ${getActionsText(am.spam)}`, 
            inline: false 
          }
        )
        .setTimestamp();
    };

    const mainRowButtons = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('am_toggle_state')
        .setLabel(guildConfig.automod.enabled ? 'Disable AutoMod' : 'Enable AutoMod')
        .setStyle(guildConfig.automod.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('am_refresh')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
    );

    const mainRowSelect = () => new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('am_select_filter')
        .setPlaceholder('Select a filter to configure...')
        .addOptions([
          { label: 'Invite Links Filter', value: 'invite', description: 'Block discord server invite links' },
          { label: 'External Links Filter', value: 'link', description: 'Block all external hyperlinks' },
          { label: 'Prohibited Words Filter', value: 'words', description: 'Censor banned words' },
          { label: 'Mass Mentions Filter', value: 'mentions', description: 'Limit maximum mentions in a message' },
          { label: 'Anti-Spam Filter', value: 'spam', description: 'Rate limit message frequency' },
          { label: 'Bypass Whitelists', value: 'whitelist', description: 'Ignored channels and roles' }
        ])
    );

    const generateFilterEmbed = (config, filterName) => {
      const am = config.automod;
      const settings = am[filterName];
      const filterTitles = {
        invite: 'Invite Links Filter',
        link: 'External Links Filter',
        words: 'Prohibited Words Filter',
        mentions: 'Mass Mentions Filter',
        spam: 'Anti-Spam Filter'
      };

      const getActionsText = (s) => {
        const acts = s.actions || (s.action ? [s.action] : []);
        return acts.length > 0 ? acts.map(a => `\`${a}\``).join(', ') : '`none (log alert only)`';
      };

      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configure: ${filterTitles[filterName]}`)
        .setColor('#336699')
        .addFields(
          { name: 'Status', value: settings.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**', inline: true },
          { name: 'Punishments (Multiple Allowed)', value: getActionsText(settings), inline: true }
        );

      if (filterName === 'words') {
        embed.addFields({ name: 'Loaded Words', value: `\`${settings.list?.length || 0}\` words blacklisted. Manage via \`/automod blacklist-word\`.`, inline: false });
      } else if (filterName === 'mentions') {
        embed.addFields({ name: 'Mention Limit', value: `\`${settings.limit}\` maximum user/role mentions per message.`, inline: false });
      } else if (filterName === 'spam') {
        embed.addFields(
          { name: 'Spam Limit', value: `\`${settings.limit}\` messages allowed`, inline: true },
          { name: 'Timeframe', value: `\`${settings.timeframe}ms\``, inline: true }
        );
      }

      return embed;
    };

    const filterRowButtons = (filterName, isEnabled) => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`am_toggle_filter_${filterName}`)
        .setLabel(isEnabled ? 'Disable Filter' : 'Enable Filter')
        .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('am_back_to_main')
        .setLabel('Back to Main')
        .setStyle(ButtonStyle.Secondary)
    );

    const filterRowActionSelect = (filterName, currentActions) => {
      const acts = currentActions || [];
      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`am_action_filter_${filterName}`)
          .setPlaceholder('Choose punishment actions (Custom Combo)...')
          .setMinValues(0)
          .setMaxValues(3)
          .addOptions([
            { label: 'Delete Message', value: 'delete', description: 'Deletes the triggering message', default: acts.includes('delete') },
            { label: 'Warn User', value: 'warn', description: 'Gives the user an official warning', default: acts.includes('warn') },
            { label: 'Timeout User (10m)', value: 'timeout', description: 'Mutes the user for 10 minutes', default: acts.includes('timeout') }
          ])
      );
    };

    const generateWhitelistEmbed = (config) => {
      const am = config.automod;
      const chanList = am.ignoredChannels?.map(id => `<#${id}>`).join(', ') || 'None';
      const roleList = am.ignoredRoles?.map(id => `<@&${id}>`).join(', ') || 'None';

      return new EmbedBuilder()
        .setTitle('🛡️ AutoMod Exemptions & Whitelists')
        .setDescription('Channels and roles selected below are ignored by all AutoMod scanning rules.')
        .setColor('#336699')
        .addFields(
          { name: 'Whitelisted Channels', value: chanList, inline: false },
          { name: 'Whitelisted Roles', value: roleList, inline: false }
        )
        .setTimestamp();
    };

    const response = await (interaction.deferred || interaction.replied
      ? interaction.editReply({
          embeds: [generateMainEmbed(guildConfig)],
          components: [mainRowButtons(), mainRowSelect()],
          fetchReply: true
        })
      : interaction.reply({
          embeds: [generateMainEmbed(guildConfig)],
          components: [mainRowButtons(), mainRowSelect()],
          fetchReply: true
        })
    );

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 180000
    });

    let currentFilterView = null; // null for main, or 'invite', 'link', 'words', 'mentions', 'spam', 'whitelist'

    collector.on('collect', async (i) => {
      try {
        let currentConfig = await getGuildConfig(client, interaction.guild.id);

        if (i.customId === 'am_toggle_state') {
          currentConfig.automod.enabled = !currentConfig.automod.enabled;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;
          return await i.editReply({
            embeds: [generateMainEmbed(currentConfig)],
            components: [mainRowButtons(), mainRowSelect()]
          });
        }

        if (i.customId === 'am_refresh') {
          await i.deferUpdate();
          guildConfig = currentConfig;
          if (currentFilterView === 'whitelist') {
            return await i.editReply({
              embeds: [generateWhitelistEmbed(currentConfig)],
              components: [
                new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('am_whitelist_channel').setPlaceholder('Toggle whitelisted channel...')),
                new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('am_whitelist_role').setPlaceholder('Toggle whitelisted role...')),
                new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary))
              ]
            });
          } else if (currentFilterView && currentFilterView !== 'whitelist') {
            const isEnabled = currentConfig.automod[currentFilterView].enabled;
            const currentActions = currentConfig.automod[currentFilterView].actions || (currentConfig.automod[currentFilterView].action ? [currentConfig.automod[currentFilterView].action] : []);
            const components = [
              filterRowButtons(currentFilterView, isEnabled),
              filterRowActionSelect(currentFilterView, currentActions)
            ];
            return await i.editReply({
              embeds: [generateFilterEmbed(currentConfig, currentFilterView)],
              components
            });
          } else {
            return await i.editReply({
              embeds: [generateMainEmbed(currentConfig)],
              components: [mainRowButtons(), mainRowSelect()]
            });
          }
        }

        if (i.customId === 'am_back_to_main') {
          currentFilterView = null;
          await i.deferUpdate();
          guildConfig = currentConfig;
          return await i.editReply({
            embeds: [generateMainEmbed(currentConfig)],
            components: [mainRowButtons(), mainRowSelect()]
          });
        }

        if (i.customId === 'am_select_filter') {
          const val = i.values[0];
          currentFilterView = val;
          await i.deferUpdate();
          guildConfig = currentConfig;

          if (val === 'whitelist') {
            return await i.editReply({
              embeds: [generateWhitelistEmbed(currentConfig)],
              components: [
                new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('am_whitelist_channel').setPlaceholder('Toggle whitelisted channel...')),
                new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('am_whitelist_role').setPlaceholder('Toggle whitelisted role...')),
                new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary))
              ]
            });
          } else {
            const isEnabled = currentConfig.automod[val].enabled;
            const currentActions = currentConfig.automod[val].actions || (currentConfig.automod[val].action ? [currentConfig.automod[val].action] : []);
            const components = [
              filterRowButtons(val, isEnabled),
              filterRowActionSelect(val, currentActions)
            ];

            if (val === 'mentions') {
              // Add limits select row
              components.push(
                new ActionRowBuilder().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId('am_limit_filter_mentions')
                    .setPlaceholder('Set maximum mention limit...')
                    .addOptions([3, 5, 8, 10, 15, 20].map(limit => ({
                      label: `${limit} mentions`,
                      value: String(limit),
                      default: currentConfig.automod.mentions.limit === limit
                    })))
                )
              );
            } else if (val === 'spam') {
              // Add limit and timeframe select rows
              components.push(
                new ActionRowBuilder().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId('am_limit_filter_spam')
                    .setPlaceholder('Set spam threshold messages...')
                    .addOptions([3, 5, 7, 10, 15].map(limit => ({
                      label: `${limit} messages`,
                      value: String(limit),
                      default: currentConfig.automod.spam.limit === limit
                    })))
                ),
                new ActionRowBuilder().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId('am_timeframe_filter_spam')
                    .setPlaceholder('Set timeframe limit...')
                    .addOptions([
                      { label: '2 seconds', value: '2000' },
                      { label: '3 seconds', value: '3000' },
                      { label: '5 seconds', value: '5000' },
                      { label: '10 seconds', value: '10000' }
                    ].map(t => ({
                      ...t,
                      default: currentConfig.automod.spam.timeframe === parseInt(t.value)
                    })))
                )
              );
            }

            return await i.editReply({
              embeds: [generateFilterEmbed(currentConfig, val)],
              components
            });
          }
        }

        // Handle Sub-toggles
        if (i.customId.startsWith('am_toggle_filter_')) {
          const filter = i.customId.replace('am_toggle_filter_', '');
          currentConfig.automod[filter].enabled = !currentConfig.automod[filter].enabled;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          const isEnabled = currentConfig.automod[filter].enabled;
          const currentActions = currentConfig.automod[filter].actions || (currentConfig.automod[filter].action ? [currentConfig.automod[filter].action] : []);
          const components = [
            filterRowButtons(filter, isEnabled),
            filterRowActionSelect(filter, currentActions)
          ];

          if (filter === 'mentions') {
            components.push(
              new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId('am_limit_filter_mentions')
                  .setPlaceholder('Set maximum mention limit...')
                  .addOptions([3, 5, 8, 10, 15, 20].map(limit => ({
                    label: `${limit} mentions`,
                    value: String(limit),
                    default: currentConfig.automod.mentions.limit === limit
                  })))
              )
            );
          } else if (filter === 'spam') {
            components.push(
              new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId('am_limit_filter_spam')
                  .setPlaceholder('Set spam threshold messages...')
                  .addOptions([3, 5, 7, 10, 15].map(limit => ({
                    label: `${limit} messages`,
                    value: String(limit),
                    default: currentConfig.automod.spam.limit === limit
                  })))
              ),
              new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId('am_timeframe_filter_spam')
                  .setPlaceholder('Set timeframe limit...')
                  .addOptions([
                    { label: '2 seconds', value: '2000' },
                    { label: '3 seconds', value: '3000' },
                    { label: '5 seconds', value: '5000' },
                    { label: '10 seconds', value: '10000' }
                  ].map(t => ({
                    ...t,
                    default: currentConfig.automod.spam.timeframe === parseInt(t.value)
                  })))
              )
            );
          }

          return await i.editReply({
            embeds: [generateFilterEmbed(currentConfig, filter)],
            components
          });
        }

        // Handle Action Change Selects (Supports choosing custom combinations)
        if (i.customId.startsWith('am_action_filter_')) {
          const filter = i.customId.replace('am_action_filter_', '');
          const selectedActions = i.values; // this is an array of strings
          currentConfig.automod[filter].actions = selectedActions;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          const isEnabled = currentConfig.automod[filter].enabled;
          const components = [
            filterRowButtons(filter, isEnabled),
            filterRowActionSelect(filter, selectedActions)
          ];

          if (filter === 'mentions') {
            components.push(
              new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId('am_limit_filter_mentions')
                  .setPlaceholder('Set maximum mention limit...')
                  .addOptions([3, 5, 8, 10, 15, 20].map(limit => ({
                    label: `${limit} mentions`,
                    value: String(limit),
                    default: currentConfig.automod.mentions.limit === limit
                  })))
              )
            );
          } else if (filter === 'spam') {
            components.push(
              new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId('am_limit_filter_spam')
                  .setPlaceholder('Set spam threshold messages...')
                  .addOptions([3, 5, 7, 10, 15].map(limit => ({
                    label: `${limit} messages`,
                    value: String(limit),
                    default: currentConfig.automod.spam.limit === limit
                  })))
              ),
              new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId('am_timeframe_filter_spam')
                  .setPlaceholder('Set timeframe limit...')
                  .addOptions([
                    { label: '2 seconds', value: '2000' },
                    { label: '3 seconds', value: '3000' },
                    { label: '5 seconds', value: '5000' },
                    { label: '10 seconds', value: '10000' }
                  ].map(t => ({
                    ...t,
                    default: currentConfig.automod.spam.timeframe === parseInt(t.value)
                  })))
              )
            );
          }

          return await i.editReply({
            embeds: [generateFilterEmbed(currentConfig, filter)],
            components
          });
        }

        // Handle Limit for Mentions
        if (i.customId === 'am_limit_filter_mentions') {
          const limit = parseInt(i.values[0]);
          currentConfig.automod.mentions.limit = limit;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          const isEnabled = currentConfig.automod.mentions.enabled;
          const currentActions = currentConfig.automod.mentions.actions || (currentConfig.automod.mentions.action ? [currentConfig.automod.mentions.action] : []);
          const components = [
            filterRowButtons('mentions', isEnabled),
            filterRowActionSelect('mentions', currentActions),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('am_limit_filter_mentions')
                .setPlaceholder('Set maximum mention limit...')
                .addOptions([3, 5, 8, 10, 15, 20].map(l => ({
                  label: `${l} mentions`,
                  value: String(l),
                  default: l === limit
                })))
            )
          ];

          return await i.editReply({
            embeds: [generateFilterEmbed(currentConfig, 'mentions')],
            components
          });
        }

        // Handle Limit for Spam
        if (i.customId === 'am_limit_filter_spam') {
          const limit = parseInt(i.values[0]);
          currentConfig.automod.spam.limit = limit;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          const isEnabled = currentConfig.automod.spam.enabled;
          const currentActions = currentConfig.automod.spam.actions || (currentConfig.automod.spam.action ? [currentConfig.automod.spam.action] : []);
          const components = [
            filterRowButtons('spam', isEnabled),
            filterRowActionSelect('spam', currentActions),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('am_limit_filter_spam')
                .setPlaceholder('Set spam threshold messages...')
                .addOptions([3, 5, 7, 10, 15].map(l => ({
                  label: `${l} messages`,
                  value: String(l),
                  default: l === limit
                })))
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('am_timeframe_filter_spam')
                .setPlaceholder('Set timeframe limit...')
                .addOptions([
                  { label: '2 seconds', value: '2000' },
                  { label: '3 seconds', value: '3000' },
                  { label: '5 seconds', value: '5000' },
                  { label: '10 seconds', value: '10000' }
                ].map(t => ({
                  ...t,
                  default: currentConfig.automod.spam.timeframe === parseInt(t.value)
                })))
            )
          ];

          return await i.editReply({
            embeds: [generateFilterEmbed(currentConfig, 'spam')],
            components
          });
        }

        // Handle Timeframe for Spam
        if (i.customId === 'am_timeframe_filter_spam') {
          const timeframe = parseInt(i.values[0]);
          currentConfig.automod.spam.timeframe = timeframe;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          const isEnabled = currentConfig.automod.spam.enabled;
          const currentActions = currentConfig.automod.spam.actions || (currentConfig.automod.spam.action ? [currentConfig.automod.spam.action] : []);
          const components = [
            filterRowButtons('spam', isEnabled),
            filterRowActionSelect('spam', currentActions),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('am_limit_filter_spam')
                .setPlaceholder('Set spam threshold messages...')
                .addOptions([3, 5, 7, 10, 15].map(l => ({
                  label: `${l} messages`,
                  value: String(l),
                  default: l === currentConfig.automod.spam.limit
                })))
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('am_timeframe_filter_spam')
                .setPlaceholder('Set timeframe limit...')
                .addOptions([
                  { label: '2 seconds', value: '2000' },
                  { label: '3 seconds', value: '3000' },
                  { label: '5 seconds', value: '5000' },
                  { label: '10 seconds', value: '10000' }
                ].map(t => ({
                  ...t,
                  default: parseInt(t.value) === timeframe
                })))
            )
          ];

          return await i.editReply({
            embeds: [generateFilterEmbed(currentConfig, 'spam')],
            components
          });
        }

        // Whitelist Channel Toggle
        if (i.customId === 'am_whitelist_channel') {
          const channelId = i.values[0];
          if (currentConfig.automod.ignoredChannels.includes(channelId)) {
            currentConfig.automod.ignoredChannels = currentConfig.automod.ignoredChannels.filter(id => id !== channelId);
          } else {
            currentConfig.automod.ignoredChannels.push(channelId);
          }
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          return await i.editReply({
            embeds: [generateWhitelistEmbed(currentConfig)],
            components: [
              new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('am_whitelist_channel').setPlaceholder('Toggle whitelisted channel...')),
              new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('am_whitelist_role').setPlaceholder('Toggle whitelisted role...')),
              new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary))
            ]
          });
        }

        // Whitelist Role Toggle
        if (i.customId === 'am_whitelist_role') {
          const roleId = i.values[0];
          if (currentConfig.automod.ignoredRoles.includes(roleId)) {
            currentConfig.automod.ignoredRoles = currentConfig.automod.ignoredRoles.filter(id => id !== roleId);
          } else {
            currentConfig.automod.ignoredRoles.push(roleId);
          }
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          return await i.editReply({
            embeds: [generateWhitelistEmbed(currentConfig)],
            components: [
              new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('am_whitelist_channel').setPlaceholder('Toggle whitelisted channel...')),
              new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('am_whitelist_role').setPlaceholder('Toggle whitelisted role...')),
              new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary))
            ]
          });
        }

      } catch (err) {
        logger.error('Collector interaction error in AutoMod panel:', err);
      }
    });

    collector.on('end', () => {
      response.edit({ components: [] }).catch(() => null);
    });
  }
};

