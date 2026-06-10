import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ChannelType 
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
        ignoredChannels: [],
        ignoredRoles: [],
        invite: { enabled: false, action: 'delete' },
        link: { enabled: false, action: 'delete' },
        words: { enabled: false, action: 'delete', list: [] },
        mentions: { enabled: false, limit: 5, action: 'delete' },
        spam: { enabled: false, limit: 5, timeframe: 5000, action: 'timeout' }
      };
    }

    try {
      if (subcommand === 'config') {
        const am = guildConfig.automod;
        const status = am.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';

        const embed = new EmbedBuilder()
          .setTitle('🛡️ AutoMod Configuration Status')
          .setColor('#336699')
          .addFields(
            { name: 'Global State', value: status, inline: false },
            { 
              name: 'Invite Filter', 
              value: `State: ${am.invite.enabled ? '🟢' : '🔴'}\nAction: \`${am.invite.action}\``, 
              inline: true 
            },
            { 
              name: 'Links Filter', 
              value: `State: ${am.link.enabled ? '🟢' : '🔴'}\nAction: \`${am.link.action}\``, 
              inline: true 
            },
            { 
              name: 'Word Blacklist', 
              value: `State: ${am.words.enabled ? '🟢' : '🔴'}\nAction: \`${am.words.action}\`\nWords: \`${am.words.list?.length || 0} loaded\``, 
              inline: true 
            },
            { 
              name: 'Mentions Limit', 
              value: `State: ${am.mentions.enabled ? '🟢' : '🔴'}\nLimit: \`${am.mentions.limit} pings\`\nAction: \`${am.mentions.action}\``, 
              inline: true 
            },
            { 
              name: 'Anti-Spam Rate', 
              value: `State: ${am.spam.enabled ? '🟢' : '🔴'}\nThreshold: \`${am.spam.limit} msgs / ${am.spam.timeframe}ms\`\nAction: \`${am.spam.action}\``, 
              inline: true 
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

    } catch (err) {
      logger.error('Error in automod command execution:', err);
      return await InteractionHelper.universalReply(interaction, {
        embeds: [errorEmbed('An error occurred while running the AutoMod configuration.')]
      });
    }
  }
};
