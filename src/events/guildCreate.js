import { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotConfig } from '../config/bot.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.GuildCreate,
    async execute(guild, client) {
        try {
            logger.info(`Joined a new server: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);

            // Find the best text channel to send the welcome card
            const targetChannel = guild.systemChannel || guild.channels.cache.find(
                c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
            );

            if (!targetChannel) {
                logger.warn(`Could not find a suitable text channel to send welcome message in guild ${guild.name}`);
                return;
            }

            const ownerId = BotConfig?.commands?.owners?.[0];
            const developerMention = ownerId ? `<@${ownerId}>` : 'the Bot Owner';

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`⚡ Welcome to RagnirBot Onboarding!`)
                .setDescription(`Thank you for inviting **RagnirBot** to **${guild.name}**! RagnirBot is a feature-rich, high-performance administration, automation, and community engagement bot.`)
                .setColor('#336699')
                .addFields(
                    { 
                        name: '🛡️ Advanced Anti-Nuke & Automod Protection', 
                        value: 'Keep your server safe from malicious accounts! Configure anti-spam rates, blacklisted words, link blocklists, and mass mention rules with automated kicks, bans, or mutes. Set up Anti-Nuke thresholds to automatically lock down administrative actions.', 
                        inline: false 
                    },
                    { 
                        name: '🎫 Support Tickets & Backups', 
                        value: 'Give members a secure channel to reach staff. Create dynamic ticket panels, support queues, priority levels, and generate HTML transcripts upon closing. Make server configuration backups and restore structures instantly.', 
                        inline: false 
                    },
                    { 
                        name: '⚙️ Onboarding Gates & Verification', 
                        value: 'Automate greeting embeds, assign auto-roles upon joining, and configure captcha-like buttons to grant access to verified users, avoiding bots and raids.', 
                        inline: false 
                    },
                    { 
                        name: '📊 Leveling & Server Statistics', 
                        value: 'Reward member activity with XP tracking, level roles, and customized level-up cards. Deploy active member counts and voice stats channels that update in real-time.', 
                        inline: false 
                    },
                    { 
                        name: '🚀 Getting Started', 
                        value: `Type **\`/help\`** or prefix **\`;help\`** in your chat to open the interactive, optimized Help Center to explore commands. You can configure individual systems via their dashboard commands (e.g. \`/logging config\`, \`/ticket dashboard\`).`, 
                        inline: false 
                    },
                    { 
                        name: '💡 Support & Feedback', 
                        value: `If you have custom requirements, experience database fallbacks, or find any bugs, feel free to direct message the developer: ${developerMention}, or click the button below to submit a ticket on GitHub.`, 
                        inline: false 
                    }
                )
                .setFooter({ text: 'RagnirBot Onboarding System • Built for Discord Server Optimization' })
                .setTimestamp();

            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Report Issue / GitHub')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://github.com/YashwanthReddyPuli/RagnirBot/issues')
                    .setEmoji('🐛')
            );

            await targetChannel.send({
                embeds: [welcomeEmbed],
                components: [buttonRow]
            });

            logger.info(`Successfully sent welcome card to guild ${guild.name} in channel #${targetChannel.name}`);
        } catch (error) {
            logger.error(`Error executing guildCreate event handler for guild ${guild.id}:`, error);
        }
    }
};
