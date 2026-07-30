import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { getGuildConfig, setGuildConfig } from '../services/guildConfig.js';
import { BackupService } from '../services/backupService.js';
import { logger } from '../utils/logger.js';

export default (client) => {
    const router = express.Router();

    // 1. JWT Authentication Middleware
    const authMiddleware = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }
        
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.DASHBOARD_SECRET || 'ragnir_jwt_fallback_secret');
            req.user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Unauthorized: Token is invalid or expired' });
        }
    };

    // 2. Admin Guild Authorization Middleware
    const adminGuildMiddleware = (req, res, next) => {
        const { guildId } = req.params;
        if (!guildId) {
            return res.status(400).json({ error: 'Bad Request: Missing guild ID' });
        }

        const userAdminGuilds = req.user.adminGuilds || [];
        if (!userAdminGuilds.includes(guildId)) {
            return res.status(403).json({ error: 'Forbidden: You do not have administrator rights on this server' });
        }
        
        next();
    };

    // --- ENDPOINTS ---

    // OAuth2 Login / Code Exchange
    router.post('/auth/login', async (req, res) => {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Missing OAuth authorization code' });
        }

        try {
            const clientId = process.env.CLIENT_ID;
            const clientSecret = process.env.CLIENT_SECRET;
            const redirectUri = process.env.REDIRECT_URI;

            if (!clientId || !clientSecret || !redirectUri) {
                logger.error('OAuth credentials missing from environment variables.');
                return res.status(500).json({ error: 'OAuth setup incomplete on bot server.' });
            }

            // Exchange OAuth2 code for access token
            const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri
            }).toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const accessToken = tokenResponse.data.access_token;

            // Fetch user profile
            const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            // Fetch user guilds
            const guildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            // Filter guilds for Administrator permission (0x8 / 1 << 3)
            const ADMIN_PERMISSION = 0x8;
            const adminGuilds = guildsResponse.data
                .filter(g => (BigInt(g.permissions) & BigInt(ADMIN_PERMISSION)) === BigInt(ADMIN_PERMISSION))
                .map(g => g.id);

            // Generate user session JWT
            const token = jwt.sign({
                id: userResponse.data.id,
                username: userResponse.data.username,
                discriminator: userResponse.data.discriminator,
                avatar: userResponse.data.avatar,
                adminGuilds
            }, process.env.DASHBOARD_SECRET || 'ragnir_jwt_fallback_secret', { expiresIn: '7d' });

            res.json({
                token,
                user: {
                    id: userResponse.data.id,
                    username: userResponse.data.username,
                    avatar: userResponse.data.avatar
                }
            });
        } catch (error) {
            logger.error('OAuth login failed:', error.response?.data || error.message);
            res.status(500).json({ error: 'OAuth login code exchange failed' });
        }
    });

    // List all guilds where user is administrator
    router.get('/user/guilds', authMiddleware, async (req, res) => {
        try {
            const adminGuilds = req.user.adminGuilds || [];
            const guilds = adminGuilds.map(guildId => {
                const guildObj = client.guilds.cache.get(guildId);
                return {
                    id: guildId,
                    name: guildObj ? guildObj.name : 'Unknown Server',
                    icon: guildObj ? guildObj.icon : null,
                    botPresent: !!guildObj
                };
            });
            
            res.json(guilds);
        } catch (error) {
            logger.error('Error fetching user guilds:', error.message);
            res.status(500).json({ error: 'Failed to fetch guilds' });
        }
    });

    // Fetch server configuration
    router.get('/guilds/:guildId/config', authMiddleware, adminGuildMiddleware, async (req, res) => {
        try {
            const config = await getGuildConfig(client, req.params.guildId);
            res.json(config);
        } catch (error) {
            logger.error(`Error fetching config for guild ${req.params.guildId}:`, error.message);
            res.status(500).json({ error: 'Failed to fetch configuration' });
        }
    });

    // Save server configuration
    router.post('/guilds/:guildId/config', authMiddleware, adminGuildMiddleware, async (req, res) => {
        try {
            const result = await setGuildConfig(client, req.params.guildId, req.body);
            res.json({ success: true, config: result });
        } catch (error) {
            logger.error(`Error saving config for guild ${req.params.guildId}:`, error.message);
            res.status(500).json({ error: 'Failed to save configuration' });
        }
    });

    // Fetch guild backups list
    router.get('/guilds/:guildId/backups', authMiddleware, adminGuildMiddleware, async (req, res) => {
        try {
            const backups = await BackupService.listBackups(req.params.guildId);
            res.json(backups);
        } catch (error) {
            logger.error(`Error fetching backups for guild ${req.params.guildId}:`, error.message);
            res.status(500).json({ error: 'Failed to fetch backups' });
        }
    });

    // Create a new backup via API
    router.post('/guilds/:guildId/backups', authMiddleware, adminGuildMiddleware, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Bot is not present in this guild' });
            }

            const { name } = req.body;
            const result = await BackupService.createBackup(guild, req.user.id, name);
            if (!result.success) {
                return res.status(500).json({ error: result.error });
            }

            res.json(result);
        } catch (error) {
            logger.error(`Error creating backup for guild ${req.params.guildId}:`, error.message);
            res.status(500).json({ error: 'Failed to create backup' });
        }
    });

    // Restore a server backup
    router.post('/guilds/:guildId/backups/:backupId/restore', authMiddleware, adminGuildMiddleware, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Bot is not present in this guild' });
            }

            const { backupId } = req.params;
            const backup = await BackupService.getBackup(backupId);
            if (!backup || backup.guild_id !== req.params.guildId) {
                return res.status(404).json({ error: 'Backup not found for this server' });
            }

            // Run restoration asynchronously as it deletes and recreates all channels (slow)
            BackupService.restoreBackup(guild, backupId)
                .then(result => {
                    if (!result.success) {
                        logger.error(`Restoration failed for guild ${guild.name} via API:`, result.error);
                    } else {
                        logger.info(`Restoration completed successfully for guild ${guild.name} via API`);
                    }
                })
                .catch(err => {
                    logger.error(`Restoration process crashed for guild ${guild.name}:`, err);
                });

            res.json({ success: true, message: 'Restoration process started in the background.' });
        } catch (error) {
            logger.error(`Error restoring backup for guild ${req.params.guildId}:`, error.message);
            res.status(500).json({ error: 'Failed to restore backup' });
        }
    });

    return router;
};
