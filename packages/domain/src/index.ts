/**
 * The product's vocabulary.
 *
 * Everything here is pure and dependency-free — no SDK, no HTTP, no React.
 * Transport types stop below this layer: `@fp/query` fetches a
 * `CustomerResponse` and hands the UI a domain model, so no component ever
 * receives a `WalletResponse`.
 *
 * That boundary is also where Flexprice's internal language becomes the
 * product's. Watchtower established the pattern — a recurring credit grant is
 * presented as a *monthly budget*, a one-time grant as a *top-up* — and the
 * same translation belongs here, once, rather than in each screen that renders
 * it.
 *
 * Types are added as surfaces are built. Modelling all 570 schemas up front
 * would recreate the 53 hand-written DTO files this architecture removes; the
 * SDK already has them, and they are only interesting once something renders.
 */
export {
  InvalidMoneyError,
  compareMoney,
  formatMoney,
  isNegativeMoney,
  isZeroMoney,
  money,
  moneyOr,
} from './money'
export type { Money } from './money'

export {
  DEFAULT_INVOICE_QUERY,
  InvoiceSortField,
  InvoiceStatus,
  deriveInvoiceStatus,
  needsAttention,
} from './invoice'
export type { Invoice, InvoiceQuery, InvoiceStatusInput } from './invoice'

export {
  BILLING_MODEL_LABEL,
  BillingModel,
  TIER_MODE_LABEL,
  TierMode,
  emptyOverride,
  priceOverrideSchema,
  priceTierSchema,
} from './priceOverride'
export type { PriceOverride, PriceTier } from './priceOverride'

export {
  AGGREGATION_LABEL,
  AggregationType,
  DEFAULT_FEATURE_QUERY,
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureStatus,
  FeatureType,
  ResetUsage,
  createFeatureSchema,
  emptyFeature,
  meterSchema,
  needsAggregationTarget,
  FEATURE_SORT_LABEL,
  FeatureSortField,
  FeatureView,
} from './feature'
export type { CreateFeature, Feature, FeatureQuery, MeterDraft } from './feature'

export {
  DEFAULT_PLAN_QUERY,
  PLAN_SORT_LABEL,
  PLAN_STATUS_LABEL,
  PlanSortField,
  PlanStatus,
  PlanView,
} from './plan'
export type { Plan, PlanHeadline, PlanQuery } from './plan'

export {
  ADDON_SORT_LABEL,
  ADDON_STATUS_LABEL,
  AddonSortField,
  AddonStatus,
  AddonView,
  DEFAULT_ADDON_QUERY,
} from './addon'
export type { Addon, AddonQuery } from './addon'

export {
  COUPON_CADENCE_LABEL,
  COUPON_SORT_LABEL,
  COUPON_STATUS_LABEL,
  COUPON_TYPE_LABEL,
  CouponCadence,
  CouponSortField,
  CouponStatus,
  CouponType,
  CouponView,
  DEFAULT_COUPON_QUERY,
} from './coupon'
export type { Coupon, CouponQuery } from './coupon'

export { resetRequestSchema, setPasswordSchema, signInSchema } from './auth'
export type { ResetRequest, SetPassword, SignInCredentials } from './auth'
export {
  ENVIRONMENT_TYPE_DESCRIPTION,
  ENVIRONMENT_TYPE_LABEL,
  EnvironmentType,
  createEnvironmentSchema,
  emptyEnvironment,
  environmentKind,
  environmentSchema,
} from './environment'
export type { CreateEnvironment, Environment } from './environment'
