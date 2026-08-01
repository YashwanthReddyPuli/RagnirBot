import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Manage your bank transactions')
        .addSubcommand(subcommand =>
            subcommand
                .setName('deposit')
                .setDescription('Deposit money from your wallet into your bank')
                .addStringOption(option =>
                    option.setName('amount').setDescription('Amount to deposit (number or "all")').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('withdraw')
                .setDescription('Withdraw money from your bank to your wallet')
                .addStringOption(option =>
                    option.setName('amount').setDescription('Amount to withdraw (number or "all")').setRequired(true)
                )
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
        
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const amountInput = interaction.options.getString("amount");

        const userData = await getEconomyData(client, guildId, userId);
        if (!userData) {
            throw createError(
                "Failed to load economy data",
                ErrorTypes.DATABASE,
                "Failed to load your economy data. Please try again later.",
                { userId, guildId }
            );
        }

        const maxBank = getMaxBankCapacity(userData);

        if (subcommand === 'deposit') {
            let depositAmount;

            if (amountInput.toLowerCase() === "all") {
                depositAmount = userData.wallet;
            } else {
                depositAmount = parseInt(amountInput);
                if (isNaN(depositAmount) || depositAmount <= 0) {
                    throw createError(
                        "Invalid deposit amount",
                        ErrorTypes.VALIDATION,
                        `Please enter a valid number or 'all'. You entered: \`${amountInput}\``,
                        { amountInput, userId }
                    );
                }
            }

            if (depositAmount === 0) {
                throw createError(
                    "Zero deposit amount",
                    ErrorTypes.VALIDATION,
                    "You have no cash to deposit.",
                    { userId, walletBalance: userData.wallet }
                );
            }

            if (depositAmount > userData.wallet) {
                depositAmount = userData.wallet;
                await interaction.followUp({
                    embeds: [
                        MessageTemplates.ERRORS.INVALID_INPUT(
                            "deposit amount",
                            `You tried to deposit more than you have. Depositing your remaining cash: **$${depositAmount.toLocaleString()}**`
                        )
                    ],
                    flags: [MessageFlags.Ephemeral],
                });
            }

            const availableSpace = maxBank - userData.bank;

            if (availableSpace <= 0) {
                throw createError(
                    "Bank is full",
                    ErrorTypes.VALIDATION,
                    `Your bank is currently full (Max Capacity: $${maxBank.toLocaleString()}). Purchase a **Bank Upgrade** to increase your limit.`,
                    { maxBank, currentBank: userData.bank, userId }
                );
            }

            if (depositAmount > availableSpace) {
                depositAmount = availableSpace;
                if (amountInput.toLowerCase() !== "all") {
                    await interaction.followUp({
                        embeds: [
                            MessageTemplates.ERRORS.INVALID_INPUT(
                                "deposit amount",
                                `You only had space for **$${depositAmount.toLocaleString()}** in your bank account (Max: $${maxBank.toLocaleString()}). The rest remains in your cash.`
                            )
                        ],
                        flags: [MessageFlags.Ephemeral],
                    });
                }
            }

            if (depositAmount === 0) {
                throw createError(
                    "No space or cash for deposit",
                    ErrorTypes.VALIDATION,
                    "The amount you tried to deposit was either 0 or exceeded your bank capacity.",
                    { depositAmount, availableSpace, walletBalance: userData.wallet }
                );
            }

            userData.wallet -= depositAmount;
            userData.bank += depositAmount;

            await setEconomyData(client, guildId, userId, userData);

            const embed = MessageTemplates.SUCCESS.DATA_UPDATED(
                "deposit",
                `You successfully deposited **$${depositAmount.toLocaleString()}** into your bank.`
            ).addFields(
                { name: "💵 New Cash Balance", value: `$${userData.wallet.toLocaleString()}`, inline: true },
                { name: "🏦 New Bank Balance", value: `$${userData.bank.toLocaleString()} / $${maxBank.toLocaleString()}`, inline: true }
            );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        else if (subcommand === 'withdraw') {
            let withdrawAmount;

            if (amountInput.toLowerCase() === "all") {
                withdrawAmount = userData.bank;
            } else {
                withdrawAmount = parseInt(amountInput);
                if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
                    throw createError(
                        "Invalid withdrawal amount",
                        ErrorTypes.VALIDATION,
                        `Please enter a valid number or 'all'. You entered: \`${amountInput}\``,
                        { amountInput, userId }
                    );
                }
            }

            if (withdrawAmount === 0) {
                throw createError(
                    "Empty bank account",
                    ErrorTypes.VALIDATION,
                    "Your bank account is empty.",
                    { userId, bankBalance: userData.bank }
                );
            }

            if (withdrawAmount > userData.bank) {
                withdrawAmount = userData.bank;
            }

            userData.wallet += withdrawAmount;
            userData.bank -= withdrawAmount;

            await setEconomyData(client, guildId, userId, userData);

            const embed = MessageTemplates.SUCCESS.DATA_UPDATED(
                "withdrawal",
                `You successfully withdrew **$${withdrawAmount.toLocaleString()}** from your bank.`
            ).addFields(
                { name: "💵 New Cash Balance", value: `$${userData.wallet.toLocaleString()}`, inline: true },
                { name: "🏦 New Bank Balance", value: `$${userData.bank.toLocaleString()}`, inline: true }
            );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }
    }, { command: 'bank' })
};
