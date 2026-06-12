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
      subcmd.setName('logging').setDescription('Set the channel for AutoMod logs')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Log channel').setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('stats').setDescription('Display AutoMod moderation statistics')
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

      if (subcommand === 'stats') {
        const statsKey = `moderation:automod_stats:${guildId}`;
        const stats = await import('../../utils/database.js').then(db => db.getFromDb(statsKey, {}));
        const total = stats.total || 0;
        const invite = stats.invite || 0;
        const link = stats.link || 0;
        const words = stats.words || 0;
        const mentions = stats.mentions || 0;
        const spam = stats.spam || 0;

        const embed = new EmbedBuilder()
          .setTitle('🛡️ AutoMod Incident Statistics')
          .setDescription('Real-time statistics of message violations blocked and moderated by RagnirBot AutoMod.')
          .setColor('#1E90FF')
          .addFields(
            { name: 'Total Incidents Blocked', value: `📈 **${total}**`, inline: false },
            { name: 'Invite Link Triggers', value: `🔗 \`${invite}\` times`, inline: true },
            { name: 'External Link Triggers', value: `🌐 \`${link}\` times`, inline: true },
            { name: 'Banned Word Triggers', value: `🔤 \`${words}\` times`, inline: true },
            { name: 'Mass Mention Triggers', value: `👥 \`${mentions}\` times`, inline: true },
            { name: 'Spam Rate Triggers', value: `⚡ \`${spam}\` times`, inline: true }
          )
          .setFooter({ text: 'AutoMod Protection active' })
          .setTimestamp();

        return await InteractionHelper.universalReply(interaction, { embeds: [embed] });
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
      const timeoutVal = am.timeoutDuration || 600000;
      const esc = am.escalation || { enabled: false, rules: [] };
      const escStatus = esc.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';

      const getActionsText = (settings) => {
        const acts = settings.actions || (settings.action ? [settings.action] : []);
        return acts.length > 0 ? acts.map(a => `\`${a}\``).join(', ') : '`none`';
      };

      const embed = new EmbedBuilder()
        .setTitle('🛡️ AutoMod Control Panel')
        .setDescription('Manage your server auto-moderation filters, rules, action punishments, and whitelists directly below.')
        .setColor('#336699')
        .addFields(
          { name: 'Global State', value: status, inline: true },
          { name: 'Logs Channel', value: logChannel, inline: true },
          { name: 'Timeout Duration', value: `\`${timeoutVal / 60000}m\``, inline: true },
          { name: 'Warning Escalation', value: escStatus, inline: true },
          { 
            name: 'Invite Filter', 
            value: `State: ${am.invite.enabled ? '🟢' : '🔴'}\nActions: ${getActionsText(am.invite)}`, 
            inline: false 
          },
          { 
            name: 'Links Filter', 
            value: `State: ${am.link.enabled ? '🟢' : '🔴'}\nActions: ${getActionsText(am.link)}\nWhitelist: \`${am.link.whitelist?.length || 0}\` | Blacklist: \`${am.link.blacklist?.length || 0}\``, 
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
      return embed;
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
          { label: 'Warning Escalation Config', value: 'escalation', description: 'Configure warning threshold rules' },
          { label: 'Link Domain Rules', value: 'link_domains', description: 'Configure Whitelisted/Blacklisted Link Domains' },
          { label: 'Bypass Whitelists', value: 'whitelist', description: 'Ignored channels and roles' },
          { label: 'Timeout Duration Settings', value: 'timeout_duration', description: 'Set custom mute/timeout length' }
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

      const ignoredChans = settings.ignoredChannels?.map(id => `<#${id}>`).join(', ') || 'None';
      const ignoredRls = settings.ignoredRoles?.map(id => `<@&${id}>`).join(', ') || 'None';

      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configure: ${filterTitles[filterName]}`)
        .setColor('#336699')
        .addFields(
          { name: 'Status', value: settings.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**', inline: true },
          { name: 'Punishments (Multiple Allowed)', value: getActionsText(settings), inline: true },
          { name: 'Filter Ignored Channels', value: ignoredChans, inline: false },
          { name: 'Filter Ignored Roles', value: ignoredRls, inline: false }
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
            { label: 'Timeout User', value: 'timeout', description: 'Mutes the user dynamically', default: acts.includes('timeout') }
          ])
      );
    };

    const filterRowBypassSelects = (filterName) => [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`am_bypass_chan_${filterName}`)
          .setPlaceholder('Toggle Filter Ignored Channel...')
      ),
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(`am_bypass_role_${filterName}`)
          .setPlaceholder('Toggle Filter Ignored Role...')
      )
    ];

    const generateEscalationEmbed = (config) => {
      const esc = config.automod.escalation || { enabled: false, rules: [] };
      const status = esc.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
      
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Warning Escalation Rules')
        .setDescription('Configure automatic punishments when a user reaches specific active warning milestones.')
        .setColor('#8B0000')
        .addFields({ name: 'Escalation Status', value: status, inline: false });

      if (esc.rules && esc.rules.length > 0) {
        const rulesText = esc.rules.map(r => `• **${r.warnCount} Warnings**: \`${r.action.toUpperCase()}\`${r.action === 'timeout' ? ` (${r.durationMs / 60000}m)` : ''}`).join('\n');
        embed.addFields({ name: 'Active Rules', value: rulesText });
      } else {
        embed.addFields({ name: 'Active Rules', value: 'None configured.' });
      }

      return embed;
    };

    const generateLinkDomainsEmbed = (config) => {
      const link = config.automod.link;
      const whitelist = link.whitelist || [];
      const blacklist = link.blacklist || [];

      const wlText = whitelist.length > 0 ? whitelist.map(d => `\`${d}\``).join(', ') : '*No whitelist restrictions configured. All links not blacklisted are allowed.*';
      const blText = blacklist.length > 0 ? blacklist.map(d => `\`${d}\``).join(', ') : '*None.*';

      return new EmbedBuilder()
        .setTitle('🌐 Link Domain Rules')
        .setDescription('Configure safe/whitelisted domains (e.g. `youtube.com`) or custom blacklisted domains.')
        .setColor('#4682B4')
        .addFields(
          { name: 'Whitelisted Domains (Only these domains allowed if list is not empty)', value: wlText },
          { name: 'Blacklisted Domains (Never allowed)', value: blText }
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

    const generateTimeoutDurationEmbed = (config) => {
      const am = config.automod;
      const durationMs = am.timeoutDuration || 600000;
      return new EmbedBuilder()
        .setTitle('⏱️ Configure AutoMod Timeout Length')
        .setDescription('Select how long users should be timed out (muted) when the timeout punishment is triggered.')
        .setColor('#336699')
        .addFields({ name: 'Current Timeout Length', value: `\`${durationMs / 60000} minutes\` (\`${durationMs}ms\`)` })
        .setTimestamp();
    };

    const timeoutDurationRowSelect = (currentDurationMs) => new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('am_set_timeout_duration')
        .setPlaceholder('Select timeout duration...')
        .addOptions([
          { label: '1 minute', value: '60000', default: currentDurationMs === 60000 },
          { label: '5 minutes', value: '300000', default: currentDurationMs === 300000 },
          { label: '10 minutes', value: '600000', default: currentDurationMs === 600000 },
          { label: '30 minutes', value: '1800000', default: currentDurationMs === 1800000 },
          { label: '1 hour', value: '3600000', default: currentDurationMs === 3600000 },
          { label: '6 hours', value: '21600000', default: currentDurationMs === 21600000 },
          { label: '12 hours', value: '43200000', default: currentDurationMs === 43200000 },
          { label: '24 hours', value: '86400000', default: currentDurationMs === 86400000 }
        ])
    );

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

    let currentFilterView = null; // null for main, or 'invite', 'link', 'words', 'mentions', 'spam', 'whitelist', 'timeout_duration', 'escalation', 'link_domains'

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
          } else if (currentFilterView === 'timeout_duration') {
            return await i.editReply({
              embeds: [generateTimeoutDurationEmbed(currentConfig)],
              components: [
                timeoutDurationRowSelect(currentConfig.automod.timeoutDuration || 600000),
                new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary))
              ]
            });
          } else if (currentFilterView === 'escalation') {
            return await i.editReply({
              embeds: [generateEscalationEmbed(currentConfig)],
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('am_toggle_escalation').setLabel(currentConfig.automod.escalation?.enabled ? 'Disable Escalation' : 'Enable Escalation').setStyle(currentConfig.automod.escalation?.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                  new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary)
                )
              ]
            });
          } else if (currentFilterView === 'link_domains') {
            return await i.editReply({
              embeds: [generateLinkDomainsEmbed(currentConfig)],
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('am_add_link_domain').setLabel('Add Domain').setStyle(ButtonStyle.Primary),
                  new ButtonBuilder().setCustomId('am_remove_link_domain').setLabel('Remove Domain').setStyle(ButtonStyle.Danger),
                  new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary)
                )
              ]
            });
          } else if (currentFilterView && currentFilterView !== 'whitelist') {
            const isEnabled = currentConfig.automod[currentFilterView].enabled;
            const currentActions = currentConfig.automod[currentFilterView].actions || (currentConfig.automod[currentFilterView].action ? [currentConfig.automod[currentFilterView].action] : []);
            const components = [
              filterRowButtons(currentFilterView, isEnabled),
              filterRowActionSelect(currentFilterView, currentActions),
              ...filterRowBypassSelects(currentFilterView)
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
          } else if (val === 'timeout_duration') {
            return await i.editReply({
              embeds: [generateTimeoutDurationEmbed(currentConfig)],
              components: [
                timeoutDurationRowSelect(currentConfig.automod.timeoutDuration || 600000),
                new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary))
              ]
            });
          } else if (val === 'escalation') {
            return await i.editReply({
              embeds: [generateEscalationEmbed(currentConfig)],
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('am_toggle_escalation').setLabel(currentConfig.automod.escalation?.enabled ? 'Disable Escalation' : 'Enable Escalation').setStyle(currentConfig.automod.escalation?.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                  new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary)
                )
              ]
            });
          } else if (val === 'link_domains') {
            return await i.editReply({
              embeds: [generateLinkDomainsEmbed(currentConfig)],
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('am_add_link_domain').setLabel('Add Domain').setStyle(ButtonStyle.Primary),
                  new ButtonBuilder().setCustomId('am_remove_link_domain').setLabel('Remove Domain').setStyle(ButtonStyle.Danger),
                  new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary)
                )
              ]
            });
          } else {
            const isEnabled = currentConfig.automod[val].enabled;
            const currentActions = currentConfig.automod[val].actions || (currentConfig.automod[val].action ? [currentConfig.automod[val].action] : []);
            const components = [
              filterRowButtons(val, isEnabled),
              filterRowActionSelect(val, currentActions),
              ...filterRowBypassSelects(val)
            ];

            if (val === 'mentions') {
              // Add limits select row
              components.splice(2, 0,
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
              components.splice(2, 0,
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

        // Handle warning escalation toggling
        if (i.customId === 'am_toggle_escalation') {
          if (!currentConfig.automod.escalation) {
            currentConfig.automod.escalation = {
              enabled: false,
              rules: [
                { warnCount: 3, action: 'timeout', durationMs: 3600000 },
                { warnCount: 5, action: 'kick', durationMs: 0 }
              ]
            };
          }
          currentConfig.automod.escalation.enabled = !currentConfig.automod.escalation.enabled;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;
          return await i.editReply({
            embeds: [generateEscalationEmbed(currentConfig)],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('am_toggle_escalation').setLabel(currentConfig.automod.escalation.enabled ? 'Disable Escalation' : 'Enable Escalation').setStyle(currentConfig.automod.escalation.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary)
              )
            ]
          });
        }

        // Link Domain Configuration Actions
        if (i.customId === 'am_add_link_domain' || i.customId === 'am_remove_link_domain') {
          const isAdd = i.customId === 'am_add_link_domain';
          // Send a modal input response
          const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
          const modal = new ModalBuilder()
            .setCustomId(isAdd ? 'am_modal_add_domain' : 'am_modal_remove_domain')
            .setTitle(isAdd ? 'Add Link Domain Rule' : 'Remove Link Domain Rule');

          const listInput = new TextInputBuilder()
            .setCustomId('domain_list_type')
            .setLabel('List Type (whitelist / blacklist)')
            .setPlaceholder('Type either "whitelist" or "blacklist"')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const domainInput = new TextInputBuilder()
            .setCustomId('domain_name')
            .setLabel('Domain name(s) (comma separated)')
            .setPlaceholder('google.com, youtube.com')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(listInput),
            new ActionRowBuilder().addComponents(domainInput)
          );

          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({
            time: 60000,
            filter: (md) => md.user.id === interaction.user.id
          }).catch(() => null);

          if (submitted) {
            await submitted.deferUpdate();
            const listType = submitted.fields.getTextInputValue('domain_list_type').trim().toLowerCase();
            const domains = submitted.fields.getTextInputValue('domain_name').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

            if (listType === 'whitelist' || listType === 'blacklist') {
              if (!currentConfig.automod.link[listType]) currentConfig.automod.link[listType] = [];
              if (isAdd) {
                for (const d of domains) {
                  if (!currentConfig.automod.link[listType].includes(d)) {
                    currentConfig.automod.link[listType].push(d);
                  }
                }
              } else {
                currentConfig.automod.link[listType] = currentConfig.automod.link[listType].filter(d => !domains.includes(d));
              }
              await setGuildConfig(client, interaction.guild.id, currentConfig);
              guildConfig = currentConfig;
            }

            return await submitted.editReply({
              embeds: [generateLinkDomainsEmbed(currentConfig)],
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('am_add_link_domain').setLabel('Add Domain').setStyle(ButtonStyle.Primary),
                  new ButtonBuilder().setCustomId('am_remove_link_domain').setLabel('Remove Domain').setStyle(ButtonStyle.Danger),
                  new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary)
                )
              ]
            });
          }
          return;
        }

        // Handle Filter Ignored Channels and Roles updates
        if (i.customId.startsWith('am_bypass_chan_')) {
          const filter = i.customId.replace('am_bypass_chan_', '');
          const chanId = i.values[0];
          if (!currentConfig.automod[filter].ignoredChannels) currentConfig.automod[filter].ignoredChannels = [];
          
          if (currentConfig.automod[filter].ignoredChannels.includes(chanId)) {
            currentConfig.automod[filter].ignoredChannels = currentConfig.automod[filter].ignoredChannels.filter(id => id !== chanId);
          } else {
            currentConfig.automod[filter].ignoredChannels.push(chanId);
          }
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          const isEnabled = currentConfig.automod[filter].enabled;
          const currentActions = currentConfig.automod[filter].actions || (currentConfig.automod[filter].action ? [currentConfig.automod[filter].action] : []);
          const components = [
            filterRowButtons(filter, isEnabled),
            filterRowActionSelect(filter, currentActions),
            ...filterRowBypassSelects(filter)
          ];
          return await i.editReply({
            embeds: [generateFilterEmbed(currentConfig, filter)],
            components
          });
        }

        if (i.customId.startsWith('am_bypass_role_')) {
          const filter = i.customId.replace('am_bypass_role_', '');
          const roleId = i.values[0];
          if (!currentConfig.automod[filter].ignoredRoles) currentConfig.automod[filter].ignoredRoles = [];
          
          if (currentConfig.automod[filter].ignoredRoles.includes(roleId)) {
            currentConfig.automod[filter].ignoredRoles = currentConfig.automod[filter].ignoredRoles.filter(id => id !== roleId);
          } else {
            currentConfig.automod[filter].ignoredRoles.push(roleId);
          }
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;

          const isEnabled = currentConfig.automod[filter].enabled;
          const currentActions = currentConfig.automod[filter].actions || (currentConfig.automod[filter].action ? [currentConfig.automod[filter].action] : []);
          const components = [
            filterRowButtons(filter, isEnabled),
            filterRowActionSelect(filter, currentActions),
            ...filterRowBypassSelects(filter)
          ];
          return await i.editReply({
            embeds: [generateFilterEmbed(currentConfig, filter)],
            components
          });
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
            filterRowActionSelect(filter, currentActions),
            ...filterRowBypassSelects(filter)
          ];

          if (filter === 'mentions') {
            components.splice(2, 0,
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
            components.splice(2, 0,
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
            filterRowActionSelect(filter, selectedActions),
            ...filterRowBypassSelects(filter)
          ];

          if (filter === 'mentions') {
            components.splice(2, 0,
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
            components.splice(2, 0,
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
            ),
            ...filterRowBypassSelects('mentions')
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
            ),
            ...filterRowBypassSelects('spam')
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
            ),
            ...filterRowBypassSelects('spam')
          ];

          return await i.editReply({
            embeds: [generateFilterEmbed(currentConfig, 'spam')],
            components
          });
        }

        // Set Timeout Duration Selection
        if (i.customId === 'am_set_timeout_duration') {
          const duration = parseInt(i.values[0]);
          currentConfig.automod.timeoutDuration = duration;
          await setGuildConfig(client, interaction.guild.id, currentConfig);
          await i.deferUpdate();
          guildConfig = currentConfig;
          return await i.editReply({
            embeds: [generateTimeoutDurationEmbed(currentConfig)],
            components: [
              timeoutDurationRowSelect(duration),
              new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Main').setStyle(ButtonStyle.Secondary))
            ]
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

