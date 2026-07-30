import { Events } from 'discord.js';

export default {
    name: Events.InviteDelete,
    once: false,
    execute(invite, client) {
        if (!invite.guild) return;
        const guildInvites = client.invites.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.delete(invite.code);
        }
    }
};
