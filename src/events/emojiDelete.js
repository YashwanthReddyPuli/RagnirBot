import { AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger.js';
import { AntiNukeService } from '../services/antiNukeService.js';

export default {
    name: 'emojiDelete',
    async execute(emoji) {
        const { guild } = emoji;
        if (!guild) return;

        try {
            const executor = await AntiNukeService.resolveExecutor(guild, AuditLogEvent.EmojiDelete, emoji.id);
            if (executor) {
                const triggered = await AntiNukeService.checkAction(guild, executor, 'emojiDelete');
                if (triggered) {
                    await guild.emojis.create({
                        attachment: emoji.url,
                        name: emoji.name,
                        reason: '[Anti-Nuke Rollback] Unauthorized emoji deletion'
                    }).catch(err => {
                        logger.error(`Failed to recreate emoji ${emoji.name} during rollback:`, err);
                    });
                }
            }
        } catch (error) {
            logger.error(`Error in emojiDelete anti-nuke check:`, error);
        }
    }
};
