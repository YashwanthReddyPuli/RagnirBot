import { z } from 'zod';
import { createError, ErrorTypes } from './errorHandler.js';

export const LogIgnoreSchema = z
  .object({
    users: z.array(z.string()).default([]),
    channels: z.array(z.string()).default([])
  })
  .default({ users: [], channels: [] });

export const LoggingConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    channelId: z.string().nullable().optional(),
    enabledEvents: z.record(z.boolean()).default({})
  })
  .default({ enabled: false, enabledEvents: {} });

const TicketLoggingSchema = z
  .object({
    lifecycleChannelId: z.string().nullable().optional(),
    transcriptChannelId: z.string().nullable().optional()
  })
  .optional();

const AutoVerifyConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    criteria: z.enum(['account_age', 'server_size', 'none']).default('none'),
    accountAgeDays: z.number().int().min(1).max(365).nullable().optional(),
    roleId: z.string().nullable().optional()
  })
  .optional();

const VerificationConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    channelId: z.string().nullable().optional(),
    messageId: z.string().nullable().optional(),
    roleId: z.string().optional(),
    message: z.string().optional(),
    buttonText: z.string().default('Verify'),
    autoVerify: AutoVerifyConfigSchema
  })
  .optional();

const AntiNukeSettingSchema = z.object({
  limit: z.number().int().min(1).default(3),
  timeframe: z.number().int().min(1000).default(15000),
  action: z.enum(['ban', 'kick', 'demote', 'none']).default('demote')
});

const AntiNukeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  logChannelId: z.string().nullable().optional(),
  extraOwners: z.array(z.string()).default([]),
  whitelistedUsers: z.record(z.union([z.boolean(), z.array(z.string())])).default({}),
  whitelistedRoles: z.record(z.union([z.boolean(), z.array(z.string())])).default({}),
  settings: z.record(AntiNukeSettingSchema).optional()
}).optional();

const WarningEscalationRuleSchema = z.object({
  warnCount: z.number().int().min(1),
  action: z.enum(['timeout', 'kick', 'ban', 'none']),
  durationMs: z.number().int().min(0).default(3600000)
});

const AutoModConfigSchema = z.object({
  enabled: z.boolean().default(false),
  logChannelId: z.string().nullable().optional(),
  ignoredChannels: z.array(z.string()).default([]),
  ignoredRoles: z.array(z.string()).default([]),
  timeoutDuration: z.number().int().min(1000).default(600000),
  escalation: z.object({
    enabled: z.boolean().default(false),
    rules: z.array(WarningEscalationRuleSchema).default([
      { warnCount: 3, action: 'timeout', durationMs: 3600000 },
      { warnCount: 5, action: 'kick', durationMs: 0 }
    ])
  }).default({
    enabled: false,
    rules: [
      { warnCount: 3, action: 'timeout', durationMs: 3600000 },
      { warnCount: 5, action: 'kick', durationMs: 0 }
    ]
  }),
  invite: z.object({
    enabled: z.boolean().default(false),
    actions: z.array(z.enum(['delete', 'warn', 'timeout'])).default(['delete']),
    ignoredChannels: z.array(z.string()).default([]),
    ignoredRoles: z.array(z.string()).default([])
  }).default({ enabled: false, actions: ['delete'], ignoredChannels: [], ignoredRoles: [] }),
  link: z.object({
    enabled: z.boolean().default(false),
    actions: z.array(z.enum(['delete', 'warn', 'timeout'])).default(['delete']),
    ignoredChannels: z.array(z.string()).default([]),
    ignoredRoles: z.array(z.string()).default([]),
    whitelist: z.array(z.string()).default([]),
    blacklist: z.array(z.string()).default([])
  }).default({ enabled: false, actions: ['delete'], ignoredChannels: [], ignoredRoles: [], whitelist: [], blacklist: [] }),
  words: z.object({
    enabled: z.boolean().default(false),
    actions: z.array(z.enum(['delete', 'warn', 'timeout'])).default(['delete']),
    list: z.array(z.string()).default([]),
    ignoredChannels: z.array(z.string()).default([]),
    ignoredRoles: z.array(z.string()).default([])
  }).default({ enabled: false, actions: ['delete'], list: [], ignoredChannels: [], ignoredRoles: [] }),
  mentions: z.object({
    enabled: z.boolean().default(false),
    limit: z.number().int().min(1).default(5),
    actions: z.array(z.enum(['delete', 'warn', 'timeout'])).default(['delete']),
    ignoredChannels: z.array(z.string()).default([]),
    ignoredRoles: z.array(z.string()).default([])
  }).default({ enabled: false, limit: 5, actions: ['delete'], ignoredChannels: [], ignoredRoles: [] }),
  spam: z.object({
    enabled: z.boolean().default(false),
    limit: z.number().int().min(1).default(5),
    timeframe: z.number().int().min(1000).default(5000),
    actions: z.array(z.enum(['delete', 'warn', 'timeout'])).default(['delete', 'timeout']),
    ignoredChannels: z.array(z.string()).default([]),
    ignoredRoles: z.array(z.string()).default([])
  }).default({ enabled: false, limit: 5, timeframe: 5000, actions: ['delete', 'timeout'], ignoredChannels: [], ignoredRoles: [] })
}).optional();

export const GuildConfigSchema = z
  .object({
    prefix: z.string().optional(),
    modRole: z.string().nullable().optional(),
    adminRole: z.string().nullable().optional(),
    logChannelId: z.string().nullable().optional(),
    welcomeChannel: z.string().nullable().optional(),
    welcomeMessage: z.string().optional(),
    autoRole: z.string().nullable().optional(),
    dmOnClose: z.boolean().optional(),
    reportChannelId: z.string().nullable().optional(),
    birthdayChannelId: z.string().nullable().optional(),
    premiumRoleId: z.string().nullable().optional(),
    logIgnore: LogIgnoreSchema.optional(),
    enabledCommands: z.record(z.boolean()).optional(),
    logging: LoggingConfigSchema.optional(),
    ticketLogging: TicketLoggingSchema.optional(),
    enableLogging: z.boolean().optional(),
    verification: VerificationConfigSchema,
    antinuke: AntiNukeConfigSchema,
    automod: AutoModConfigSchema
  })
  .passthrough();


export const EconomyDataSchema = z
  .object({
    wallet: z.number().nonnegative().default(0),
    bank: z.number().nonnegative().default(0),
    bankLevel: z.number().int().nonnegative().default(0),
    dailyStreak: z.number().int().nonnegative().default(0),
    lastDaily: z.number().int().nonnegative().default(0),
    lastWeekly: z.number().int().nonnegative().default(0),
    lastWork: z.number().int().nonnegative().default(0),
    lastCrime: z.number().int().nonnegative().default(0),
    lastRob: z.number().int().nonnegative().default(0),
    lastDeposit: z.number().int().nonnegative().default(0),
    lastWithdraw: z.number().int().nonnegative().default(0),
    xp: z.number().int().nonnegative().default(0),
    level: z.number().int().nonnegative().default(1),
    inventory: z.record(z.any()).default({}),
    cooldowns: z.record(z.number().int().nonnegative()).default({})
  })
  .passthrough();

export function normalizeGuildConfig(raw, defaults = {}) {
  const base = typeof raw === 'object' && raw !== null ? raw : {};
  const merged = { ...defaults, ...base };
  const parsed = GuildConfigSchema.safeParse(merged);
  return parsed.success ? parsed.data : { ...defaults, ...base };
}

export function normalizeEconomyData(raw, defaults = {}) {
  const base = typeof raw === 'object' && raw !== null ? raw : {};
  const merged = { ...defaults, ...base };
  const parsed = EconomyDataSchema.safeParse(merged);
  return parsed.success ? parsed.data : { ...defaults, ...base };
}

export function validateGuildConfigOrThrow(rawConfig, context = {}) {
  const parsed = GuildConfigSchema.safeParse(rawConfig);

  if (parsed.success) {
    return parsed.data;
  }

  throw createError(
    'Invalid guild configuration payload',
    ErrorTypes.VALIDATION,
    'Configuration payload is invalid. Please review provided values and try again.',
    {
      ...context,
      errorCode: 'VALIDATION_FAILED',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    }
  );
}


