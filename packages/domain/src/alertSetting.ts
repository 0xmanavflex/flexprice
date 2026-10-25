/**
 * Per-entity alert settings.
 *
 * **Not V1's wallet-balance alerts.** V1 has a tenant-wide
 * `wallet_balance_alert_config` stored behind `GET/PUT /settings/:key`; this is
 * `/alerts/setting`, a different feature with its own records. One alert
 * setting watches one entity — a subscription, a line item, a group, a wallet,
 * an entitlement grant — and fires at thresholds. Conflating the two produces a
 * screen that silently edits the wrong thing, so they stay separate models.
 *
 * A setting carries up to three thresholds, info / warning / critical, each a
 * condition and a number. Thresholds are decimal *strings* for the same reason
 * money is: a currency amount that round-trips through a float is a rounding
 * bug waiting for a large enough number.
 */
import { z } from 'zod'

/** What the alert watches. The API's own spelling. */
export const AlertEntityType = {
  Wallet: 'wallet',
  Feature: 'feature',
  Subscription: 'subscription',
  SubscriptionLineItem: 'subscription_line_item',
  Group: 'group',
  EntitlementGrant: 'entitlement_grant',
} as const
export type AlertEntityType = (typeof AlertEntityType)[keyof typeof AlertEntityType]

export const ALERT_ENTITY_TYPE_LABEL: Record<AlertEntityType, string> = {
  [AlertEntityType.Wallet]: 'Wallet',
  [AlertEntityType.Feature]: 'Feature',
  [AlertEntityType.Subscription]: 'Subscription',
  [AlertEntityType.SubscriptionLineItem]: 'Line item',
  [AlertEntityType.Group]: 'Tag',
  [AlertEntityType.EntitlementGrant]: 'Entitlement grant',
}

/** Is the threshold a number of units, or a share of the limit? */
export const AlertThresholdType = {
  Absolute: 'absolute',
  Percentage: 'percentage',
} as const
export type AlertThresholdType = (typeof AlertThresholdType)[keyof typeof AlertThresholdType]

export const ALERT_THRESHOLD_TYPE_LABEL: Record<AlertThresholdType, string> = {
  [AlertThresholdType.Absolute]: 'Absolute',
  [AlertThresholdType.Percentage]: 'Percentage',
}

/** Which side of the threshold fires. */
export const AlertCondition = {
  Above: 'above',
  Below: 'below',
} as const
export type AlertCondition = (typeof AlertCondition)[keyof typeof AlertCondition]

export const ALERT_CONDITION_LABEL: Record<AlertCondition, string> = {
  [AlertCondition.Above]: 'Rises above',
  [AlertCondition.Below]: 'Falls below',
}

/** The three severities an alert can be configured at, in escalating order. */
export const AlertSeverity = {
  Info: 'info',
  Warning: 'warning',
  Critical: 'critical',
} as const
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity]

export const ALERT_SEVERITY_ORDER: AlertSeverity[] = [
  AlertSeverity.Info,
  AlertSeverity.Warning,
  AlertSeverity.Critical,
]

export const ALERT_SEVERITY_LABEL: Record<AlertSeverity, string> = {
  [AlertSeverity.Info]: 'Info',
  [AlertSeverity.Warning]: 'Warning',
  [AlertSeverity.Critical]: 'Critical',
}

/** One severity's trigger. Null when that severity is not configured. */
export interface AlertThreshold {
  condition: AlertCondition
  /** A decimal string, never a float. */
  threshold: string
}

/** The read model an alerts list and its editor render. */
export interface AlertSetting {
  id: string
  entityId: string
  entityType: AlertEntityType
  /** Set for a line-item or group alert: the subscription that owns it. */
  parentEntityId: string
  parentEntityType: string
  /** Whether the record itself is switched on. */
  enabled: boolean
  thresholdType: AlertThresholdType
  info: AlertThreshold | null
  warning: AlertThreshold | null
  critical: AlertThreshold | null
  createdAt: Date | null
  updatedAt: Date | null
}

/** The configured severities, lowest first. Empty means "on, but silent". */
export function configuredSeverities(setting: AlertSetting): AlertSeverity[] {
  return ALERT_SEVERITY_ORDER.filter((severity) => setting[severity] !== null)
}

const threshold = z.object({
  condition: z.enum([AlertCondition.Above, AlertCondition.Below]),
  threshold: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, 'Enter a number, for example 80'),
})

/**
 * Configuring an alert.
 *
 * Every severity is optional, but at least one must be set while the alert is
 * enabled — an enabled alert with no thresholds never fires, which reads as a
 * bug to whoever configured it. A percentage threshold above 100 is rejected
 * for the same reason: it can never trigger.
 */
export const alertSettingConfigSchema = z
  .object({
    alertEnabled: z.boolean(),
    thresholdType: z.enum([AlertThresholdType.Absolute, AlertThresholdType.Percentage]),
    info: threshold.optional(),
    warning: threshold.optional(),
    critical: threshold.optional(),
  })
  .superRefine((config, ctx) => {
    const set = ALERT_SEVERITY_ORDER.filter((severity) => config[severity] !== undefined)

    if (config.alertEnabled && set.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['info'],
        message: 'Set at least one threshold, or turn the alert off',
      })
    }

    if (config.thresholdType === AlertThresholdType.Percentage) {
      for (const severity of set) {
        const value = Number.parseFloat(config[severity]?.threshold ?? '0')
        if (value > 100) {
          ctx.addIssue({
            code: 'custom',
            path: [severity],
            message: 'A percentage cannot exceed 100',
          })
        }
      }
    }
  })

export type AlertSettingConfig = z.infer<typeof alertSettingConfigSchema>

/**
 * Creating an alert. The entity it watches is fixed at creation — an update
 * takes only the config, so an alert cannot be pointed at something else.
 */
export const createAlertSettingSchema = z.object({
  entityId: z.string().trim().min(1, 'Choose what to watch'),
  entityType: z.enum(Object.values(AlertEntityType) as [AlertEntityType, ...AlertEntityType[]]),
  parentEntityId: z.string().trim().optional(),
  parentEntityType: z
    .enum(Object.values(AlertEntityType) as [AlertEntityType, ...AlertEntityType[]])
    .optional(),
  config: alertSettingConfigSchema,
})

export type CreateAlertSetting = z.infer<typeof createAlertSettingSchema>

export function emptyAlertSettingConfig(): AlertSettingConfig {
  return {
    alertEnabled: true,
    thresholdType: AlertThresholdType.Percentage,
    warning: { condition: AlertCondition.Above, threshold: '80' },
  }
}

/** A draft seeded from a loaded setting, so the editor starts on real values. */
export function toAlertSettingConfig(setting: AlertSetting): AlertSettingConfig {
  return {
    alertEnabled: setting.enabled,
    thresholdType: setting.thresholdType,
    ...(setting.info ? { info: setting.info } : {}),
    ...(setting.warning ? { warning: setting.warning } : {}),
    ...(setting.critical ? { critical: setting.critical } : {}),
  }
}

/** What an alerts list can ask for. Product vocabulary, not transport. */
export interface AlertSettingQuery {
  page: number
  pageSize: number
  /** Narrow to one kind of watched entity, or all when null. */
  entityType: AlertEntityType | null
  /** Narrow to one watched entity. */
  entityId: string
  /** Only enabled, only disabled, or both when null. */
  enabled: boolean | null
}

export const DEFAULT_ALERT_SETTING_QUERY: AlertSettingQuery = {
  page: 1,
  pageSize: 25,
  entityType: null,
  entityId: '',
  enabled: null,
}
