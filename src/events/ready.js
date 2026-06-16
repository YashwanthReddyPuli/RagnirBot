import { Events } from "discord.js";
import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";
import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      client.user.setPresence(config.bot.presence);

      startupLog(`Ready! Logged in as ${client.user.tag}`);
      startupLog(`Serving ${client.guilds.cache.size} guild(s)`);
      startupLog(`Loaded ${client.commands.size} commands`);

      const reconciliationSummary = await reconcileReactionRoleMessages(client);
      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );

      // Send owner confirmation DM to the new owner
      try {
        const ownerId = "1508399186364858508";
        const ownerUser = await client.users.fetch(ownerId);
        if (ownerUser) {
          await ownerUser.send("i am now owner");
          startupLog(`Sent owner confirmation DM to ${ownerUser.tag} (${ownerId})`);
        } else {
          logger.warn(`Could not fetch owner user with ID ${ownerId}`);
        }
      } catch (dmError) {
        logger.error(`Error sending DM to owner: ${dmError.message}`);
      }
    } catch (error) {
      logger.error("Error in ready event:", error);
    }
  },
};


