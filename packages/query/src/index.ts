/**
 * The only data door.
 *
 * Components and pages import from here, and from nowhere else:
 *
 *     UI  ->  @fp/query  ->  @fp/api  ->  @flexprice/sdk  ->  backend
 *
 * Importing `@fp/api`, `@flexprice/sdk` or a service from a component is an
 * ESLint error rather than a review comment. The reason is not tidiness — it is
 * that a component which knows how its data arrives cannot be rendered in a
 * story, cannot be tested without a network, and cannot survive the API
 * changing shape. Watchtower V2 enforces the same rule; this is that rule with
 * a package boundary behind it.
 *
 * What crosses this door is **domain models, never transport types**. A hook
 * here fetches a `CustomerResponse` and returns a domain `Customer`. Nothing
 * above this layer sees a `WalletResponse`.
 */
export { queryKeys } from './keys'
export { createQueryClient, shouldRetry } from './client'

// Re-exported so a component can branch on failure without importing `@fp/api`,
// which the boundary rule forbids. The error shape is part of the door.
export { ApiError, ErrorKind } from '@fp/api'

export { FlexpriceProvider, useFlexprice } from './provider'
export type { FlexpriceProviderProps } from './provider'

export { fetchInvoices, isServerFilterable, toInvoice, toInvoiceFilter, useInvoices } from './invoices'
export type { InvoicePage, InvoiceWire } from './invoices'

export { toOverrideLineItem } from './priceOverrides'
export type { OverrideLineItem } from './priceOverrides'

export {
  fetchFeatures,
  toCreateFeatureRequest,
  toFeature,
  toFeatureFilter,
  useCreateFeature,
  useFeature,
  useFeatures,
} from './features'
export type { FeaturePage, FeatureWire } from './features'

export {
  fetchPlans,
  toCreatePlanRequest,
  toPlan,
  toPlanFilter,
  toUpdatePlanRequest,
  usePlans,
  useCreatePlan,
  useUpdatePlan,
} from './plans'
export type { PlanPage, PlanWire } from './plans'

export {
  fetchAddons,
  toAddon,
  toAddonFilter,
  toCreateAddonRequest,
  toUpdateAddonRequest,
  useAddons,
  useCreateAddon,
  useUpdateAddon,
} from './addons'
export type { AddonPage, AddonWire } from './addons'

export { fetchCoupons, toCoupon, toCouponFilter, useCoupons } from './coupons'
export type { CouponPage, CouponWire } from './coupons'

export { useNavCounts } from './counts'
export type { CountableId } from './counts'

export { useCatalogStats } from './catalogStats'
export type { CatalogEntity, CatalogStats } from './catalogStats'
