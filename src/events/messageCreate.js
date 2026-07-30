




import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling.js';
import { addXp } from '../services/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { AutoModService } from '../services/autoModService.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { InteractionHelper } from '../utils/interactionHelper.js';

class MockInteraction {
  constructor(message, commandName, args) {
    this.message = message;
    this.id = message.id;
    this.guild = message.guild;
    this.guildId = message.guild.id;
    this.channel = message.channel;
    this.user = message.author;
    this.member = message.member;
    this.commandName = commandName;
    this.args = args;
    this.replied = false;
    this.deferred = false;

    this.options = {
      getUser: (name) => {
        const mention = message.mentions.users.first();
        if (mention) return mention;
        const idArg = args[0];
        if (idArg && /^\d+$/.test(idArg)) {
          return message.client.users.cache.get(idArg) || null;
        }
        return null;
      },
      getMember: (name) => {
        const mention = message.mentions.members.first();
        if (mention) return mention;
        const idArg = args[0];
        if (idArg && /^\d+$/.test(idArg)) {
          return message.guild.members.cache.get(idArg) || null;
        }
        return null;
      },
      getRole: (name) => {
        const mention = message.mentions.roles.first();
        if (mention) return mention;
        const idArg = args[0];
        if (idArg && /^\d+$/.test(idArg)) {
          return message.guild.roles.cache.get(idArg) || null;
        }
        return null;
      },
      getChannel: (name) => {
        const mention = message.mentions.channels.first();
        if (mention) return mention;
        const idArg = args[0];
        if (idArg && /^\d+$/.test(idArg)) {
          return message.guild.channels.cache.get(idArg) || null;
        }
        return null;
      },
      getString: (name) => {
        const hasTargetMention = message.mentions.users.size > 0 || message.mentions.roles.size > 0 || message.mentions.channels.size > 0 || (args[0] && /^\d+$/.test(args[0]));
        if (hasTargetMention) {
          return args.slice(1).join(' ') || null;
        }
        return args.join(' ') || null;
      },
      getInteger: (name) => {
        const arg = args.find(a => /^\d+$/.test(a));
        return arg ? parseInt(arg, 10) : null;
      },
      getNumber: (name) => {
        const arg = args.find(a => /^\d+(\.\d+)?$/.test(a));
        return arg ? parseFloat(arg) : null;
      },
      getBoolean: (name) => {
        const val = args.join(' ').toLowerCase();
        if (val.includes('true') || val.includes('yes') || val.includes('enable')) return true;
        if (val.includes('false') || val.includes('no') || val.includes('disable')) return false;
        return null;
      }
    };
  }

  async reply(options) {
    if (this.replied) {
      return await this.followUp(options);
    }
    this.replied = true;
    let payload = typeof options === 'string' ? { content: options } : options;
    if (payload.flags) delete payload.flags;
    this.replyMessage = await this.channel.send(payload);
    return this.replyMessage;
  }

  async editReply(options) {
    let payload = typeof options === 'string' ? { content: options } : options;
    if (payload.flags) delete payload.flags;
    if (this.replyMessage) {
      return await this.replyMessage.edit(payload);
    }
    return await this.reply(payload);
  }

  async deferReply(options) {
    this.deferred = true;
    await this.channel.sendTyping().catch(() => null);
    return true;
  }

  async followUp(options) {
    let payload = typeof options === 'string' ? { content: options } : options;
    if (payload.flags) delete payload.flags;
    return await this.channel.send(payload);
  }
}

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      if (message.author.bot || !message.guild) return;

      const isAutomodded = await AutoModService.processMessage(message, client);
      if (isAutomodded) return;

      // Prefix command handling
      const config = await getGuildConfig(client, message.guild.id);
      const prefix = config?.prefix || ';';
      const noPrefixUsers = config?.noPrefixUsers || [];
      const hasNoPrefix = noPrefixUsers.includes(message.author.id);

      let isCommand = false;
      let commandName = '';
      let args = [];

      if (message.content.startsWith(prefix)) {
        isCommand = true;
        const content = message.content.slice(prefix.length).trim();
        const parts = content.split(/\s+/);
        commandName = parts[0].toLowerCase();
        args = parts.slice(1);
      } else if (hasNoPrefix) {
        const parts = message.content.trim().split(/\s+/);
        const possibleCmd = parts[0].toLowerCase();
        if (client.commands.has(possibleCmd)) {
          isCommand = true;
          commandName = possibleCmd;
          args = parts.slice(1);
        }
      }

      if (isCommand && commandName) {
        const command = client.commands.get(commandName);
        if (command) {
          const mockInteraction = new MockInteraction(message, commandName, args);
          try {
            await command.execute(mockInteraction, config, client);
          } catch (cmdErr) {
            logger.error(`Error executing prefix command ${commandName}:`, cmdErr);
            await message.reply(`❌ **Error executing command:** ${cmdErr.message}`).catch(() => null);
          }
          return; // Stop execution: don't award XP for command usage
        }
      }

      await handleLeveling(message, client);
    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};








async function handleLeveling(message, client) {
  try {
    const rateLimitKey = `xp-event:${message.guild.id}:${message.author.id}`;
    const canProcess = await checkRateLimit(rateLimitKey, MESSAGE_XP_RATE_LIMIT_ATTEMPTS, MESSAGE_XP_RATE_LIMIT_WINDOW_MS);
    if (!canProcess) {
      return;
    }

    const levelingConfig = await getLevelingConfig(client, message.guild.id);
    
    if (!levelingConfig?.enabled) {
      return;
    }

    
    if (levelingConfig.ignoredChannels?.includes(message.channel.id)) {
      return;
    }

    
    if (levelingConfig.ignoredRoles?.length > 0) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => {
        return null;
      });
      if (member && member.roles.cache.some(role => levelingConfig.ignoredRoles.includes(role.id))) {
        return;
      }
    }

    
    if (levelingConfig.blacklistedUsers?.includes(message.author.id)) {
      return;
    }

    
    if (!message.content || message.content.trim().length === 0) {
      return;
    }

    const userData = await getUserLevelData(client, message.guild.id, message.author.id);
    
    
    const cooldownTime = levelingConfig.xpCooldown || 60;
    const now = Date.now();
    const timeSinceLastMessage = now - (userData.lastMessage || 0);
    
    
    if (timeSinceLastMessage < cooldownTime * 1000) {
      return;
    }

    
    const minXP = levelingConfig.xpRange?.min || levelingConfig.xpPerMessage?.min || 15;
    const maxXP = levelingConfig.xpRange?.max || levelingConfig.xpPerMessage?.max || 25;

    
    const safeMinXP = Math.max(1, minXP);
    const safeMaxXP = Math.max(safeMinXP, maxXP);

    
    const xpToGive = Math.floor(Math.random() * (safeMaxXP - safeMinXP + 1)) + safeMinXP;

    
    let finalXP = xpToGive;
    if (levelingConfig.xpMultiplier && levelingConfig.xpMultiplier > 1) {
      finalXP = Math.floor(finalXP * levelingConfig.xpMultiplier);
    }

    
    const result = await addXp(client, message.guild, message.member, finalXP);
    
    if (result.success && result.leveledUp) {
      logger.info(
        `${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`
      );
    }
  } catch (error) {
    logger.error('Error handling leveling for message:', error);
  }
}


