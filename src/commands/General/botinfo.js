import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { BotConfig } from '../../config/bot.js';
import os from 'os';

export default {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Displays detailed information and system status of RagnirBot.'),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

            const totalGuilds = client.guilds.cache.size;
            const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
            
            const memoryUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

            const embed = createEmbed({
                title: `🤖 RagnirBot System Information`,
                description: `Modular Discord server utility bot built for high performance and premium styling.`,
                color: 'primary'
            })
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '👑 Developer', value: `<@${BotConfig?.commands?.owners?.[0] || 'Unknown'}>`, inline: true },
                { name: '🔌 Library', value: `Discord.js v14`, inline: true },
                { name: '⚡ Runtime', value: `Node.js ${process.version}`, inline: true },
                
                { name: '⏱️ Uptime', value: uptimeStr, inline: true },
                { name: '🏰 Servers', value: `${totalGuilds} Guilds`, inline: true },
                { name: '👥 Total Users', value: `${totalMembers} Members`, inline: true },

                { name: '💻 System Host', value: `${os.type()} (${os.arch()})`, inline: true },
                { name: '🧠 RAM Usage', value: `${memoryUsed} MB`, inline: true },
                { name: '📊 Platform Uptime', value: `${(os.uptime() / 3600 / 24).toFixed(1)} Days`, inline: true }
            );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error('Error in botinfo command:', error);
            await handleInteractionError(interaction, error, { commandName: 'botinfo' });
        }
    }
};
