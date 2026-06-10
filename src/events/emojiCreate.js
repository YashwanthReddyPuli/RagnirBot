import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: 'emojiCreate',
    async execute(emoji) {
        const { guild } = emoji;
        if (!guild) return;

        try {
            const executor = await AntiNukeService.resolveExecutor(guild, AuditLogEvent.EmojiCreate, emoji.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(guild, executor, 'emojiCreate');
                if (triggered) {
                    await emoji.delete('[Anti-Nuke Rollback] Unauthorized emoji creation').catch(err => {
                        logger.error(`Failed to delete emoji ${emoji.name} during rollback:`, err);
                    });
                }
            }
        } catch (error) {
            logger.error(`Error in emojiCreate anti-nuke check:`, error);
        }
    }
};
