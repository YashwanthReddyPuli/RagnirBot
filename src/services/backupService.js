import { ChannelType } from 'discord.js';
import { pgDb } from '../utils/postgresDatabase.js';
import { logger } from '../utils/logger.js';

const generateBackupId = () => {
    return 'rg-' + Math.random().toString(36).substring(2, 10).toUpperCase();
};

export class BackupService {
    /**
     * Create a backup snapshot of a guild
     */
    static async createBackup(guild, creatorId, backupName = null) {
        try {
            const backupId = generateBackupId();
            const defaultName = backupName || `${guild.name} Backup`;

            // 1. Gather Roles (exclude @everyone, managed integrations, and bot's own roles)
            const roles = guild.roles.cache
                .filter(r => r.id !== guild.id && !r.managed && r.editable)
                .map(r => ({
                    id: r.id,
                    name: r.name,
                    color: r.color,
                    hoist: r.hoist,
                    permissions: r.permissions.bitfield.toString(),
                    mentionable: r.mentionable,
                    position: r.position
                }));

            // 2. Gather Categories
            const categories = guild.channels.cache
                .filter(c => c.type === ChannelType.GuildCategory)
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    position: c.position,
                    permissionOverwrites: c.permissionOverwrites.cache.map(o => ({
                        id: o.id,
                        type: o.type,
                        allow: o.allow.bitfield.toString(),
                        deny: o.deny.bitfield.toString()
                    }))
                }));

            // 3. Gather Channels
            const channels = guild.channels.cache
                .filter(c => 
                    c.type !== ChannelType.GuildCategory && 
                    c.type !== ChannelType.GuildDirectory && 
                    c.type !== ChannelType.GuildForum && 
                    c.type !== ChannelType.GuildStageVoice &&
                    !c.isThread()
                )
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    position: c.position,
                    topic: c.topic || null,
                    nsfw: c.nsfw || false,
                    rateLimitPerUser: c.rateLimitPerUser || 0,
                    parentCategoryId: c.parentId || null,
                    permissionOverwrites: c.permissionOverwrites.cache.map(o => ({
                        id: o.id,
                        type: o.type,
                        allow: o.allow.bitfield.toString(),
                        deny: o.deny.bitfield.toString()
                    }))
                }));

            const backupData = {
                guildName: guild.name,
                roles,
                categories,
                channels
            };

            // 4. Save to PostgreSQL
            await pgDb.pool.query(
                `INSERT INTO guild_backups (id, guild_id, backup_name, data, created_by)
                 VALUES ($1, $2, $3, $4, $5)`,
                [backupId, guild.id, defaultName, JSON.stringify(backupData), creatorId]
            );

            logger.info(`Backup ${backupId} created for guild ${guild.id} by ${creatorId}`);

            return {
                success: true,
                backupId,
                name: defaultName,
                rolesCount: roles.length,
                channelsCount: channels.length + categories.length
            };
        } catch (error) {
            logger.error('Error creating backup:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Retrieve a specific backup
     */
    static async getBackup(backupId) {
        try {
            const result = await pgDb.pool.query(
                'SELECT * FROM guild_backups WHERE id = $1',
                [backupId]
            );
            if (result.rows.length === 0) return null;
            return result.rows[0];
        } catch (error) {
            logger.error(`Error fetching backup ${backupId}:`, error);
            return null;
        }
    }

    /**
     * List all backups in a guild
     */
    static async listBackups(guildId) {
        try {
            const result = await pgDb.pool.query(
                'SELECT id, backup_name, created_by, created_at FROM guild_backups WHERE guild_id = $1 ORDER BY created_at DESC',
                [guildId]
            );
            return result.rows;
        } catch (error) {
            logger.error(`Error listing backups for guild ${guildId}:`, error);
            return [];
        }
    }

    /**
     * Delete a backup
     */
    static async deleteBackup(backupId) {
        try {
            const result = await pgDb.pool.query(
                'DELETE FROM guild_backups WHERE id = $1 RETURNING id',
                [backupId]
            );
            return result.rows.length > 0;
        } catch (error) {
            logger.error(`Error deleting backup ${backupId}:`, error);
            return false;
        }
    }

    /**
     * Restore a guild to a backup snapshot state
     */
    static async restoreBackup(guild, backupId) {
        try {
            const backup = await this.getBackup(backupId);
            if (!backup) {
                return { success: false, error: 'Backup not found' };
            }

            const backupData = backup.data;

            // 1. Delete all current channels (safe iteration)
            const deletableChannels = guild.channels.cache.filter(c => c.deletable);
            for (const channel of deletableChannels.values()) {
                try {
                    await channel.delete();
                } catch (err) {
                    logger.warn(`Could not delete channel ${channel.name}: ${err.message}`);
                }
            }

            // 2. Delete all current custom roles (exclude @everyone, managed integrations, and bot roles)
            const deletableRoles = guild.roles.cache.filter(r => r.id !== guild.id && !r.managed && r.editable);
            for (const role of deletableRoles.values()) {
                try {
                    await role.delete();
                } catch (err) {
                    logger.warn(`Could not delete role ${role.name}: ${err.message}`);
                }
            }

            // 3. Recreate Custom Roles
            const roleMap = new Map();
            const sortedRoles = (backupData.roles || []).sort((a, b) => a.position - b.position);
            for (const roleData of sortedRoles) {
                try {
                    const newRole = await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color,
                        hoist: roleData.hoist,
                        permissions: BigInt(roleData.permissions),
                        mentionable: roleData.mentionable
                    });
                    roleMap.set(roleData.id, newRole.id);
                } catch (err) {
                    logger.error(`Failed to recreate role ${roleData.name}:`, err);
                }
            }

            // 4. Recreate Categories
            const categoryMap = new Map();
            const sortedCategories = (backupData.categories || []).sort((a, b) => a.position - b.position);
            for (const catData of sortedCategories) {
                try {
                    const newCat = await guild.channels.create({
                        name: catData.name,
                        type: ChannelType.GuildCategory,
                        position: catData.position
                    });
                    categoryMap.set(catData.id, newCat.id);
                } catch (err) {
                    logger.error(`Failed to recreate category ${catData.name}:`, err);
                }
            }

            // 5. Recreate Channels (Text, Voice, News)
            const sortedChannels = (backupData.channels || []).sort((a, b) => a.position - b.position);
            const channelMap = new Map();
            for (const chanData of sortedChannels) {
                try {
                    const parentId = chanData.parentCategoryId ? categoryMap.get(chanData.parentCategoryId) : null;
                    const newChan = await guild.channels.create({
                        name: chanData.name,
                        type: chanData.type,
                        topic: chanData.topic,
                        nsfw: chanData.nsfw,
                        rateLimitPerUser: chanData.rateLimitPerUser,
                        parent: parentId,
                        position: chanData.position
                    });
                    channelMap.set(chanData.id, newChan.id);
                } catch (err) {
                    logger.error(`Failed to recreate channel ${chanData.name}:`, err);
                }
            }

            // 6. Apply Category Permission Overwrites
            for (const catData of (backupData.categories || [])) {
                const newCatId = categoryMap.get(catData.id);
                if (!newCatId) continue;
                const newCat = guild.channels.cache.get(newCatId);
                if (!newCat) continue;

                try {
                    const overwrites = (catData.permissionOverwrites || []).map(o => {
                        let targetId = o.id;
                        // Map old role ID to new role ID (or use new guild.id if old id matched old guild ID i.e. @everyone)
                        if (o.type === 0 || o.type === 'role') {
                            targetId = roleMap.get(o.id) || (o.id === backup.guild_id ? guild.id : o.id);
                        }
                        return {
                            id: targetId,
                            type: o.type,
                            allow: BigInt(o.allow),
                            deny: BigInt(o.deny)
                        };
                    });
                    if (overwrites.length > 0) {
                        await newCat.permissionOverwrites.set(overwrites);
                    }
                } catch (err) {
                    logger.error(`Failed to restore category overwrites for ${catData.name}:`, err);
                }
            }

            // 7. Apply Channel Permission Overwrites
            for (const chanData of (backupData.channels || [])) {
                const newChanId = channelMap.get(chanData.id);
                if (!newChanId) continue;
                const newChan = guild.channels.cache.get(newChanId);
                if (!newChan) continue;

                try {
                    const overwrites = (chanData.permissionOverwrites || []).map(o => {
                        let targetId = o.id;
                        if (o.type === 0 || o.type === 'role') {
                            targetId = roleMap.get(o.id) || (o.id === backup.guild_id ? guild.id : o.id);
                        }
                        return {
                            id: targetId,
                            type: o.type,
                            allow: BigInt(o.allow),
                            deny: BigInt(o.deny)
                        };
                    });
                    if (overwrites.length > 0) {
                        await newChan.permissionOverwrites.set(overwrites);
                    }
                } catch (err) {
                    logger.error(`Failed to restore channel overwrites for ${chanData.name}:`, err);
                }
            }

            logger.info(`Backup ${backupId} successfully restored in guild ${guild.id}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error restoring backup ${backupId}:`, error);
            return { success: false, error: error.message };
        }
    }
}
