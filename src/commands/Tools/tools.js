import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getColor } from '../../config/bot.js';
import { createControlButtons, formatTime, startCountdown } from '../../handlers/countdownButtons.js';
export const activeCountdowns = new Map();
const toolsCountdowns = activeCountdowns;

const BASE_ALPHABETS = {
    'BIN': { base: 2, prefix: '0b', name: 'Binary', alphabet: '01' },
    'OCT': { base: 8, prefix: '0o', name: 'Octal', alphabet: '0-7' },
    'DEC': { base: 10, prefix: '', name: 'Decimal', alphabet: '0-9' },
    'HEX': { base: 16, prefix: '0x', name: 'Hexadecimal', alphabet: '0-9A-F' },
    'B64': { base: 64, prefix: 'b64:', name: 'Base64', alphabet: 'A-Za-z0-9+/=' },
    'B36': { base: 36, prefix: '', name: 'Base36', alphabet: '0-9A-Z' },
    'B58': { base: 58, prefix: '', name: 'Base58', alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz' },
    'B62': { base: 62, prefix: '', name: 'Base62', alphabet: '0-9A-Za-z' },
};

const BASE_NAMES = Object.entries(BASE_ALPHABETS).map(([key, { name }]) => ({ name: `${key} (${name})`, value: key }));
const BASE_CHARSETS = {
    BIN: '01',
    OCT: '01234567',
    DEC: '0123456789',
    HEX: '0123456789ABCDEF',
    B36: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    B58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    B62: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
};

function parseBigIntFromBase(value, baseKey) {
    if (baseKey === 'B64') {
        const bytes = Buffer.from(value, 'base64');
        return bytes.reduce((acc, byte) => (acc * 256n) + BigInt(byte), 0n);
    }
    const charset = BASE_CHARSETS[baseKey];
    if (!charset) throw new Error(`Unsupported base: ${baseKey}`);
    const normalized = ['BIN', 'OCT', 'DEC', 'HEX', 'B36'].includes(baseKey) ? value.toUpperCase() : value;
    let result = 0n;
    const base = BigInt(charset.length);
    for (const char of normalized) {
        const digit = charset.indexOf(char);
        if (digit < 0) throw new Error(`Invalid character '${char}' for base ${baseKey}`);
        result = (result * base) + BigInt(digit);
    }
    return result;
}

function formatBigIntToBase(value, baseKey) {
    if (baseKey === 'B64') {
        if (value === 0n) return Buffer.from([0]).toString('base64');
        const bytes = [];
        let n = value;
        while (n > 0n) {
            bytes.unshift(Number(n & 0xffn));
            n >>= 8n;
        }
        return Buffer.from(bytes).toString('base64');
    }
    const charset = BASE_CHARSETS[baseKey];
    if (!charset) throw new Error(`Unsupported base: ${baseKey}`);
    if (value === 0n) return '0';
    const base = BigInt(charset.length);
    let n = value;
    let output = '';
    while (n > 0n) {
        const index = Number(n % base);
        output = charset[index] + output;
        n /= base;
    }
    return output;
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function getColorName(hex) {
    const colors = {
        '#FF0000': 'Red', '#00FF00': 'Green', '#0000FF': 'Blue', '#FFFF00': 'Yellow',
        '#FF00FF': 'Magenta', '#00FFFF': 'Cyan', '#000000': 'Black', '#FFFFFF': 'White',
        '#808080': 'Gray', '#FFA500': 'Orange', '#800080': 'Purple', '#A52A2A': 'Brown',
        '#FFC0CB': 'Pink', '#008000': 'Dark Green', '#000080': 'Navy', '#FFD700': 'Gold',
        '#C0C0C0': 'Silver', '#FF6347': 'Tomato', '#40E0D0': 'Turquoise', '#E6E6FA': 'Lavender'
    };
    if (colors[hex.toUpperCase()]) return colors[hex.toUpperCase()];
    const hexValue = parseInt(hex.replace('#', ''), 16);
    let closestColor = '';
    let minDistance = Infinity;
    for (const [colorHex, name] of Object.entries(colors)) {
        const colorValue = parseInt(colorHex.replace('#', ''), 16);
        const distance = Math.abs(hexValue - colorValue);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = name;
        }
    }
    return minDistance < 1000000 ? `Close to ${closestColor}` : null;
}

export default {
    data: new SlashCommandBuilder()
        .setName('tools')
        .setDescription('Various tools and utilities')
        .addSubcommand(subcommand =>
            subcommand
                .setName('baseconvert')
                .setDescription('Convert numbers between different bases')
                .addStringOption(option => option.setName('number').setDescription('The number to convert').setRequired(true))
                .addStringOption(option => option.setName('from').setDescription('Source base/format').setRequired(true).addChoices(...BASE_NAMES))
                .addStringOption(option => option.setName('to').setDescription('Target base/format (default: all)').setRequired(false).addChoices(...BASE_NAMES))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('countdown')
                .setDescription('Start a countdown timer')
                .addIntegerOption(option => option.setName('minutes').setDescription('Minutes to count down (0-1440)').setMinValue(0).setMaxValue(1440).setRequired(false))
                .addIntegerOption(option => option.setName('seconds').setDescription('Seconds to count down (0-59)').setMinValue(0).setMaxValue(59).setRequired(false))
                .addStringOption(option => option.setName('title').setDescription('Optional title for the countdown').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('generatepassword')
                .setDescription('Generate a strong, random password')
                .addIntegerOption(option => option.setName('length').setDescription('Password length (default: 16, max: 50)').setMinValue(8).setMaxValue(50).setRequired(false))
                .addBooleanOption(option => option.setName('uppercase').setDescription('Include uppercase letters (A-Z)').setRequired(false))
                .addBooleanOption(option => option.setName('numbers').setDescription('Include numbers (0-9)').setRequired(false))
                .addBooleanOption(option => option.setName('symbols').setDescription('Include symbols (!@#$%^&*)').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('hexcolor')
                .setDescription('Generate a random hex color with preview')
                .addStringOption(option => option.setName('color').setDescription('Specific hex color (e.g., #FF5733)').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('randomuser')
                .setDescription('Select a random user from the server')
                .addRoleOption(option => option.setName('role').setDescription('Limit selection to users with this role').setRequired(false))
                .addBooleanOption(option => option.setName('bots').setDescription('Include bots in the selection (default: false)').setRequired(false))
                .addBooleanOption(option => option.setName('online').setDescription('Only select from online users (default: false)').setRequired(false))
                .addBooleanOption(option => option.setName('mention').setDescription('Mention the selected user (default: false)').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('shorten')
                .setDescription('Shorten a URL using is.gd')
                .addStringOption(option => option.setName('url').setDescription('The URL to shorten').setRequired(true))
                .addStringOption(option => option.setName('custom').setDescription('Custom URL ending (optional)').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unixtime')
                .setDescription('Get the current Unix timestamp')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'baseconvert') {
            const deferSuccess = await InteractionHelper.safeDefer(interaction);
            if (!deferSuccess) return;

            try {
                const numberStr = interaction.options.getString('number').trim();
                const fromBase = interaction.options.getString('from');
                const toBase = interaction.options.getString('to');
                
                const { prefix: fromPrefix, name: fromName } = BASE_ALPHABETS[fromBase];
                const cleanNumber = fromPrefix && numberStr.startsWith(fromPrefix) ? numberStr.slice(fromPrefix.length) : numberStr;
                
                if (!cleanNumber) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('❌ Empty Input', 'You must provide a number to convert.')]
                    });
                }
                
                const alphabet = BASE_ALPHABETS[fromBase].alphabet;
                const regex = new RegExp(`^[${alphabet}]+$`, 'i');
                
                if (!regex.test(cleanNumber)) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed(`❌ Invalid ${fromName}`, `You provided: \`${cleanNumber}\` (Valid chars: \`${alphabet}\`)`)]
                    });
                }
                
                let decimalValue = parseBigIntFromBase(cleanNumber, fromBase);
                
                if (toBase) {
                    const { prefix: toPrefix, name: toName } = BASE_ALPHABETS[toBase];
                    const result = formatBigIntToBase(decimalValue, toBase);
                    const embed = successEmbed(
                        '🔄 Base Conversion Result',
                        `**From ${fromName} (${fromBase}):** \`${fromPrefix}${cleanNumber}\`\n` +
                        `**To ${toName} (${toBase}):** \`${toPrefix}${result}\`\n` +
                        `**Decimal:** \`${decimalValue.toLocaleString()}\``
                    ).setColor(getColor('success'));
                    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
                } else {
                    let description = `**Input (${fromName}):** \`${fromPrefix}${cleanNumber}\`\n`;
                    description += `**Decimal:** \`${decimalValue.toLocaleString()}\`\n\n`;
                    for (const [baseKey, { prefix, name }] of Object.entries(BASE_ALPHABETS)) {
                        if (baseKey === fromBase) continue;
                        try {
                            let value = formatBigIntToBase(decimalValue, baseKey);
                            description += `**${name} (${baseKey}):** \`${prefix}${value}\`\n`;
                        } catch {
                            description += `**${name} (${baseKey}):** *Too large to convert*\n`;
                        }
                    }
                    const embed = successEmbed('🔄 Base Conversion Results', description).setColor(getColor('primary'));
                    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
                }
            } catch (error) {
                await handleInteractionError(interaction, error, { type: 'command', commandName: 'tools baseconvert' });
            }
        }

        else if (subcommand === 'countdown') {
            const deferSuccess = await InteractionHelper.safeDefer(interaction);
            if (!deferSuccess) return;

            try {
                const minutes = interaction.options.getInteger("minutes") || 0;
                const seconds = interaction.options.getInteger("seconds") || 0;
                const title = interaction.options.getString("title") || "Countdown Timer";

                const totalSeconds = minutes * 60 + seconds;
                if (totalSeconds <= 0) throw new Error("Please specify a duration of at least 1 second.");
                if (totalSeconds > 86400) throw new Error("Countdown cannot be longer than 24 hours.");

                const endTime = Date.now() + totalSeconds * 1000;
                const countdownId = `${interaction.channelId}-${Date.now()}`;
                const row = createControlButtons(countdownId);

                const initialEmbed = successEmbed(`⏱️ ${title}`, `Time remaining: **${formatTime(totalSeconds)}**`);
                const message = await interaction.channel.send({ embeds: [initialEmbed], components: [row] });

                const countdownData = {
                    message, endTime, remainingTime: totalSeconds * 1000, isPaused: false, title, lastUpdate: Date.now(), interval: null
                };

                toolsCountdowns.set(countdownId, countdownData);
                startCountdown(countdownId, countdownData, toolsCountdowns);

                await InteractionHelper.safeEditReply(interaction, {
                    content: "✅ Countdown started!",
                    flags: MessageFlags.Ephemeral,
                });
            } catch (error) {
                await handleInteractionError(interaction, error, { type: 'command', commandName: 'tools countdown' });
            }
        }

        else if (subcommand === 'generatepassword') {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            try {
                const length = interaction.options.getInteger('length') || 16;
                const includeUppercase = interaction.options.getBoolean('uppercase') ?? true;
                const includeNumbers = interaction.options.getBoolean('numbers') ?? true;
                const includeSymbols = interaction.options.getBoolean('symbols') ?? true;
                
                const lowercase = 'abcdefghijklmnopqrstuvwxyz';
                const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const numbers = '0123456789';
                const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
                
                let chars = lowercase;
                if (includeUppercase) chars += uppercase;
                if (includeNumbers) chars += numbers;
                if (includeSymbols) chars += symbols;
                
                let password = '';
                const randomValues = new Uint32Array(length);
                crypto.getRandomValues(randomValues);
                
                for (let i = 0; i < length; i++) {
                    password += chars[randomValues[i] % chars.length];
                }
                
                const embed = successEmbed(
                    '🔑 Generated Password',
                    `**Password:** ||\`${password}\`||\n` +
                    `**Length:** ${password.length} characters`
                ).setColor(getColor('success'));
                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                await handleInteractionError(interaction, error, { type: 'command', commandName: 'tools generatepassword' });
            }
        }

        else if (subcommand === 'hexcolor') {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            try {
                let hexColor = interaction.options.getString('color');
                let isRandom = false;

                if (!hexColor) {
                    isRandom = true;
                    hexColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                } else {
                    hexColor = hexColor.replace('#', '');
                    if (!/^[0-9A-Fa-f]{3,6}$/.test(hexColor)) {
                        return InteractionHelper.safeEditReply(interaction, {
                            embeds: [errorEmbed('❌ Invalid Hex Color', 'Please provide a valid hex code.')],
                        });
                    }
                    if (hexColor.length === 3) hexColor = hexColor.split('').map(c => c + c).join('');
                    hexColor = '#' + hexColor.toUpperCase();
                }

                const r = parseInt(hexColor.slice(1, 3), 16);
                const g = parseInt(hexColor.slice(3, 5), 16);
                const b = parseInt(hexColor.slice(5, 7), 16);

                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                const textColor = brightness > 128 ? '#000000' : '#FFFFFF';
                const colorPreviewUrl = `https://dummyimage.com/200x100/${hexColor.replace('#', '')}/${textColor.replace('#', '')}?text=${encodeURIComponent(hexColor)}`;
                const colorName = getColorName(hexColor);

                const embed = successEmbed(
                    '🎨 Color Information',
                    `**Hex:** \`${hexColor}\`\n` +
                    `**RGB:** \`rgb(${r}, ${g}, ${b})\`\n` +
                    `**HSL:** \`${rgbToHsl(r, g, b)}\`\n` +
                    `**Name:** ${colorName || 'Custom Color'}`
                ).setColor(hexColor).setImage(colorPreviewUrl);

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                await handleInteractionError(interaction, error, { type: 'command', commandName: 'tools hexcolor' });
            }
        }

        else if (subcommand === 'randomuser') {
            const deferSuccess = await InteractionHelper.safeDefer(interaction);
            if (!deferSuccess) return;

            try {
                const role = interaction.options.getRole('role');
                const includeBots = interaction.options.getBoolean('bots') || false;
                const onlineOnly = interaction.options.getBoolean('online') || false;
                const shouldMention = interaction.options.getBoolean('mention') || false;
                
                let members = interaction.guild.members.cache.filter(member => {
                    if (member.user.bot && !includeBots) return false;
                    if (onlineOnly && member.presence?.status === 'offline') return false;
                    if (role && !member.roles.cache.has(role.id)) return false;
                    return true;
                });
                
                let memberArray = Array.from(members.values());
                if (!includeBots) memberArray = memberArray.filter(member => !member.user.bot);
                
                if (memberArray.length === 0) {
                    return interaction.editReply({
                        embeds: [errorEmbed('❌ No Users Found', 'Could not find any users matching your filters.')],
                        flags: [MessageFlags.Ephemeral]
                    });
                }
                
                const selectedMember = memberArray[Math.floor(Math.random() * memberArray.length)];
                const user = selectedMember.user;
                const roles = selectedMember.roles.cache
                    .filter(r => r.id !== interaction.guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(r => r.toString())
                    .slice(0, 10);
                
                const embed = successEmbed('🎲 Random User Selected', shouldMention ? `${selectedMember}` : `**${user.username}**`)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .addFields(
                        { name: '👤 Username', value: user.username, inline: true },
                        { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
                        { name: `🎭 Roles (${roles.length})`, value: roles.length > 0 ? roles.slice(0, 5).join(' ') : 'No roles', inline: false }
                    ).setColor('primary');
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`randomuser_${interaction.user.id}_again`).setLabel('🎲 Pick Another').setStyle(ButtonStyle.Primary)
                );
                
                await interaction.editReply({
                    content: shouldMention ? `${selectedMember}, you've been chosen!` : null,
                    embeds: [embed],
                    components: [row]
                });
            } catch (error) {
                await handleInteractionError(interaction, error, { type: 'command', commandName: 'tools randomuser' });
            }
        }

        else if (subcommand === 'shorten') {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            try {
                const url = interaction.options.getString("url");
                const custom = interaction.options.getString("custom");

                try {
                    new URL(url);
                } catch {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed("Invalid URL", "Invalid URL format. Include http:// or https://")]
                    });
                }

                let apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
                if (custom) apiUrl += `&shorturl=${encodeURIComponent(custom)}`;

                const response = await fetch(apiUrl).catch(() => null);
                if (!response || !response.ok) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('URL Shortening Failed', 'Unable to reach the URL shortener service right now.')]
                    });
                }

                const shortUrl = await response.text();
                const embed = successEmbed("URL Shortened", `Here's your shortened URL: ${shortUrl}`);
                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                await handleInteractionError(interaction, error, { type: 'command', commandName: 'tools shorten' });
            }
        }

        else if (subcommand === 'unixtime') {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            try {
                const now = new Date();
                const unixTimestamp = Math.floor(now.getTime() / 1000);
                const embed = successEmbed(
                    '⏱️ Current Unix Timestamp',
                    `**Seconds since Unix Epoch:** \`${unixTimestamp}\`\n` +
                    `**ISO String:** ${now.toISOString()}`
                ).setColor(getColor('success'));
                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } catch (error) {
                await handleInteractionError(interaction, error, { type: 'command', commandName: 'tools unixtime' });
            }
        }
    }
};
