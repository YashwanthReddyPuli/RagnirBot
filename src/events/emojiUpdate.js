import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: 'emojiUpdate',
    async execute(oldEmoji, newEmoji) {
        const { guild } = newEmoji;
        if (!guild) return;

        try {
            const executor = await AntiNukeService.resolveExecutor(guild, AuditLogEvent.EmojiUpdate, newEmoji.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(guild, executor, 'emojiUpdate');
                if (triggered) {
                    await newEmoji.edit({
                        name: oldEmoji.name,
                        reason: '[Anti-Nuke Rollback] Unauthorized emoji update'
                    }).catch(err => {
                        logger.error(`Failed to revert emoji update for ${newEmoji.name}:`, err);
                    });
                }
            }
        } catch (error) {
            logger.error(`Error in emojiUpdate anti-nuke check:`, error);
        }
    }
};
