import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from "../../utils/embeds.js";
import {
    createSelectMenu,
} from "../../utils/components.js";
import { BotConfig } from '../../config/bot.js';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_SELECT_ID = "help-category-select";
const ALL_COMMANDS_ID = "help-all-commands";
const BUG_REPORT_BUTTON_ID = "help-bug-report";
const HELP_MENU_TIMEOUT_MS = 5 * 60 * 1000;

const CATEGORY_ICONS = {
    Core: "ℹ️",
    General: "✨",
    Moderation: "🛡️",
    Security: "🚨",
    Economy: "💰",
    Fun: "🎮",
    Leveling: "📊",
    Utility: "🔧",
    Ticket: "🎫",
    Welcome: "👋",
    Giveaway: "🎉",
    Counter: "🔢",
    Tools: "🛠️",
    Search: "🔍",
    Reaction_Roles: "🎭",
    Community: "👥",
    Birthday: "🎂",
    Config: "⚙️",
};





export async function createInitialHelpMenu(client) {
    const categoryDirs = Array.from(
        new Set(
            Array.from(client.commands.values())
                .map(cmd => cmd.category)
                .filter(Boolean)
        )
    ).sort();

    const options = [
        {
            label: "📋 All Commands",
            description: "View all available commands with pagination",
            value: ALL_COMMANDS_ID,
        },
        ...categoryDirs.map((category) => {
            const categoryName =
                category.charAt(0).toUpperCase() +
                category.slice(1).toLowerCase();
            const icon = CATEGORY_ICONS[categoryName] || "🔍";
            return {
                label: `${icon} ${categoryName}`,
                description: `View commands in the ${categoryName} category`,
                value: category,
            };
        }),
    ];

    const botName = client?.user?.username || "Bot";
    const embed = createEmbed({ 
        title: `🤖 ${botName} Help Center`,
        description: "Your all-in-one Discord companion for moderation, economy, fun, and server management.",
        color: 'primary'
    });

    embed.addFields(
        {
            name: "🛡️ **Moderation**",
            value: "Server moderation, user management, and enforcement tools",
            inline: true
        },
        {
            name: "🚨 **Security**",
            value: "Anti-nuke server protection and owner management options",
            inline: true
        },
        {
            name: "💰 **Economy**",
            value: "Currency system, shops, and virtual economy",
            inline: true
        },
        {
            name: "🎮 **Fun**",
            value: "Games, entertainment, and interactive commands",
            inline: true
        },
        {
            name: "📊 **Leveling**",
            value: "User levels, XP system, and progression tracking",
            inline: true
        },
        {
            name: "🎫 **Tickets**",
            value: "Support ticket system for server management",
            inline: true
        },
        {
            name: "🎉 **Giveaways**",
            value: "Automated giveaway management and distribution",
            inline: true
        },
        {
            name: "👋 **Welcome**",
            value: "Member welcome messages and onboarding",
            inline: true
        },
        {
            name: "🎂 **Birthdays**",
            value: "Birthday tracking and celebration features",
            inline: true
        },
        {
            name: "👥 **Community**",
            value: "Community tools, applications, and member engagement",
            inline: true
        },
        {
            name: "⚙️ **Config**",
            value: "Server and bot configuration management commands",
            inline: true
        },
        {
            name: "🔢 **Counter**",
            value: "Live counter channel setup and counter controls",
            inline: true
        },
        {
            name: "🎙️ **Join to Create**",
            value: "Dynamic voice channel creation and management",
            inline: true
        },
        {
            name: "🎭 **Reaction Roles**",
            value: "Self-assignable roles using reaction-role systems",
            inline: true
        },
        {
            name: "✅ **Verification**",
            value: "Member verification workflows and access gating",
            inline: true
        },
        {
            name: "🔧 **Utilities**",
            value: "Useful tools and server utilities",
            inline: true
        }
    );

    embed.setFooter({ 
        text: "Made with ❤️" 
    });
    embed.setTimestamp();

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Select to view the commands",
        options,
    );

    const closeButton = new ButtonBuilder()
        .setCustomId("help-close")
        .setLabel("Close Menu")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌");

    const buttonRow = new ActionRowBuilder().addComponents(closeButton);

    return {
        embeds: [embed],
        components: [selectRow, buttonRow],
    };
}

export async function createCommandHelpEmbed(command, client) {
    const data = typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
    const name = data.name;
    const desc = data.description || "No description provided.";
    const category = command.category || "Utility";
    const cooldown = command.cooldown || BotConfig?.commands?.defaultCooldown || 3;
    
    const options = data.options || [];
    const subcommands = [];
    const argsInfo = [];

    for (const opt of options) {
        if (opt.type === 1) {
            subcommands.push(`\`/${name} ${opt.name}\` - ${opt.description}`);
        } else if (opt.type === 2) {
            const nested = opt.options || [];
            for (const nest of nested) {
                subcommands.push(`\`/${name} ${opt.name} ${nest.name}\` - ${nest.description}`);
            }
        } else {
            argsInfo.push(`\`[${opt.name}]\` - ${opt.description}${opt.required ? ' (Required)' : ' (Optional)'}`);
        }
    }

    const embed = createEmbed({
        title: `🔧 Command Info: /${name}`,
        description: desc,
        color: 'primary'
    });

    embed.addFields(
        { name: "📁 Category", value: category, inline: true },
        { name: "⏱️ Cooldown", value: `${cooldown}s`, inline: true }
    );

    if (subcommands.length > 0) {
        embed.addFields({ name: "📖 Subcommands", value: subcommands.join('\n'), inline: false });
    }

    if (argsInfo.length > 0) {
        embed.addFields({ name: "📥 Arguments", value: argsInfo.join('\n'), inline: false });
    }

    if (data.default_member_permissions) {
        embed.addFields({ name: "🛡️ Permissions Required", value: `Manage Messages / Administrative (Bitfield: \`${data.default_member_permissions}\`)`, inline: false });
    }

    embed.addFields({ 
        name: "💡 Usage Example", 
        value: argsInfo.length > 0 
            ? `\`/${name} ${options.filter(o => o.type !== 1 && o.type !== 2).map(o => o.name).join(' ')}\``
            : `\`/${name}\``, 
        inline: false 
    });

    embed.setFooter({ text: "RagnirBot Help Center" });
    embed.setTimestamp();

    return embed;
}

export default {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Displays the help menu with all available commands")
        .addStringOption(option =>
            option.setName("query")
                .setDescription("Specify a command name or category to view detailed usage info.")
                .setRequired(false)
        ),

    async execute(interaction, guildConfig, client) {
        const { MessageFlags } = await import('discord.js');
        
        let query = '';
        const isPrefix = !!interaction.message;

        if (isPrefix) {
            query = interaction.args?.[0]?.trim() || '';
        } else {
            query = interaction.options.getString('query')?.trim() || '';
        }

        if (query) {
            await InteractionHelper.safeDefer(interaction);

            // 1. Check if query is a Command Name
            const command = client.commands.get(query.toLowerCase());
            if (command) {
                const embed = await createCommandHelpEmbed(command, client);
                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            // 2. Check if query matches a Category / Module name
            const { createCategoryCommandsMenu } = await import('../../handlers/helpSelectMenus.js');
            const categoryDirs = Array.from(
                new Set(
                    Array.from(client.commands.values())
                        .map(cmd => cmd.category)
                        .filter(Boolean)
                )
            );
            
            const matchedCategory = categoryDirs.find(
                cat => cat.toLowerCase() === query.toLowerCase()
            );

            if (matchedCategory) {
                const { embeds, components } = await createCategoryCommandsMenu(matchedCategory, client);
                return await InteractionHelper.safeEditReply(interaction, { embeds, components });
            }

            // 3. Not found: return error
            return await InteractionHelper.safeEditReply(interaction, {
                content: `❌ Command or category **"${query}"** was not found.`
            });
        }

        // Default behavior (initial menu)
        await InteractionHelper.safeDefer(interaction);
        const { embeds, components } = await createInitialHelpMenu(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds,
            components,
        });

        setTimeout(async () => {
            try {
                await interaction.deleteReply().catch(() => null);
            } catch (error) {
                
            }
        }, HELP_MENU_TIMEOUT_MS);
    },
};


