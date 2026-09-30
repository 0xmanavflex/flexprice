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

export {
  FlexpriceProvider,
  useFlexprice,
  useFlexpriceAuth,
  useFlexpriceServerURL,
} from './provider'
export type { FlexpriceProviderProps } from './provider'

export {
  toEnvironment,
  useCreateEnvironment,
  useCurrentUser,
  useEnvironmentList,
  useSignIn,
} from './session'
export type { CurrentUser, SessionCredentials } from './session'

export {
  fetchInvoices,
  isServerFilterable,
  toInvoice,
  toInvoiceFilter,
  useInvoices,
} from './invoices'
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

export {
  fetchCostSheets,
  toCostSheet,
  toCostSheetFilter,
  useCostSheet,
  useCostSheets,
} from './costSheets'
export type { CostSheetPage, CostSheetWire } from './costSheets'

export {
  fetchCustomer,
  fetchCustomers,
  fetchCustomerSubscriptions,
  fetchCustomerUsageSummary,
  toCustomer,
  toCustomerDetail,
  toCustomerFilter,
  toCustomerUsageSummary,
  useCustomer,
  useCustomerInvoices,
  useCustomers,
  useCustomerSubscriptions,
  useCustomerUsageSummary,
} from './customers'
export type {
  CustomerDetailWire,
  CustomerPage,
  CustomerUsageSummary,
  CustomerWire,
} from './customers'

export {
  fetchSubscriptions,
  toSubscription,
  toSubscriptionFilter,
  useSubscriptions,
} from './subscriptions'
export type { SubscriptionPage, SubscriptionWire } from './subscriptions'

export { fetchCreditNotes, toCreditNote, useCreditNotes } from './creditNotes'
export type { CreditNotePage, CreditNoteWire } from './creditNotes'
export { fetchPayments, toPayment, toPaymentFilter, usePayments } from './payments'
export type { PaymentPage, PaymentWire } from './payments'

export { fetchTaxRates, toTaxRate, toTaxRateFilter, useTaxRates } from './taxRates'
export type { TaxRatePage, TaxRateWire } from './taxRates'

export { fetchRawEvents, toRawEvent, toRawEventFilter, useRawEvents } from './rawEvents'
export type { RawEventPage, RawEventWire } from './rawEvents'

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

/**
 * Settings.
 *
 * This file used to carry a note saying that everything behind
 * `GET/PUT/DELETE /settings/:key` had no SDK module, and therefore no hook,
 * and that those screens should render an unavailable state. The first half
 * was true and the conclusion was wrong: the routes are live and answer 200
 * today — only SAML is genuinely absent, and only because the deployment does
 * not mount it. `settings.ts` is the correction, reaching them the way
 * `session.ts` reaches the other undocumented routes.
 */
export {
  fetchMembers,
  toCreateServiceAccountRequest,
  toInviteMemberRequest,
  toMember,
  toMemberFilter,
  useCreateServiceAccount,
  useDeleteServiceAccount,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useRenameServiceAccount,
  useServiceAccounts,
  useTeamMembers,
  useUpdateMemberRoles,
  useUpdateOwnProfile,
  useUserInfo,
} from './users'
export type { MemberPage, UserWire } from './users'

export { toRole, toRoleDetail, toRoleList, useRole, useRoles } from './roles'
export type { RoleWire } from './roles'

export {
  DEFAULT_API_KEY_QUERY,
  fetchApiKeys,
  toApiKey,
  toCreateApiKeyRequest,
  toCreatedApiKey,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from './apiKeys'
export type { ApiKeyPage, ApiKeyQuery, ApiKeyWire, CreateApiKeyWire } from './apiKeys'

export {
  fetchTenant,
  fetchTenantBillingUsage,
  toTenantBillingWire,
  tenantBillingUsageOrEmpty,
  toTenant,
  toTenantBillingUsage,
  toUpdateTenantRequest,
  useTenant,
  useTenantBillingUsage,
  useUpdateTenant,
} from './tenant'
export type { TenantBillingUsageWire, TenantWire } from './tenant'

/**
 * The `/settings/{key}` family: one query hook and two mutations per key,
 * plus the SAML read and the Svix portal handoff. Every one of them takes the
 * active environment id — these records are per environment, and so are their
 * cache entries. See `settings.ts`.
 */
export {
  toCustomCurrencyConfig,
  toCustomCurrencyConfigRequest,
  toCustomerOnboarding,
  toCustomerOnboardingRequest,
  toCustomerPortalConfig,
  toCustomerPortalConfigRequest,
  toInvoiceConfig,
  toInvoiceConfigRequest,
  toSamlConfig,
  toSubscriptionConfig,
  toSubscriptionConfigRequest,
  toWalletAlertConfig,
  toWalletAlertConfigRequest,
  useCustomCurrencyConfig,
  useCustomerOnboarding,
  useCustomerPortalConfig,
  useInvoiceConfig,
  useResetCustomCurrencyConfig,
  useResetCustomerOnboarding,
  useResetCustomerPortalConfig,
  useResetInvoiceConfig,
  useResetSubscriptionConfig,
  useResetWalletAlertConfig,
  useSamlConfig,
  useSubscriptionConfig,
  useUpdateCustomCurrencyConfig,
  useUpdateCustomerOnboarding,
  useUpdateCustomerPortalConfig,
  useUpdateInvoiceConfig,
  useUpdateSubscriptionConfig,
  useUpdateWalletAlertConfig,
  useWalletAlertConfig,
  useWebhookDashboard,
} from './settings'
export type { WebhookDashboard } from './settings'

export {
  fetchAlertSettings,
  toAlertSetting,
  toAlertSettingFilter,
  toCreateAlertSettingRequest,
  toUpdateAlertSettingRequest,
  useAlertSetting,
  useAlertSettings,
  useCreateAlertSetting,
  useDeleteAlertSetting,
  useUpdateAlertSetting,
} from './alertSettings'
export type { AlertSettingPage, AlertSettingWire } from './alertSettings'

export { useNavCounts } from './counts'
export type { CountableId } from './counts'

export { useCatalogStats } from './catalogStats'
export type { CatalogEntity, CatalogStats } from './catalogStats'

export { toUsageAnalytics, useUsageAnalytics, UsageWindowSize } from './events'
export type {
  FeatureUsageRow,
  UsageAnalytics,
  UsageAnalyticsQuery,
  UsagePoint,
  UsageWindow,
} from './events'
