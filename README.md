# RagnirBot - Ultimate Discord Bot

**RagnirBot** is a powerful, feature-rich Discord bot designed to enhance your server experience with comprehensive moderation tools, engaging economy systems, utility features, and much more. Built with modern Discord.js v14 and PostgreSQL for optimal performance and data persistence.

## Table of Contents

- [Features Overview](#features-overview)
- [Quick Setup](#quick-setup)
- [Manual Installation Steps](#manual-installation-steps)
- [Required Bot Intents](#bot-intents)
- [Contributing](#contributing)

<a name="features-overview"></a>
## Features Overview

RagnirBot offers a complete suite of tools for Discord server management and community engagement:

<table>
<tr>
<td width="50%" valign="top">

### Moderation & Administration
- **Mass Actions** - Bulk ban/kick capabilities
- **User Notes** - Keep detailed moderation records
- **Case Management** - View and track all mod actions

### Economy System
- **Shop & Inventory** - Buy and manage items
- **Gambling** - Risk it for rewards
- **Pay System** - Transfer money between users

### Fun & Entertainment
- **Random Facts** - Learn something new
- **Wanted Poster** - Create fun wanted images
- **Text Reversal** - Reverse any text

### Advanced Ticket System
- **Claim & Priority** - Staff ticket management
- **Ticket Limits** - Prevent spam
- **Transcript System** - Save ticket history

### Server Stats
- **Member Counter** - Live member count channels
- **Voice Counters** - Track voice stats
- **Dynamic Updates** - Real-time channel updates

### Reaction Roles
- **Role Assignment** - Self-assignable roles
- **Emoji Selection** - Reaction-based system
- **Multi-role Support** - Multiple role options

</td>
<td width="50%" valign="top">

### Leveling & XP System
- **XP Tracking** - Message-based XP
- **Level Roles** - Auto-assign roles by level
- **Custom Configuration** - Personalize leveling

### Giveaways & Events
- **Multiple Winners** - Support multi-winner giveaways
- **Auto Picking** - Automatic winner selection
- **Reroll System** - Pick new winners if needed

### Birthday System
- **Birthday Tracking** - Never miss a birthday
- **Auto Announcements** - Celebrate automatically
- **Timezone Support** - Accurate worldwide tracking

### Utility Tools
- **Report System** - Report issues to staff
- **Todo Lists** - Personal task management
- **First Message** - Jump to channel's first message

### Welcome System
- **Welcome Messages** - Greet new members
- **Auto Roles** - Assign roles on join
- **Custom Embeds** - Personalized messages

</td>
</tr>
</table>

<a name="quick-setup"></a>
## Quick Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YashwanthReddyPuli/RagnirBot.git
   cd RagnirBot
   ```

2. **Configure environment variables:**
   Create a `.env` file from `.env.example` and fill in your bot details and PostgreSQL credentials.

3. **Start the application** using Node or Docker.

<a name="web-dashboard"></a>
## 🌐 High-Fidelity Web Dashboard

RagnirBot features a state-of-the-art administrative web dashboard with a premium obsidian-dark styling, crimson-red glows, and glowing liquid backdrops.

### Dashboard Core Modules
- **Core Statistics & Lockdown**: Fast server stats overview and Raid Emergency Lockdown.
- **Security Control Centre**: Custom threshold configuration panels for Anti-Nuke logs and actions.
- **Automod Filters**: Customize domains blocklist, swearing lists, spam settings, and trigger warnings.
- **Onboarding Gates**: Captcha/Bypass Verification rules, personalized premium Welcome embed designers, and Leave messages.
- **Role & Voice Automation**: Select Auto Roles with delays, build Reaction Role message buttons, and launch temporary voice hub (j2c) channels.
- **Giveaway Manager**: Schedule, monitor, and reroll giveaways directly from the browser.
- **Server Backups Ledger**: Take manual structural snapshots and restore complete server frameworks.

### Setup & Run Dashboard Locally

1. Navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser to access the panel.

<a name="manual-installation-steps"></a>
## Manual Installation Steps

### Prerequisites
- Node.js 18.0.0 or higher
- PostgreSQL database

1. **Clone the Repository**
   ```bash
   git clone https://github.com/YashwanthReddyPuli/RagnirBot.git
   cd RagnirBot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration.

4. **Start the Bot**
   ```bash
   npm start
   ```

<a name="bot-intents"></a>
## Required Bot Intents
RagnirBot requires the following Discord intents:
- **Guilds**
- **Guild Messages**
- **Message Content**
- **Guild Members**
- **Guild Message Reactions**
- **Guild Voice States**
- **Direct Messages**
- **Bot**
- **Applications.commands**

## ℹ️ General Commands & Dynamic Argument Resolving

RagnirBot supports highly intuitive and smart argument resolution for all prefix/no-prefix commands (e.g., `;banner yash`, `;avatar moderator`, `;logging config`). You do not need to copy user IDs or type raw mentions:
* **Users & Members**: Resolve by typing partial usernames, display names, server nicknames (case-insensitive), or mentioning them.
* **Roles**: Resolve by typing partial role names or mentioning the role.
* **Channels**: Resolve by typing partial channel names or mentioning the channel.

### 📋 General Command Suite
| Command | Slash Command | Prefix Version | Description |
|---|---|---|---|
| **AFK Status** | `/afk [reason]` | `;afk [reason]` | Go AFK with nick prefixing and auto-mentions notification. |
| **User Avatar** | `/avatar [user]` | `;avatar [user]` | View high-res avatar of any server member. |
| **Profile Banner** | `/banner [user]` | `;banner [user]` | View profile banner image. |
| **Server Banner** | `/serverbanner` | `;serverbanner` | View server's custom banner image. |
| **Bot Stats** | `/botinfo` | `;botinfo` | Displays bot platform host metrics, RAM, and server sizes. |
| **Latency** | `/ping` | `;ping` | Check websocket API latency and bot response delay. |
| **Uptime** | `/uptime` | `;uptime` | Check process online duration. |
| **User Information** | `/userinfo [user]` | `;userinfo [user]` | Inspect detailed user metadata, joined date, roles list, etc. |
| **Server Information** | `/serverinfo` | `;serverinfo` | View guild creation stats, owner tag, premium boosts, etc. |
| **Member Counts** | `/membercount` | `;membercount` | Show user count breakdown (humans, bots, total). |
| **Server Lists** | `/list [bots/boosters]` | `;list [bots/boosters]` | Lists all bots or active server boosters. |

### ⚙️ Module Configuration Inspectors
Administrators with management permissions can inspect database configuration logs directly inside the server by executing:
* **Anti-Nuke Protection**: `;antinuke config` / `/anti-nuke config`
* **Audit Logs Routing**: `;logging config` / `/logging config`
* **Onboarding Greet**: `;welcome config` / `/welcome config`
* **Onboarding Goodbye**: `;goodbye config` / `/goodbye config`
* **Support Tickets Hub**: `;ticket config` / `/ticket config`
* **Auto-Moderator Filters**: `;automod config` / `/automod config`
* **Temporary Voice Hub (JTC)**: `;jointocreate config` / `/jointocreate config`
* **Onboarding Verification Gate**: `;verification config` / `/verification config`
* **Leveling Rewards System**: `;leveling config` / `/leveling config`

## License

RagnirBot is released under the MIT License. See [LICENSE](LICENSE) for details.
