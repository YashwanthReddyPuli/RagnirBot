import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('List bots or boosters in this server')
        .addSubcommand(subcommand =>
            subcommand.setName('bots')
                .setDescription('List all bot accounts in the server')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('boosters')
                .setDescription('List all active server boosters')
        ),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            let subcommand = '';
            if (interaction.message) {
                subcommand = interaction.args?.[0]?.toLowerCase() || '';
            } else {
                subcommand = interaction.options.getSubcommand();
            }

            const guild = interaction.guild;

            if (subcommand === 'bots') {
                // Fetch members to ensure cache is populated
                await guild.members.fetch();
                const botsList = guild.members.cache.filter(m => m.user.bot).map(m => `<@${m.user.id}> (${m.user.tag})`);
                
                const embed = createEmbed({
                    title: `🤖 Bots in ${guild.name} (${botsList.length})`,
                    color: 'primary'
                });

                if (botsList.length === 0) {
                    embed.setDescription('There are no other bots in this server.');
                } else {
                    embed.setDescription(botsList.slice(0, 30).join('\n') + (botsList.length > 30 ? `\n\n*...and ${botsList.length - 30} more bots.*` : ''));
                }

                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            if (subcommand === 'boosters') {
                await guild.members.fetch();
                const boostersList = guild.members.cache.filter(m => m.premiumSince !== null)
                    .sort((a, b) => a.premiumSince - b.premiumSince)
                    .map(m => `<@${m.user.id}> - Boosted <t:${Math.floor(m.premiumSince.getTime() / 1000)}:R>`);

                const embed = createEmbed({
                    title: `🚀 Server Boosters (${boostersList.length})`,
                    color: 'primary'
                });

                if (boostersList.length === 0) {
                    embed.setDescription('This server does not have any active boosters currently.');
                } else {
                    embed.setDescription(boostersList.slice(0, 30).join('\n') + (boostersList.length > 30 ? `\n\n*...and ${boostersList.length - 30} more boosters.*` : ''));
                }

                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            // Fallback help
            await InteractionHelper.safeEditReply(interaction, {
                content: '❌ Invalid list option. Use `bots` or `boosters`.'
            });
        } catch (error) {
            logger.error('Error in list command:', error);
            await handleInteractionError(interaction, error, { commandName: 'list' });
        }
    }
};
