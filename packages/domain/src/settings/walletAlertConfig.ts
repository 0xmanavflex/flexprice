/**
 * When a low wallet balance should raise an alarm: tenant-wide.
 *
 * `GET/PUT /settings/wallet_balance_alert_config`.
 *
 * **This is the setting `alertSetting.ts` warns you about.** That file models
 * `/alerts/setting`: per-entity records, each watching one wallet or one
 * subscription, each with its own id. This is one environment-wide default
 * behind a settings key, with no id at all. The two are edited on different
 * screens and a change to one is invisible in the other, so confusing them
 * produces the worst kind of bug: a save that appears to work and changes
 * nothing the user was looking at.
 *
 * The thresholds, though, are the same idea, so the vocabulary is shared
 * rather than re-declared: `AlertCondition` and `AlertThresholdType` are
 * imported from `alertSetting.ts`. One meaning of "below 80" across the
 * product is worth more than two independent enums that agree by luck.
 */
import { z } from 'zod'
import { ALERT_SEVERITY_ORDER, AlertCondition, AlertThresholdType } from '../alertSetting'

/**
 * One severity's trigger, or `null` when that severity is not configured.
 *
 * `threshold` is a decimal *string* for the reason money always is: a balance
 * that round-trips through a float is a rounding bug waiting for a large
 * enough number. The API sends it as a string; it stays one.
 */
const walletThresholdSchema = z
  .object({
    condition: z.enum([AlertCondition.Above, AlertCondition.Below]),
    threshold: z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/, 'Enter a number, for example 100'),
  })
  .nullable()

/**
 * The whole setting, as both the read model and the editor's draft.
 *
 * One representation rather than a read shape and a separate draft shape, and
 * `null` rather than an optional field, so that "warning is off" has exactly
 * one spelling. Under `exactOptionalPropertyTypes` an optional property makes
 * "absent" and "explicitly undefined" different values, which is a distinction
 * this setting does not have and a form cannot express.
 */
export const walletAlertConfigSchema = z
  .object({
    alertEnabled: z.boolean(),
    thresholdType: z.enum([AlertThresholdType.Absolute, AlertThresholdType.Percentage]),
    info: walletThresholdSchema,
    warning: walletThresholdSchema,
    critical: walletThresholdSchema,
  })
  .superRefine((config, ctx) => {
    const set = ALERT_SEVERITY_ORDER.filter((severity) => config[severity] !== null)

    if (config.alertEnabled && set.length === 0) {
      // An enabled alert with no thresholds never fires, which reads as a bug
      // to whoever configured it and is indistinguishable from "off".
      ctx.addIssue({
        code: 'custom',
        path: ['critical'],
        message: 'Set at least one threshold, or turn the alert off',
      })
    }

    if (config.thresholdType === AlertThresholdType.Percentage) {
      for (const severity of set) {
        if (Number.parseFloat(config[severity]?.threshold ?? '0') > 100) {
          ctx.addIssue({
            code: 'custom',
            path: [severity],
            message: 'A percentage cannot exceed 100',
          })
        }
      }
    }
  })

export type WalletAlertConfig = z.infer<typeof walletAlertConfigSchema>
export type WalletAlertThreshold = WalletAlertConfig['critical']

/**
 * The backend's defaults, as read from a never-written key.
 *
 * Note what the live default is: alerting *off*, with a critical threshold of
 * "below 0" already sitting there. A screen that reads the threshold as proof
 * the alert is configured would show an alarm nobody set: `alertEnabled` is
 * the only field that says whether anything fires.
 */
export function defaultWalletAlertConfig(): WalletAlertConfig {
  return {
    alertEnabled: false,
    thresholdType: AlertThresholdType.Absolute,
    info: null,
    warning: null,
    critical: { condition: AlertCondition.Below, threshold: '0' },
  }
}
