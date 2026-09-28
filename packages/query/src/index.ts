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

export { FlexpriceProvider, useFlexprice, useFlexpriceServerURL } from './provider'
export type { FlexpriceProviderProps } from './provider'

export {
  toEnvironment,
  useCreateEnvironment,
  useCurrentUser,
  useEnvironmentList,
  useSignIn,
} from './session'
export type { CurrentUser, SessionCredentials } from './session'

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
  useArchivePlan,
  useClonePlan,
  useCreatePlan,
  usePlan,
  usePlanSubscriptions,
  usePlans,
  useSyncPlanPrices,
  useUpdatePlan,
} from './plans'
export type { PlanPage, PlanSubscriptionRow, PlanWire } from './plans'

export {
  fetchAddons,
  toAddon,
  toAddonFilter,
  toCreateAddonRequest,
  toUpdateAddonRequest,
  useAddon,
  useAddons,
  useCreateAddon,
  useUpdateAddon,
} from './addons'
export type { AddonPage, AddonWire } from './addons'

export {
  fetchCoupons,
  toCoupon,
  toCouponAssociation,
  toCouponFilter,
  toUpdateCouponRequest,
  useArchiveCoupon,
  useCoupon,
  useCouponAssociations,
  useCoupons,
  useUpdateCoupon,
} from './coupons'
export type {
  CouponAssociationPage,
  CouponAssociationWire,
  CouponPage,
  CouponWire,
} from './coupons'

export {
  fetchPriceUnits,
  toCreatePriceUnitRequest,
  toPriceUnit,
  toPriceUnitFilter,
  toUpdatePriceUnitRequest,
  useCreatePriceUnit,
  usePriceUnit,
  usePriceUnits,
  useUpdatePriceUnit,
} from './priceUnits'
export type { PriceUnitPage, PriceUnitWire } from './priceUnits'

export { fetchGroups, toGroup, toGroupFilter, useGroup, useGroups } from './groups'
export type { GroupPage, GroupWire } from './groups'

export { fetchCostSheets, toCostSheet, toCostSheetFilter, useCostSheet, useCostSheets } from './costSheets'
export type { CostSheetPage, CostSheetWire } from './costSheets'

export { fetchCustomers, toCustomer, toCustomerFilter, useCustomers } from './customers'
export type { CustomerPage, CustomerWire } from './customers'

export {
  fetchSubscriptions,
  toSubscription,
  toSubscriptionFilter,
  useSubscriptions,
} from './subscriptions'
export type { SubscriptionPage, SubscriptionWire } from './subscriptions'

export { fetchPayments, toPayment, toPaymentFilter, usePayments } from './payments'
export type { PaymentPage, PaymentWire } from './payments'

export { fetchTaxRates, toTaxRate, toTaxRateFilter, useTaxRates } from './taxRates'
export type { TaxRatePage, TaxRateWire } from './taxRates'

export {
  toCharge,
  toChargeRequest,
  useCreateBulkPrices,
  usePrices,
  useTerminatePrice,
  useUpdatePrice,
} from './prices'
export type { ChargeWire } from './prices'

export {
  toEntitlement,
  toEntitlementRequest,
  useCreateBulkEntitlements,
  useDeleteEntitlement,
  useEntitlements,
} from './entitlements'
export type { EntitlementWire } from './entitlements'

export {
  toCreditGrant,
  toCreditGrantRequest,
  useCreateCreditGrant,
  useCreditGrants,
  useDeleteCreditGrant,
} from './creditGrants'
export type { CreditGrantWire } from './creditGrants'

export { useNavCounts } from './counts'
export type { CountableId } from './counts'

export { useCatalogStats } from './catalogStats'
export type { CatalogEntity, CatalogStats } from './catalogStats'
