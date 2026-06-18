# 🤖 RagnirBot Premium Feature Documentation

Welcome to the official feature manual for **RagnirBot** (v1.1.1), the ultimate modular companion bot for Discord. This document details all systems, database properties, interactive panels, and command schemas.

---

## 📋 Table of Contents
1. [🏗️ Core Architecture & Config](#1-core-architecture--config)
2. [🛡️ Security & Anti-Nuke System](#2-️-security--anti-nuke-system)
3. [🤖 Auto-Moderation (AutoMod)](#3-auto-moderation-automod)
4. [⚔️ Moderation & Enforcement](#4-moderation--enforcement)
5. [💰 Virtual Economy System](#5-virtual-economy-system)
6. [🎫 Support Ticket System](#6-support-ticket-system)
7. [🎉 Giveaway Management](#7-giveaway-management)
8. [🎂 Birthday Tracking & Announcements](#8-birthday-tracking--announcements)
9. [👋 Onboarding & Greetings (Welcome/Goodbye)](#9-onboarding--greetings-welcomegoodbye)
10. [📊 Live Server Statistics (Counters)](#10-live-server-statistics-counters)
11. [🎙️ Join-to-Create Voice Channels](#11-join-to-create-voice-channels)
12. [🎭 Reaction Roles](#12-reaction-roles)
13. [✅ Server Verification Gate](#13-server-verification-gate)
14. [🛠️ Utility, QoL, & Entertainment Tools](#14-utility-qol--entertainment-tools)
15. [💬 Complete Slash Command Registry](#15-complete-slash-command-registry)

---

## 1. 🏗️ Core Architecture & Config

RagnirBot relies on a modular feature toggle switchboard, a dual-layer database, and a centralized configuration.

### ⚙️ System Configuration Settings
Below is the core configuration map loaded from [src/config/bot.js](file:///d:/RagnirBot/src/config/bot.js):

| Config Domain | Key | Default Value | Description |
| :--- | :--- | :--- | :--- |
| **Presence** | `presence.status` | `"online"` | Status indicator (online, idle, dnd, invisible) |
| **Presence** | `presence.activities` | `[{ name: "/help \| Ragnir Bot", type: 0 }]` | Activity text and type (0 = Playing) |
| **Commands** | `commands.defaultCooldown`| `3` (seconds) | Global command rate limit cooldown |
| **Database** | Primary Storage | **PostgreSQL** | Dynamic connection pooling via `pg` |
| **Database** | Fallback Storage | **Memory Storage** | Fallback memory storage for local development |

> [!NOTE]
> RagnirBot validates configuration environment variables on startup. In production environments (`NODE_ENV=production`), missing database configuration parameters cause a graceful termination to prevent corrupted data layers.

---

## 2. 🛡️ Security & Anti-Nuke System

The Anti-Nuke system protects servers from rogue administrators or compromised bot integrations.

### 🛡️ Anti-Nuke Limits and Actions
The system monitors high-impact server events and applies punishments automatically.

| Monitored Event | Limit Threshold | Timeframe | Punishment Action |
| :--- | :---: | :---: | :---: |
| **Role Creation** | 3 creations | 15 seconds | `demote` (strips action user of permissions) |
| **Role Updates** | 3 updates | 15 seconds | `demote` |
| **Role Deletion** | 3 deletions | 15 seconds | `demote` |
| **Channel Creation** | 3 creations | 15 seconds | `demote` |
| **Channel Updates** | 3 updates | 15 seconds | `demote` |
| **Channel Deletion** | 3 deletions | 15 seconds | `demote` |
| **Member Ban** | 3 bans | 15 seconds | `ban` (bans the action user) |
| **Member Kick** | 3 kicks | 15 seconds | `ban` |
| **Webhook Modify** | 1 modification | 10 seconds | `ban` |
| **Bot Integration** | 1 bot add | 10 seconds | `ban` |
| **Server Updates** | 1 guild change | 10 seconds | `ban` |
| **Emoji Creation** | 5 creations | 15 seconds | `demote` |
| **Emoji Deletion** | 5 deletions | 15 seconds | `demote` |

### 📂 Zod Schema Data Mapping
Config keys mapped in [src/utils/schemas.js](file:///d:/RagnirBot/src/utils/schemas.js):

| Config Key | Data Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | Boolean | `false` | Global state toggle for Anti-Nuke |
| `logChannelId` | String (Null) | `null` | Channel where alerts are logged |
| `extraOwners` | Array\<String\> | `[]` | Users designated as Anti-Nuke administrators |
| `whitelistedUsers`| Record\<String, Boolean/Array\>| `{}` | Users exempt from specific security limits |
| `whitelistedRoles`| Record\<String, Boolean/Array\>| `{}` | Roles exempt from specific security limits |

> [!IMPORTANT]
> Whitelists and system settings can be updated on the fly using `/anti-nuke panel`, which spawns a secure dashboard using Discord components.

---

## 3. 🤖 Auto-Moderation (AutoMod)

Tracks incoming chat streams in real-time, executing moderation actions instantly.

### 🛡️ Filter Specifications
Configure these filters to trigger specific punishments:

| Filter Type | Metric Trigger | Default Actions | Config Key |
| :--- | :--- | :--- | :--- |
| **Invite link** | Presence of discord.gg invite links | `['delete']` | `automod.invite` |
| **External link**| Non-whitelisted domain links | `['delete']` | `automod.link` |
| **Blacklist words**| Blacklisted substring match | `['delete']` | `automod.words` |
| **Mentions** | Exceeding 5 mentions in one message | `['delete']` | `automod.mentions` |
| **Spam** | Exceeding 5 messages in 5 seconds | `['delete', 'timeout']` | `automod.spam` |

### 📈 Escalation Mechanics
Punishments escalate automatically based on repeated warnings:

| Warning Milestone | Punishment Action | Duration |
| :---: | :---: | :---: |
| **3 Warnings** | `timeout` | 1 Hour (3,600,000ms) |
| **5 Warnings** | `kick` | Permanent Kick |

---

## 4. ⚔️ Moderation & Enforcement

Provides moderation commands backed by database case history and auditing logs.

### 🛠️ Moderation Command Actions
| Tool Command | Arguments | System Target | Database Logging |
| :--- | :--- | :--- | :---: |
| `/ban` | `user`, `reason`, `delete_messages` | Target member ban | ✅ Case Created |
| `/kick` | `user`, `reason` | Target member kick | ✅ Case Created |
| `/timeout` | `user`, `duration`, `reason` | Temporarily mute user | ✅ Case Created |
| `/purge` | `amount` | Clear messages from chat | ❌ Logs Only |
| `/usernotes` | `add`, `view`, `remove`, `clear` | Staff-only user profile logs | ✅ Saved to user profile |

---

## 5. 💰 Virtual Economy System

RagnirBot features an active game-like virtual economy.

### 💰 Earning Profiles
| Command | Cooldown | Min Payout | Max Payout | Risk / Consequence |
| :--- | :---: | :---: | :---: | :--- |
| `/work` | 1 hour | $10 | $100 | None (Guaranteed reward) |
| `/beg` | 5 mins | $5 | $50 | None (Low reward) |
| `/daily` | 24 hours | $100 | $100 | None (Daily streak bonuses) |
| `/mine` | 5 mins | Variable | Variable | Low (Tools can break) |
| `/fish` | 5 mins | Variable | Variable | Low (Fish slips away) |
| `/crime` | 1 hour | Variable | Variable | High (Failed crime fines user) |
| `/slut` | 1 hour | Variable | Variable | High (Provocative tasks can cause losses) |
| `/rob` | 1 hour | Variable | Variable | Very High (Rob rate: 40% success; fail results in jail) |

---

## 6. 🎫 Support Ticket System

Enables servers to handle inquiries through private channels created on demand.

### 🎫 Priority Settings
Support tickets can be prioritized using `/priority`:

| Priority Level | Color Embed Indicator | Emoji Tag | Escalation Category |
| :--- | :---: | :---: | :--- |
| **None** | `#95A5A6` (Gray) | ⚪ | Default / Unassigned |
| **Low** | `#2ECC71` (Green) | 🟢 | Standard General |
| **Medium** | `#F1C40F` (Yellow) | 🟡 | Needs Attention |
| **High** | `#E74C3C` (Red) | 🔴 | High priority support |
| **Urgent** | `#E91E63` (Pink) | 🚨 | Immediate action required |

---

## 7. 🎉 Giveaway Management

Host scheduled giveaways with automatic countdowns and verification.

### 📅 Giveaway Configurations
| Setting | Minimum Limit | Maximum Limit | Config Key |
| :--- | :---: | :---: | :--- |
| **Winners** | 1 | 10 | `giveaways.maximumWinners` |
| **Duration** | 5 minutes | 30 days | `giveaways.maximumDuration` |
| **Default Duration**| — | 24 Hours | `giveaways.defaultDuration` |

---

## 8. 🎂 Birthday Tracking & Announcements

Automatically track birthdays and announce celebrations.

### 🎂 Birthday Properties
| Setup Key | Type | Default Value | Purpose |
| :--- | :---: | :---: | :--- |
| `announcementChannel` | Channel ID | `null` | Target channel for birthday announcements |
| `defaultRole` | Role ID | `null` | Role awarded to users on their birthdays |
| `timezone` | String | `"UTC"` | Timezone context for dates |

---

## 9. 👋 Onboarding & Greetings (Welcome/Goodbye)

Customizable onboarding templates automatically assign roles to new members.

### 💬 Welcome Settings & Placeholders
Welcome/Goodbye templates support these placeholders:
*   `{user}`: Mentions the target user.
*   `{server}`: Displays the server name.
*   `{memberCount}`: Shows the server's member count.

| Welcome Key | Default Template | Config Key |
| :--- | :--- | :--- |
| **Welcome** | `"Welcome {user} to {server}! We now have {memberCount} members!"` | `welcome.defaultWelcomeMessage` |
| **Goodbye** | `"{user} has left the server. We now have {memberCount} members."` | `welcome.defaultGoodbyeMessage` |

---

## 10. 📊 Live Server Statistics (Counters)

Dynamic server stats tracked via channel names.

### 🔢 Counters Configuration
| Channel Counter | Target Metric | Update Frequency |
| :--- | :--- | :--- |
| **Total Members** | `guild.memberCount` | Auto updates on join/leave |
| **Human Members** | Humans (Total - Bots) | Auto updates on join/leave |
| **Bots** | Count of all bot accounts | Auto updates on bot join/kick |

---

## 11. 🎙️ Join-to-Create Voice Channels

Auto-generating temporary voice channels.

### 🎙️ Voice Flow
```
[User Joins Setup Voice Channel] ➡️ [RagnirBot Spawns Private Voice Channel] ➡️ [Moves User to New Channel]
                                                                                      ⬇️
[RagnirBot Deletes Voice Channel] ⬅️ [Last User Leaves Spawned Channel] ⬅️ [User Leaves / Channel Empty]
```

---

## 12. 🎭 Reaction Roles

Reaction role panels allow users to self-assign roles using button panels.

| Menu Option | Behavior | Persistence |
| :--- | :--- | :--- |
| **Self-Assign** | Grant chosen role on click | DB Linked |
| **Self-Remove** | Revoke role on click if already assigned | DB Linked |

---

## 13. ✅ Server Verification Gate

A verification gate keeps bad actors and automated spam accounts out of servers.

### 🛡️ Verification Gate Criteria
Configure these gate filters using `/verification dashboard`:

| Criteria Mode | Action Requirement | Target Audience |
| :--- | :--- | :--- |
| `none` | Immediate approval | Verify instantly on button click |
| `account_age` | Age verification | Accounts must be older than specified days (default: 7) |
| `server_size` | Capacity verification | Auto-verify if guild is smaller than limit (default: 1000 members) |

---

## 14. 🛠️ Utility, QoL, & Entertainment Tools

General utility commands for server communities.

### 🛠️ General Utility Catalog
*   **Embed Builder:** Design embed layouts via `/embedbuilder`.
*   **Discord Activities:** Launch voice channel apps:
    *   *Gaming:* Poker, Chess, Checkers, Letter League, SpellCast, Blazing 8s, Putt Party, Land-io, Bobble League.
    *   *Media:* YouTube Watch Together.
*   **Shared Todo Lists:** Share group to-do lists within channels (`/todo share`).

---

## 15. 💬 Complete Slash Command Registry

### 🎂 Birthday Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/birthday` | `set` | Register your birth month and day (1-12, 1-31). |
| | `info` | View birthday information for a user. |
| | `list` | List all birthdays registered in the server. |
| | `remove` | Delete your registered birthday. |
| | `next` | Show upcoming birthdays in the server. |
| | `setchannel` | Set or disable the channel for birthday announcements. |

### 👥 Community Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/app-admin` | `setup` | Set up a new staff application questionnaire. |
| | `review` | Approve or deny a user application. |
| | `list` | List all active applications. |
| | `dashboard` | Open the interactive applications configuration dashboard. |
| `/apply` | `submit` | Submit an application for a staff/community role. |
| | `status` | Check the review status of your application. |
| | `list` | List available applications to apply for. |

### ℹ️ Core Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/help` | — | Displays the interactive help menu with all available commands. |
| `/overview` | — | View a read-only dashboard overview of all active server configurations. |
| `/ping` | — | Measures bot response and heartbeat latency. |
| `/stats` | — | View bot hardware metrics and library information. |
| `/uptime` | — | Check how long the bot has been online. |

### 💰 Economy Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/balance` | — | Check wallet and bank balances for yourself or another user. |
| `/beg` | — | Beg for a small amount of money (cooldown active). |
| `/buy` | — | Purchase a role or item from the shop. |
| `/crime` | — | Commit a crime to earn money (chance of failure and fines). |
| `/daily` | — | Claim your daily cash reward. |
| `/deposit` | — | Deposit money from your wallet into your bank. |
| `/eleaderboard`| — | View the richest users in the server. |
| `/fish` | — | Go fishing to catch fish and earn money. |
| `/gamble` | — | Gamble your wallet coins for a chance to double them. |
| `/inventory` | — | View items currently held in your inventory. |
| `/mine` | — | Mine for minerals to sell and earn money. |
| `/pay` | — | Pay another user some cash from your wallet. |
| `/rob` | — | Attempt to rob another user's wallet. |
| `/shop` | `browse` | Browse the economy shop. |
| | `config` | Configure shop settings and item prices. |
| | `setrole` | Set the Discord role granted when the Premium Role shop item is purchased. |
| `/slut` | — | Take a risky job for a random payout or loss. |
| `/withdraw` | — | Withdraw money from your bank to your wallet. |
| `/work` | — | Perform a standard job to earn money. |

### 🎮 Fun Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/fact` | — | Shares a random, interesting fact. |
| `/fight` | — | Starts a simulated 1v1 text-based battle. |
| `/flip` | — | Flips a coin (Heads or Tails). |
| `/mock` | — | Converts your text to SpongeBob casing (e.g. cOnVeRtS yOuR tExT). |
| `/reverse` | — | Writes your text backwards. |
| `/roll` | — | Rolls dice using standard notation (e.g. 2d20, 1d6 + 5). |
| `/ship` | — | Calculates the compatibility score between two people. |
| `/wanted` | — | Create a custom WANTED poster image for a user. |

### 🎉 Giveaway Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/gcreate` | — | Start a new scheduled giveaway in a specified channel. |
| `/gdelete` | — | Delete an active giveaway using its message ID. |
| `/gend` | — | Immediately end an active giveaway and draw winners. |
| `/greroll` | — | Reroll the winners for an ended giveaway. |

### 🎙️ Join-To-Create Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/jointocreate`| `setup` | Set up a new dynamic voice channel trigger. |
| | `dashboard`| Configure an existing Join-To-Create system. |

### 📊 Leveling Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/leaderboard` | — | View top ranked users by XP and level. |
| `/level` | `setup` | Set up the leveling system and enable it. |
| | `dashboard`| Open the interactive leveling configuration dashboard. |
| `/leveladd` | — | Add levels directly to a target user. |
| `/levelremove`| — | Remove levels from a target user. |
| `/levelset` | — | Set a user's level to a specific value. |
| `/rank` | — | Check your level and XP rank card. |

### 📝 Logging Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/logging` | `dashboard`| Open the interactive logging dashboard (toggle logs categories). |
| | `setup` | Automatically create a dedicated log category and log channels. |
| | `clear` | Delete all bot-created log channels. |
| | `setchannel`| Set the audit log channel for this server manually. |
| | `filter` | Manage the log ignore list (users/channels to skip). |
| | `add` | Add a user or channel to the ignore filter list. |
| | `remove` | Remove a user or channel from the ignore filter list. |

### 🛡️ Moderation Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/automod` | `config` | View the server's current AutoMod configurations. |
| | `toggle` | Enable or disable AutoMod filters globally. |
| | `filter-invite` | Toggle invite filter rules. |
| | `filter-link` | Toggle external link filter rules. |
| | `filter-words` | Toggle blacklisted words filter rules. |
| | `blacklist-word` | Add/remove words from the local blacklist. |
| | `filter-mentions` | Set mass mention limits. |
| | `filter-spam` | Set anti-spam rate limits. |
| | `whitelist-channel` | Add or remove channels from AutoMod whitelist exemptions. |
| | `whitelist-role` | Add or remove roles from AutoMod whitelist exemptions. |
| | `panel` | Open the interactive AutoMod Control Panel dashboard. |
| | `logging` | Set the channel for AutoMod violations logs. |
| | `stats` | Display AutoMod statistics. |
| `/ban` | — | Ban a user from the server with a reason. |
| `/cases` | — | View moderation case history and audit log files. |
| `/dm` | — | Send a direct message to a user as server staff. |
| `/kick` | — | Kick a user from the server with a reason. |
| `/lock` | — | Lock text channel permissions (mute sending messages). |
| `/massban` | — | Ban multiple users simultaneously. |
| `/masskick` | — | Kick multiple users simultaneously. |
| `/purge` | — | Delete a specific quantity of messages from the current channel. |
| `/timeout` | — | Timeout a user for a specific duration. |
| `/unban` | — | Unban a user from the server. |
| `/unlock` | — | Restore message sending permissions to a channel. |
| `/untimeout` | — | Remove an active timeout from a user. |
| `/usernotes` | `add` | Add a moderation note to a user. |
| | `view` | View moderation notes on a user. |
| | `remove` | Remove a specific note from a user's record. |
| | `clear` | Clear all notes on a user. |
| `/warn` | — | Warn a user. |
| `/warnings` | — | View all active warnings for a user. |

### 🎭 Reaction Roles Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/reactroles` | `setup` | Set up a new reaction role selection panel. |
| | `dashboard`| Manage and configure existing reaction role panels. |

### 🔍 Search Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/define` | — | Look up a dictionary word definition. |
| `/google` | — | Search Google for query results. |
| `/movie` | — | Search details for a movie or TV show. |
| `/urban` | — | Search Urban Dictionary for definitions. |

### 🚨 Security Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/anti-nuke` | `enable` | Enable the Anti-Nuke security system. |
| | `disable` | Disable the Anti-Nuke security system. |
| | `logging` | Set the channel for Anti-Nuke security logs. |
| | `whitelist-user` | Whitelist or remove a user from Anti-Nuke event limits. |
| | `whitelist-role` | Whitelist or remove a role from Anti-Nuke event limits. |
| | `whitelist-list` | List all whitelisted users and roles. |
| | `owner-add` | Add an extra owner to designated Anti-Nuke Owners list. |
| | `owner-remove`| Remove an owner from designated Anti-Nuke Owners list. |
| | `owner-list` | List all designated Anti-Nuke Owners. |
| | `panel` | Open the interactive Anti-Nuke Control Panel dashboard. |

### 📈 Server Stats Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/serverstats` | `create` | Create a new statistics tracking voice channel. |
| | `list` | List all statistics trackers for this server. |
| | `update` | Manually force update statistics channels. |
| | `delete` | Delete an active statistics counter channel. |

### 🎫 Ticket Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/claim` | — | Claims an open ticket, assigning it to you. |
| `/close` | — | Closes the current ticket channel. |
| `/priority` | — | Sets the priority level for the current support ticket. |
| `/ticket` | `setup` | Initialize the interactive ticket panel creation. |
| | `dashboard`| Open the interactive ticket system configuration dashboard. |

### 🛠️ Tools Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/baseconvert`| — | Convert numbers between different base systems (binary, octal, hex, decimal). |
| `/calculate` | — | Evaluates a mathematical expression with basic and complex math operations. |
| `/countdown` | — | Starts a visual countdown timer. |
| `/embedbuilder`| — | Open the interactive embed builder dashboard. |
| `/generatepassword`| — | Generate a secure, random password. |
| `/hexcolor` | — | Generate a random hex color code with visual embed preview. |
| `/poll` | — | Create a simple poll with up to 10 options. |
| `/randomuser` | — | Select a random member from the current server guild. |
| `/shorten` | — | Shorten any URL using the is.gd service. |
| `/time` | — | Get the current time in different timezones. |
| `/unixtime` | — | Get the current Unix timestamp format. |

### 🔧 Utility Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/avatar` | — | View your avatar or another member's avatar image. |
| `/firstmsg` | — | Get a link to the very first message sent in this channel. |
| `/report` | `file` | Submit a report about a user to server staff. |
| | `setchannel`| Configure the channel where user reports are sent. |
| `/serverinfo` | — | Get detailed information and stats about the server. |
| `/todo` | `add` | Add a personal task to your to-do list. |
| | `list` | View your personal to-do list. |
| | `complete`| Mark a personal task as completed. |
| | `remove` | Delete a task from your to-do list. |
| | `share` | Manage shared to-do lists. |
| | `create` | Create a new shared to-do list. |
| | `add` | Add a member to a shared list. |
| | `view` | View a shared to-do list. |
| | `addtask` | Add a task to a shared list. |
| | `remove` | Remove a task from a shared list. |
| `/userinfo` | — | Get detailed information and profile details about a user. |
| `/weather` | — | Retrieve real-time weather information for any location. |
| `/wipedata` | — | Permenently wipe all your personal data stored by the bot. |

### ✅ Verification Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/verification`| `setup` | Set up the server verification button panel. |
| | `remove` | Remove verification status from a member. |
| | `dashboard`| Open the verification system configuration dashboard. |
| `/verify` | — | Verify yourself manually to gain access. |

### 🎙️ Voice Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/activity` | `youtube` / `poker` / `chess` / `checkers` / `letter-league` / `spellcast` / `sketch` / `blazing8s` / `puttparty` / `landio` / `bobble` / `knowwhat` | Launch custom Discord interactive Activities in your voice channel. |

### 👋 Welcome Module
| Command | Subcommand | Description |
| :--- | :--- | :--- |
| `/autorole` | `add` | Register a role to be auto-assigned to new members. |
| | `remove` | Remove a role from the auto-assignment list. |
| | `list` | List all auto-assigned roles. |
| `/goodbye` | `setup` | Set up the goodbye greeting message systems. |
| `/greet` | `dashboard`| Open the welcome & goodbye configuration dashboard. |
| `/welcome` | `setup` | Set up the welcome greeting message systems. |
