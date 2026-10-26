/**
 * What happens to a subscription that is not paid for.
 *
 * `GET/PUT /settings/subscription_config`. Two fields that read as one
 * sentence: after `gracePeriodDays` of non-payment, cancel the subscription:
 * or do not, if `autoCancellationEnabled` is off.
 *
 * The grace period is kept even while auto-cancellation is off, deliberately:
 * turning the switch off and on again should not silently reset how long
 * customers get, and the number is still what the dunning schedule counts to.
 */
import { z } from 'zod'

export interface SubscriptionConfig {
  /** Off by default. Cancelling a paying customer is opt-in. */
  autoCancellationEnabled: boolean
  /** Days of non-payment tolerated before cancellation. */
  gracePeriodDays: number
}

export const subscriptionConfigSchema = z.object({
  autoCancellationEnabled: z.boolean(),
  gracePeriodDays: z
    .number({ message: 'Enter a number of days' })
    .int('Use whole days')
    .min(0, 'A grace period cannot be negative')
    // A year of unpaid service is not a grace period, it is free service.
    .max(365, 'Use 365 days or fewer'),
})

/** The backend's defaults, as read from a never-written key. */
export function defaultSubscriptionConfig(): SubscriptionConfig {
  return { autoCancellationEnabled: false, gracePeriodDays: 3 }
}
