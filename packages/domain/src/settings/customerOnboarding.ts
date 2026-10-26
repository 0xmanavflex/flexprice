/**
 * What happens automatically when a customer is created.
 *
 * `GET/PUT /settings/customer_onboarding`. The value is a workflow: a
 * `workflowType` and an ordered list of actions the backend runs, in order,
 * the first time it sees a new customer. An empty list: the default: means
 * nothing happens, which is a valid and common answer.
 *
 * ## The action list is a closed union, and the write enforces it
 *
 * `actions` is a discriminated union on the `action` field, unmarshalled by
 * hand on the backend (`internal/temporal/models/workflow.go`). An action with
 * an unrecognised `action`, or with none, does not get ignored: it **fails the
 * whole PUT** with a validation error. V1 tolerates unknown actions on read
 * with a passthrough schema, which is a fine way to render something it does
 * not understand and a trap if that value is ever saved back.
 *
 * So all five are modelled here, exactly, and `parseOnboardingAction` is total:
 * an action that does not match one of the five is reported rather than
 * silently carried. A screen that cannot name every action it holds should
 * refuse to save, because the API will refuse for it: with a message about
 * JSON, at a moment when the user thinks they edited a wallet.
 *
 * Optional fields are `null`, not absent, throughout. Under
 * `exactOptionalPropertyTypes` an optional property makes "missing" and
 * "explicitly undefined" two different values, and a form has only one blank.
 */
import { z } from 'zod'
import { CreditGrantExpiryDurationUnit } from '../creditGrant'
import { FeatureType } from '../feature'

/** The only workflow this setting describes today. */
export const CUSTOMER_ONBOARDING_WORKFLOW = 'customer_onboarding'

/** The five actions an onboarding workflow can run, in the API's spelling. */
export const OnboardingAction = {
  CreateCustomer: 'create_customer',
  CreateSubscription: 'create_subscription',
  CreateWallet: 'create_wallet',
  CreateFeatureAndPrice: 'create_feature_and_price',
  RolloutToSubscriptions: 'rollout_to_subscriptions',
} as const
export type OnboardingAction = (typeof OnboardingAction)[keyof typeof OnboardingAction]

export const ONBOARDING_ACTION_LABEL: Record<OnboardingAction, string> = {
  [OnboardingAction.CreateCustomer]: 'Create the customer',
  [OnboardingAction.CreateSubscription]: 'Start a subscription',
  [OnboardingAction.CreateWallet]: 'Open a wallet',
  [OnboardingAction.CreateFeatureAndPrice]: 'Add a feature and its price',
  [OnboardingAction.RolloutToSubscriptions]: 'Roll out to existing subscriptions',
}

/** Wallets an onboarding action can open. The backend's own casing. */
export const OnboardingWalletType = {
  PrePaid: 'PRE_PAID',
  PostPaid: 'POST_PAID',
} as const
export type OnboardingWalletType = (typeof OnboardingWalletType)[keyof typeof OnboardingWalletType]

export const ONBOARDING_WALLET_TYPE_LABEL: Record<OnboardingWalletType, string> = {
  [OnboardingWalletType.PrePaid]: 'Prepaid',
  [OnboardingWalletType.PostPaid]: 'Postpaid',
}

/** How a subscription started by onboarding aligns its periods. */
export const OnboardingBillingCycle = {
  Anniversary: 'anniversary',
  Calendar: 'calendar',
} as const
export type OnboardingBillingCycle =
  (typeof OnboardingBillingCycle)[keyof typeof OnboardingBillingCycle]

const decimalString = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, message)

/**
 * An ISO 8601 instant, as a string.
 *
 * Kept as the string the API sent rather than parsed to a `Date`, because it
 * is written back verbatim and a `Date` round-trip normalises the offset:
 * `2026-09-29T00:00:00+05:30` becomes a UTC instant, and a workflow scheduled
 * for local midnight quietly moves.
 */
const instant = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    'Enter a date and time, for example 2026-09-29T00:00:00Z',
  )

export const createCustomerActionSchema = z.object({
  action: z.literal(OnboardingAction.CreateCustomer),
  /** Attributes the created customer to a user, when set. */
  defaultUserId: z.string().trim().nullable(),
})

/**
 * Opening a wallet.
 *
 * `conversionRate` and `initialCreditsToLoad` are decimal strings for the
 * reason every amount in this workspace is: a rate that round-trips through a
 * float is a rounding error applied to every credit ever granted.
 */
export const createWalletActionSchema = z
  .object({
    action: z.literal(OnboardingAction.CreateWallet),
    currency: z.string().trim().min(1, 'Choose a currency'),
    conversionRate: decimalString('Enter a conversion rate, for example 1'),
    walletType: z.enum([OnboardingWalletType.PrePaid, OnboardingWalletType.PostPaid]),
    initialCreditsToLoad: decimalString('Enter an amount, for example 0'),
    /** Null means the credits never expire. */
    initialCreditsExpirationDuration: z
      .number()
      .int('Use a whole number')
      .min(1, 'Use at least 1')
      .nullable(),
    initialCreditsExpirationDurationUnit: z
      .enum([
        CreditGrantExpiryDurationUnit.Day,
        CreditGrantExpiryDurationUnit.Week,
        CreditGrantExpiryDurationUnit.Month,
        CreditGrantExpiryDurationUnit.Year,
      ])
      .nullable(),
  })
  .superRefine((action, ctx) => {
    // A duration without a unit is not a shorter expiry, it is no expiry at
    // all: the backend needs both or neither.
    if (
      action.initialCreditsExpirationDuration !== null &&
      action.initialCreditsExpirationDurationUnit === null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['initialCreditsExpirationDurationUnit'],
        message: 'Choose a unit for the expiry',
      })
    }
  })

export const createSubscriptionActionSchema = z.object({
  action: z.literal(OnboardingAction.CreateSubscription),
  planId: z.string().trim().min(1, 'Choose a plan'),
  billingCycle: z
    .enum([OnboardingBillingCycle.Anniversary, OnboardingBillingCycle.Calendar])
    .nullable(),
  /** Null means "when the customer is created". */
  startDate: instant.nullable(),
})

export const createFeatureAndPriceActionSchema = z.object({
  action: z.literal(OnboardingAction.CreateFeatureAndPrice),
  planId: z.string().trim().min(1, 'Choose a plan'),
  featureType: z
    .enum([FeatureType.Metered, FeatureType.Boolean, FeatureType.Static, FeatureType.Config])
    .nullable(),
  priceStartDateTime: instant.nullable(),
})

export const rolloutToSubscriptionsActionSchema = z.object({
  action: z.literal(OnboardingAction.RolloutToSubscriptions),
  planId: z.string().trim().min(1, 'Choose a plan'),
})

export const onboardingActionSchema = z.discriminatedUnion('action', [
  createCustomerActionSchema,
  createWalletActionSchema,
  createSubscriptionActionSchema,
  createFeatureAndPriceActionSchema,
  rolloutToSubscriptionsActionSchema,
])

export type CreateCustomerAction = z.infer<typeof createCustomerActionSchema>
export type CreateWalletAction = z.infer<typeof createWalletActionSchema>
export type CreateSubscriptionAction = z.infer<typeof createSubscriptionActionSchema>
export type CreateFeatureAndPriceAction = z.infer<typeof createFeatureAndPriceActionSchema>
export type RolloutToSubscriptionsAction = z.infer<typeof rolloutToSubscriptionsActionSchema>
export type OnboardingActionConfig = z.infer<typeof onboardingActionSchema>

export const customerOnboardingSchema = z.object({
  workflowType: z.string().trim().min(1),
  actions: z.array(onboardingActionSchema),
})
export type CustomerOnboarding = z.infer<typeof customerOnboardingSchema>

/** The backend's default: the workflow exists and does nothing. */
export function defaultCustomerOnboarding(): CustomerOnboarding {
  return { workflowType: CUSTOMER_ONBOARDING_WORKFLOW, actions: [] }
}

/** A blank action of a chosen type, for the editor's "add a step" menu. */
export function emptyOnboardingAction(action: OnboardingAction): OnboardingActionConfig {
  switch (action) {
    case OnboardingAction.CreateCustomer:
      return { action, defaultUserId: null }
    case OnboardingAction.CreateWallet:
      return {
        action,
        currency: '',
        // The backend's own default rate, and the only one that means
        // "one credit is one unit of currency".
        conversionRate: '1',
        walletType: OnboardingWalletType.PrePaid,
        initialCreditsToLoad: '0',
        initialCreditsExpirationDuration: null,
        initialCreditsExpirationDurationUnit: null,
      }
    case OnboardingAction.CreateSubscription:
      return { action, planId: '', billingCycle: null, startDate: null }
    case OnboardingAction.CreateFeatureAndPrice:
      return { action, planId: '', featureType: null, priceStartDateTime: null }
    case OnboardingAction.RolloutToSubscriptions:
      return { action, planId: '' }
  }
}
