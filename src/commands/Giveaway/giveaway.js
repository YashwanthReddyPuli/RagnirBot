import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { RagnirBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { saveGiveaway, getGuildGiveaways, deleteGiveaway as deleteGiveawayDb } from '../../utils/giveaways.js';
import { 
    parseDuration, 
    validatePrize, 
    validateWinnerCount,
    createGiveawayEmbed, 
    createGiveawayButtons,
    endGiveaway as endGiveawayService,
    selectWinners
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Manage server giveaways")
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription("Starts a new giveaway in a specified channel.")
                .addStringOption(option =>
                    option.setName("duration").setDescription("How long the giveaway should last (e.g., 1h, 30m, 5d).").setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName("winners").setDescription("The number of winners to pick.").setMinValue(1).setMaxValue(10).setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("prize").setDescription("The prize being given away.").setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName("channel").setDescription("The channel to send the giveaway to (defaults to current channel).").addChannelTypes(ChannelType.GuildText).setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("delete")
                .setDescription("Deletes a giveaway message and removes it from the database.")
                .addStringOption(option =>
                    option.setName("messageid").setDescription("The message ID of the giveaway to delete.").setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("end")
                .setDescription("Ends an active giveaway immediately and picks the winner(s).")
                .addStringOption(option =>
                    option.setName("messageid").setDescription("The message ID of the giveaway to end.").setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("reroll")
                .setDescription("Rerolls the winner(s) for an ended giveaway.")
                .addStringOption(option =>
                    option.setName("messageid").setDescription("The message ID of the ended giveaway.").setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Server Only', 'This command can only be used in a server.')],
                flags: MessageFlags.Ephemeral
            });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Permission Denied', "You need the 'Manage Server' permission to use giveaway commands.")],
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "create") {
            try {
                const durationString = interaction.options.getString("duration");
                const winnerCount = interaction.options.getInteger("winners");
                const prize = interaction.options.getString("prize");
                const targetChannel = interaction.options.getChannel("channel") || interaction.channel;

                const durationMs = parseDuration(durationString);
                validateWinnerCount(winnerCount);
                const prizeName = validatePrize(prize);

                if (!targetChannel.isTextBased()) {
                    throw new RagnirBotError(
                        'Target channel is not text-based',
                        ErrorTypes.VALIDATION,
                        'The channel must be a text channel.',
                        { channelId: targetChannel.id, channelType: targetChannel.type }
                    );
                }

                const endTime = Date.now() + durationMs;

                const initialGiveawayData = {
                    messageId: "placeholder",
                    channelId: targetChannel.id,
                    guildId: interaction.guildId,
                    prize: prizeName,
                    hostId: interaction.user.id,
                    endTime: endTime,
                    endsAt: endTime,
                    winnerCount: winnerCount,
                    participants: [],
                    isEnded: false,
                    ended: false,
                    createdAt: new Date().toISOString()
                };

                const embed = createGiveawayEmbed(initialGiveawayData, "active");
                const row = createGiveawayButtons(false);
                
                const giveawayMessage = await targetChannel.send({
                    content: "🎉 **NEW GIVEAWAY** 🎉",
                    embeds: [embed],
                    components: [row],
                });

                initialGiveawayData.messageId = giveawayMessage.id;
                await saveGiveaway(interaction.client, interaction.guildId, initialGiveawayData);

                try {
                    await logEvent({
                        client: interaction.client,
                        guildId: interaction.guildId,
                        eventType: EVENT_TYPES.GIVEAWAY_CREATE,
                        data: {
                            description: `Giveaway created: ${prizeName}`,
                            channelId: targetChannel.id,
                            userId: interaction.user.id,
                            fields: [
                                { name: '🎁 Prize', value: prizeName, inline: true },
                                { name: '🏆 Winners', value: winnerCount.toString(), inline: true },
                                { name: '⏰ Duration', value: durationString, inline: true },
                                { name: '📍 Channel', value: targetChannel.toString(), inline: true }
                            ]
                        }
                    });
                } catch (logError) {
                    logger.debug('Error logging giveaway creation event:', logError);
                }

                await InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            `Giveaway Started! 🎉`,
                            `A new giveaway for **${prizeName}** has been started in ${targetChannel} and will end in **${durationString}**.`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            } catch (error) {
                await handleInteractionError(interaction, error, {
                    type: 'command',
                    commandName: 'giveaway create'
                });
            }
        }

        else if (subcommand === "delete") {
            try {
                const messageId = interaction.options.getString("messageid");

                if (!messageId || !/^\d+$/.test(messageId)) {
                    throw new RagnirBotError(
                        'Invalid message ID format',
                        ErrorTypes.VALIDATION,
                        'Please provide a valid message ID.',
                        { providedId: messageId }
                    );
                }

                const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
                const giveaway = giveaways.find(g => g.messageId === messageId);

                if (!giveaway) {
                    throw new RagnirBotError(
                        `Giveaway not found: ${messageId}`,
                        ErrorTypes.VALIDATION,
                        "No giveaway was found with that message ID.",
                        { messageId, guildId: interaction.guildId }
                    );
                }

                let deletedMessage = false;
                let channelName = "Unknown Channel";

                const tryDeleteFromChannel = async (channel) => {
                    if (!channel || !channel.isTextBased() || !channel.messages?.fetch) {
                        return false;
                    }
                    const message = await channel.messages.fetch(messageId).catch(() => null);
                    if (!message) return false;
                    await message.delete();
                    channelName = channel.name || 'unknown-channel';
                    deletedMessage = true;
                    return true;
                };

                try {
                    const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);
                    if (await tryDeleteFromChannel(channel)) {
                        logger.debug(`Deleted giveaway message ${messageId} from channel ${channelName}`);
                    }

                    if (!deletedMessage && interaction.guild) {
                        const textChannels = interaction.guild.channels.cache.filter(
                            ch => ch.id !== giveaway.channelId && ch.isTextBased() && ch.messages?.fetch
                        );
                        for (const [, guildChannel] of textChannels) {
                            const foundAndDeleted = await tryDeleteFromChannel(guildChannel).catch(() => false);
                            if (foundAndDeleted) {
                                logger.debug(`Deleted giveaway message ${messageId} via fallback lookup in #${channelName}`);
                                break;
                            }
                        }
                    }
                } catch (error) {
                    logger.warn(`Could not delete giveaway message: ${error.message}`);
                }

                const removedFromDatabase = await deleteGiveawayDb(interaction.client, interaction.guildId, messageId);

                if (!removedFromDatabase) {
                    throw new RagnirBotError(
                        `Failed to delete giveaway from database: ${messageId}`,
                        ErrorTypes.UNKNOWN,
                        'The giveaway could not be removed from the database. Please try again.',
                        { messageId, guildId: interaction.guildId }
                    );
                }

                const statusMsg = deletedMessage
                    ? `and the message was deleted from #${channelName}`
                    : `but the message was already deleted or the channel was inaccessible.`;

                try {
                    await logEvent({
                        client: interaction.client,
                        guildId: interaction.guildId,
                        eventType: EVENT_TYPES.GIVEAWAY_DELETE,
                        data: {
                            description: `Giveaway deleted: ${giveaway.prize}`,
                            channelId: giveaway.channelId,
                            userId: interaction.user.id,
                            fields: [
                                { name: '🎁 Prize', value: giveaway.prize || 'Unknown', inline: true },
                                { name: '📊 Entries', value: (giveaway.participants?.length || 0).toString(), inline: true }
                            ]
                        }
                    });
                } catch (logError) {
                    logger.debug('Error logging giveaway deletion:', logError);
                }

                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Giveaway Deleted",
                            `Successfully deleted the giveaway for **${giveaway.prize}** ${statusMsg}.`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            } catch (error) {
                await handleInteractionError(interaction, error, {
                    type: 'command',
                    commandName: 'giveaway delete'
                });
            }
        }

        else if (subcommand === "end") {
            try {
                const messageId = interaction.options.getString("messageid");

                if (!messageId || !/^\d+$/.test(messageId)) {
                    throw new RagnirBotError(
                        'Invalid message ID format',
                        ErrorTypes.VALIDATION,
                        'Please provide a valid message ID.',
                        { providedId: messageId }
                    );
                }

                const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
                const giveaway = giveaways.find(g => g.messageId === messageId);

                if (!giveaway) {
                    throw new RagnirBotError(
                        `Giveaway not found: ${messageId}`,
                        ErrorTypes.VALIDATION,
                        "No giveaway was found with that message ID in the database.",
                        { messageId, guildId: interaction.guildId }
                    );
                }

                const endResult = await endGiveawayService(
                    interaction.client,
                    giveaway,
                    interaction.guildId,
                    interaction.user.id
                );

                const updatedGiveaway = endResult.giveaway;
                const winners = endResult.winners;

                const channel = await interaction.client.channels.fetch(updatedGiveaway.channelId).catch(() => null);

                if (!channel || !channel.isTextBased()) {
                    throw new RagnirBotError(
                        `Channel not found: ${updatedGiveaway.channelId}`,
                        ErrorTypes.VALIDATION,
                        "Could not find the channel where the giveaway was hosted.",
                        { channelId: updatedGiveaway.channelId, messageId }
                    );
                }

                const message = await channel.messages.fetch(messageId).catch(() => null);

                if (!message) {
                    throw new RagnirBotError(
                        `Message not found: ${messageId}`,
                        ErrorTypes.VALIDATION,
                        "Could not find the giveaway message.",
                        { messageId, channelId: updatedGiveaway.channelId }
                    );
                }

                await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);

                const newEmbed = createGiveawayEmbed(updatedGiveaway, "ended", winners);
                const newRow = createGiveawayButtons(true);

                await message.edit({
                    content: "🎉 **GIVEAWAY ENDED** 🎉",
                    embeds: [newEmbed],
                    components: [newRow],
                });

                if (winners.length > 0) {
                    const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");
                    const winnerPingMsg = await channel.send({
                        content: `🎉 CONGRATULATIONS ${winnerMentions}! You won the **${updatedGiveaway.prize}** giveaway! Please contact the host <@${updatedGiveaway.hostId}> to claim your prize.`,
                    });
                    updatedGiveaway.winnerPingMessageId = winnerPingMsg.id;
                    await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);

                    try {
                        await logEvent({
                            client: interaction.client,
                            guildId: interaction.guildId,
                            eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                            data: {
                                description: `Giveaway ended with ${winners.length} winner(s)`,
                                channelId: channel.id,
                                userId: interaction.user.id,
                                fields: [
                                    { name: '🎁 Prize', value: updatedGiveaway.prize || 'Mystery Prize!', inline: true },
                                    { name: '🏆 Winners', value: winnerMentions, inline: false },
                                    { name: '👥 Entries', value: endResult.participantCount.toString(), inline: true }
                                ]
                            }
                        });
                    } catch (logError) {
                        logger.debug('Error logging giveaway winner event:', logError);
                    }
                } else {
                    await channel.send({
                        content: `The giveaway for **${updatedGiveaway.prize}** has ended with no valid entries.`,
                    });
                }

                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Giveaway Ended ✅",
                            `Successfully ended the giveaway for **${updatedGiveaway.prize}** in ${channel}.`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            } catch (error) {
                await handleInteractionError(interaction, error, {
                    type: 'command',
                    commandName: 'giveaway end'
                });
            }
        }

        else if (subcommand === "reroll") {
            try {
                const messageId = interaction.options.getString("messageid");

                if (!messageId || !/^\d+$/.test(messageId)) {
                    throw new RagnirBotError(
                        'Invalid message ID format',
                        ErrorTypes.VALIDATION,
                        'Please provide a valid message ID.',
                        { providedId: messageId }
                    );
                }

                const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
                const giveaway = giveaways.find(g => g.messageId === messageId);

                if (!giveaway) {
                    throw new RagnirBotError(
                        `Giveaway not found: ${messageId}`,
                        ErrorTypes.VALIDATION,
                        "No giveaway was found with that message ID in the database.",
                        { messageId, guildId: interaction.guildId }
                    );
                }

                if (!giveaway.isEnded && !giveaway.ended) {
                    throw new RagnirBotError(
                        `Giveaway still active: ${messageId}`,
                        ErrorTypes.VALIDATION,
                        "This giveaway is still active. Please use `/giveaway end` first.",
                        { messageId, status: 'active' }
                    );
                }

                const participants = giveaway.participants || [];
                
                if (participants.length < giveaway.winnerCount) {
                    throw new RagnirBotError(
                        `Insufficient participants for reroll: ${participants.length} < ${giveaway.winnerCount}`,
                        ErrorTypes.VALIDATION,
                        "Not enough entries to pick the required number of winners.",
                        { participantsCount: participants.length, winnersNeeded: giveaway.winnerCount }
                    );
                }

                const newWinners = selectWinners(participants, giveaway.winnerCount);

                const updatedGiveaway = {
                    ...giveaway,
                    winnerIds: newWinners,
                    rerolledAt: new Date().toISOString(),
                    rerolledBy: interaction.user.id
                };

                const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);

                if (!channel || !channel.isTextBased()) {
                    await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);
                    return InteractionHelper.safeReply(interaction, {
                        embeds: [
                            successEmbed(
                                "Reroll Complete",
                                "The new winners have been selected and saved to the database. Could not find channel to announce.",
                            ),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const message = await channel.messages.fetch(messageId).catch(() => null);

                if (!message) {
                    await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);
                    const winnerMentions = newWinners.map((id) => `<@${id}>`).join(", ");
                    const existingPingMsg = giveaway.winnerPingMessageId
                        ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                        : null;
                    if (existingPingMsg) {
                        await existingPingMsg.edit({
                            content: `🔄 **GIVEAWAY REROLL** 🔄 New winners for **${giveaway.prize}**: ${winnerMentions}!`,
                        });
                    } else {
                        const newPingMsg = await channel.send({
                            content: `🔄 **GIVEAWAY REROLL** 🔄 New winners for **${giveaway.prize}**: ${winnerMentions}!`,
                        });
                        updatedGiveaway.winnerPingMessageId = newPingMsg.id;
                    }

                    return InteractionHelper.safeReply(interaction, {
                        embeds: [
                            successEmbed(
                                "Reroll Complete",
                                `The new winners have been announced in ${channel}. (Original message not found).`,
                            ),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);

                const newEmbed = createGiveawayEmbed(updatedGiveaway, "reroll", newWinners);
                const newRow = createGiveawayButtons(true);

                await message.edit({
                    content: "🔄 **GIVEAWAY REROLLED** 🔄",
                    embeds: [newEmbed],
                    components: [newRow],
                });

                const winnerMentions = newWinners.map((id) => `<@${id}>`).join(", ");
                const existingPingMsg = giveaway.winnerPingMessageId
                    ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                    : null;
                if (existingPingMsg) {
                    await existingPingMsg.edit({
                        content: `🔄 **REROLL WINNERS** 🔄 CONGRATULATIONS ${winnerMentions}! You are the new winner(s) for the **${giveaway.prize}** giveaway! Please contact the host <@${giveaway.hostId}> to claim your prize.`,
                    });
                } else {
                    const newPingMsg = await channel.send({
                        content: `🔄 **REROLL WINNERS** 🔄 CONGRATULATIONS ${winnerMentions}! You are the new winner(s) for the **${giveaway.prize}** giveaway! Please contact the host <@${giveaway.hostId}> to claim your prize.`,
                    });
                    updatedGiveaway.winnerPingMessageId = newPingMsg.id;
                }

                try {
                    await logEvent({
                        client: interaction.client,
                        guildId: interaction.guildId,
                        eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                        data: {
                            description: `Giveaway rerolled: ${giveaway.prize}`,
                            channelId: giveaway.channelId,
                            userId: interaction.user.id,
                            fields: [
                                { name: '🎁 Prize', value: giveaway.prize || 'Mystery Prize!', inline: true },
                                { name: '🏆 New Winners', value: winnerMentions, inline: false },
                                { name: '👥 Total Entries', value: participants.length.toString(), inline: true }
                            ]
                        }
                    });
                } catch (logError) {
                    logger.debug('Error logging giveaway reroll event:', logError);
                }

                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Reroll Successful ✅",
                            `Successfully rerolled the giveaway for **${giveaway.prize}** in ${channel}.`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            } catch (error) {
                await handleInteractionError(interaction, error, {
                    type: 'command',
                    commandName: 'giveaway reroll'
                });
            }
        }
    }
};
