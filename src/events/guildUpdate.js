import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: 'guildUpdate',
    async execute(oldGuild, newGuild) {
        try {
            const executor = await AntiNukeService.resolveExecutor(newGuild, AuditLogEvent.GuildUpdate, newGuild.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(newGuild, executor, 'serverUpdate');
                if (triggered) {
                    // Revert changes
                    await newGuild.edit({
                        name: oldGuild.name,
                        icon: oldGuild.iconURL(),
                        systemChannel: oldGuild.systemChannel,
                        rulesChannel: oldGuild.rulesChannel,
                        publicUpdatesChannel: oldGuild.publicUpdatesChannel,
                        preferredLocale: oldGuild.preferredLocale,
                        features: oldGuild.features,
                        reason: '[Anti-Nuke Rollback] Unauthorized server update'
                    }).catch(err => {
                        logger.error(`Failed to revert guild update:`, err);
                    });
                }
            }
        } catch (error) {
            logger.error(`Error in guildUpdate anti-nuke check:`, error);
        }
    }
};
