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
export { useActivityLog } from './activity'
export type { ActivityFilter } from './activity'

export { queryKeys } from './keys'
export {
  MAX_RETRY_AFTER_MS,
  createQueryClient,
  createQueryKeyHash,
  retryDelay,
  shouldRetry,
  shouldThrowOnError,
} from './client'
export type { QueryClientOptions } from './client'

export { describeFreshness } from './freshness'
export type { Freshness, FreshnessSource } from './freshness'

export { useDebouncedValue } from './useDebouncedValue'

// Re-exported so a component can branch on failure without importing `@fp/api`,
// which the boundary rule forbids. The error shape is part of the door.
export { ApiError, ErrorKind, serverReason } from '@fp/api'

export {
  FlexpriceProvider,
  useFlexprice,
  useFlexpriceAuth,
  useFlexpriceServerURL,
} from './provider'
export type { FlexpriceProviderProps } from './provider'

export {
  toEnvironment,
  useCopyEnvironment,
  useCreateEnvironment,
  useCurrentUser,
  useEnvironmentList,
  useRecordEnvironment,
  useRenameEnvironment,
  useSignIn,
  useSignUp,
  useSignUpWithToken,
} from './session'
export type { CopyEnvironment, CurrentUser, RenameEnvironment, SessionCredentials } from './session'

export { PASSWORD_ONLY, useAuthCapabilities, useAuthCapabilitiesValue } from './authCapabilities'
export type { AuthCapabilities, AuthProviderId } from './authCapabilities'

export {
  fetchInvoices,
  isServerFilterable,
  toCreateInvoiceRequest,
  toInvoice,
  toInvoiceDetail,
  toInvoiceFilter,
  useAttemptInvoicePayment,
  useCreateInvoice,
  useFinalizeInvoice,
  applyLineChanges,
  useModifyInvoiceLineItems,
  useSaveInvoiceEdit,
  runInvoiceEdit,
  useUpdateInvoice,
  useUpdateInvoiceMetadata,
  useUpdateInvoicePaymentStatus,
  useInvoice,
  useInvoices,
  useRecalculateInvoice,
  useSendInvoice,
  useVoidInvoice,
} from './invoices'
export type { InvoiceEdit, InvoiceEditSave, InvoiceLineChanges, LineItemEdit } from './invoices'
export type { InvoiceDetailWire, InvoicePage, InvoiceWire } from './invoices'

export {
  summariseCollections,
  summariseDunning,
  useCollectionsSummary,
  useDunning,
} from './collections'
export type { CollectionsSummary, DunningRow, DunningSummary } from './collections'

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
  toUpdateFeatureRequest,
  toCloneFeatureRequest,
  useUpdateFeature,
  useDeleteFeature,
  useCloneFeature,
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
  useDeleteAddon,
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
  useCouponRedemptions,
  useCoupons,
  useUpdateCoupon,
  toCreateCouponRequest,
  useCreateCoupon,
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
  useDeletePriceUnit,
} from './priceUnits'
export type { PriceUnitPage, PriceUnitWire } from './priceUnits'

export {
  fetchGroups,
  toGroup,
  toGroupFilter,
  useGroup,
  useGroupMembers,
  useGroups,
  usePriceGroupOptions,
  toCreateGroupRequest,
  useCreateGroup,
  useDeleteGroup,
} from './groups'
export type { GroupPage, GroupWire } from './groups'

export {
  fetchCostSheets,
  toCostSheet,
  toCostSheetFilter,
  useCostSheet,
  useCostSheets,
  toCreateCostSheetRequest,
  toUpdateCostSheetRequest,
  useCreateCostSheet,
  useUpdateCostSheet,
  useDeleteCostSheet,
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
  toCreateCustomerRequest,
  toUpdateCustomerRequest,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  toIntegrationLinks,
  useCustomerIntegrationLinks,
  useLinkCustomerIntegration,
  useUnlinkCustomerIntegration,
} from './customers'
export type {
  CustomerDetailWire,
  CustomerPage,
  CustomerUsageSummary,
  CustomerWire,
  IntegrationMappingWire,
} from './customers'

export {
  fetchSubscriptions,
  toCancelSubscriptionRequest,
  toCreateLineItemRequest,
  toCreateSubscriptionRequest,
  toDeleteLineItemRequest,
  toPendingSchedules,
  toSubscription,
  toSubscriptionDetail,
  toSubscriptionEntitlement,
  toSubscriptionFilter,
  toSubscriptionLine,
  toSubscriptionUsage,
  toLineChangePreview,
  toLineItemChangeRequest,
  toUpdateLineItemRequest,
  useActivateSubscription,
  useUpdateSubscriptionMetadata,
  useRemoveSubscriptionAddon,
  useRemoveSubscriptionTax,
  useCancelSubscriptionCreditGrant,
  useCustomerContractCounts,
  useCancelSubscription,
  useCreateSubscription,
  useCreateSubscriptionLineItem,
  toAddAddonRequest,
  toAddCouponRequest,
  toRemoveCouponRequest,
  useAddSubscriptionAddon,
  useAddSubscriptionCoupon,
  useCreateSubscriptionCreditGrant,
  useCreateSubscriptionEntitlement,
  useCreateSubscriptionTax,
  useDeleteSubscriptionLineItem,
  useExecuteLineChange,
  usePreviewLineChange,
  useSubscription,
  useSubscriptionCreditGrants,
  useSubscriptionEntitlements,
  useSubscriptionInvoices,
  useSubscriptionAddons,
  useSubscriptionCoupons,
  useSubscriptionInvoicePreview,
  useSubscriptionLines,
  useSubscriptionLineHistory,
  useSubscriptionSchedules,
  useSubscriptionTaxes,
  useSubscriptionUsage,
  useSubscriptions,
  useUpdateSubscriptionLineItem,
} from './subscriptions'
export type {
  SubscriptionPage,
  SubscriptionScheduleWire,
  SubscriptionUsageWire,
  SubscriptionWire,
} from './subscriptions'

export {
  fetchCreditNotes,
  toCreateCreditNoteRequest,
  toCreditNote,
  toCreditNoteDetail,
  useCreateCreditNote,
  useCreditNote,
  useCreditNotes,
  useFinalizeCreditNote,
  useInvoiceCreditNotes,
  useVoidCreditNote,
} from './creditNotes'
export type { CreditNoteDetailWire, CreditNotePage, CreditNoteWire } from './creditNotes'
export {
  fetchPayments,
  toPayment,
  toPaymentDetail,
  toPaymentFilter,
  toRecordPaymentRequest,
  useCustomerPayments,
  useDeletePayment,
  useInvoicePayments,
  usePayment,
  usePayments,
  useProcessPayment,
  useRecordPayment,
} from './payments'
export type { PaymentDetailWire, PaymentPage, PaymentWire } from './payments'

export {
  fetchTaxRates,
  toTaxRate,
  toTaxRateFilter,
  useTaxRates,
  toCreateTaxRateRequest,
  toUpdateTaxRateRequest,
  useCreateTaxRate,
  useUpdateTaxRate,
  useDeleteTaxRate,
} from './taxRates'
export type { TaxRatePage, TaxRateWire } from './taxRates'

export { fetchRawEvents, toRawEvent, toRawEventFilter, useRawEvents } from './rawEvents'
export type { RawEventPage, RawEventWire } from './rawEvents'

export {
  toCharge,
  toChargeRequest,
  toUpdatePriceRequest,
  useCreateBulkPrices,
  useFeatureCharges,
  usePrices,
  usePriceHistory,
  useTerminatePrice,
  useUpdatePrice,
} from './prices'
export type { ChargeWire, FeatureChargeLink } from './prices'

export {
  toEntitlement,
  toEntitlementRequest,
  useCreateBulkEntitlements,
  useDeleteEntitlement,
  useEntitlements,
  useFeatureEntitlements,
  usePlanEntitlements,
  toUpdateEntitlementRequest,
  useUpdateEntitlement,
} from './entitlements'
export type { EntitlementWire, FeatureEntitlementLink } from './entitlements'

export {
  toCreditGrant,
  toCreditGrantRequest,
  useCreateCreditGrant,
  useCreditGrants,
  useDeleteCreditGrant,
  toUpdateCreditGrantRequest,
  useUpdateCreditGrant,
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
  useUpdateTenantMetadata,
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
  toAlertConfigRequest,
} from './alertSettings'
export type { AlertSettingPage, AlertSettingWire } from './alertSettings'

export { useCount, useInvoiceCount, useNavCounts } from './counts'
export { COUNT_CONCURRENCY, mapBounded, useFeatureLinkage } from './featureLinkage'
export type { FeatureLinkage } from './featureLinkage'
export { usePlanLinkage } from './planLinkage'
export { useAddonLinkage } from './addonLinkage'
export type { AddonLinkage } from './addonLinkage'
export { APPLY_STEP_LABEL, applySteps, useApplyPricingSchema, useParsePricing } from './aiPricing'
export { useEventDebug } from './eventDebug'
export { useHostedInvoice, useHostedInvoiceDownload, usePayHostedInvoice } from './hostedInvoice'
export type { ApplyResult, ApplyStep } from './aiPricing'
export type { PlanLinkage } from './planLinkage'
export type { CountableId } from './counts'

export { useCatalogStats } from './catalogStats'
export type { CatalogEntity, CatalogStats } from './catalogStats'

export { toUsageAnalytics, useUsageAnalytics, UsageWindowSize } from './events'
export {
  sumDecimals,
  toInvoicedRevenue,
  toRevenueOverview,
  useInvoicedRevenue,
  useRevenueOverview,
  useRevenueSeries,
} from './revenue'
export type {
  InvoicedCurrency,
  InvoicedRevenue,
  InvoicedRow,
  RevenueCustomer,
  RevenueDay,
  RevenueOverview,
  RevenueSummary,
} from './revenue'
export type {
  FeatureUsageRow,
  UsageAnalytics,
  UsageAnalyticsQuery,
  UsagePoint,
  UsageWindow,
} from './events'
export { fetchWorkflowRuns, toWorkflowFilter, toWorkflowRun, useWorkflowRuns } from './workflowRuns'
export type { WorkflowRunPage, WorkflowRunWire } from './workflowRuns'
export { fetchUsageSyncs, toUsageSync, useUsageSyncs } from './usageSyncs'
export type { UsageSyncPage, UsageSyncWire, UsageSyncEntryWire } from './usageSyncs'
export {
  fetchDataExports,
  toCreateDataExportRequest,
  toCreateS3ConnectionRequest,
  toDataExport,
  toDataExportFilter,
  toExportRun,
  toS3Connection,
  useCreateDataExport,
  useCreateS3Connection,
  useDataExport,
  useDataExportCounts,
  useDataExports,
  useDeleteDataExport,
  useDownloadExportRun,
  useExportRuns,
  useRunDataExport,
  useS3Connections,
  useSetDataExportEnabled,
} from './dataExports'
export type { DataExportPage, DataExportWire, ExportRunWire, S3ConnectionWire } from './dataExports'
export {
  countConnections,
  fetchIntegrations,
  toIntegrationConnection,
  toIntegrations,
  useCompleteOAuth,
  useConnectIntegration,
  useDisconnectIntegration,
  useIntegrations,
  useStartOAuth,
  useUpdateConnection,
} from './integrations'
export type { ConnectionWire, OAuthStart } from './integrations'
export {
  toCreateWalletRequest,
  toDebitRequest,
  toTopUpRequest,
  toUpdateAutoTopupRequest,
  toWallet,
  toWalletTransaction,
  useCreateWallet,
  useCustomerWallets,
  useDebitWallet,
  useTerminateWallet,
  useTopUpWallet,
  useUpdateAutoTopup,
  useWalletBalance,
  useWalletTransactions,
} from './wallets'
export type { WalletTransactionWire, WalletWire } from './wallets'
export {
  toCreateTaxAssociationRequest,
  toTaxAssociation,
  toUpdateTaxAssociationRequest,
  useCreateTaxAssociation,
  useCustomerTaxAssociations,
  useDeleteTaxAssociation,
  useUpdateTaxAssociation,
} from './taxAssociations'
export type { TaxAssociationEntityType, TaxAssociationWire } from './taxAssociations'

export {
  hourlyWindows,
  toWebhookAttempt,
  toWebhookEndpoint,
  toWebhookEndpointMessage,
  toWebhookEndpointStats,
  toWebhookEventType,
  toWebhookHeaders,
  toWebhookMessage,
  useCreateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useGenerateSvixPlayUrl,
  usePatchWebhookEndpointHeaders,
  useRecoverWebhookEndpoint,
  useResendWebhookMessage,
  useRotateWebhookEndpointSecret,
  useSendWebhookExample,
  useUpdateWebhookEndpoint,
  useWebhookActivity,
  useWebhookEndpoint,
  useWebhookEndpointHeaders,
  useWebhookEndpointMessages,
  useWebhookEndpointSecret,
  useWebhookEndpointStats,
  useWebhookEndpoints,
  useWebhookEventTypes,
  useWebhookMessage,
  useWebhookMessageAttempts,
  useWebhookMessages,
  useWebhookPortal,
} from './webhooks'
export type { WebhookPortalStatus } from './webhooks'

export {
  useEntityIntegrationLinks,
  useEntityIntegrationColumns,
  useEntityIntegrationControls,
} from './entityIntegrationLinks'

export { useContractChargeAlerts } from './contractChargeAlerts'
export { SAMPLE_EVENT_DURATION_SECONDS, useGenerateSampleEvents } from './sampleEvents'
export { useFetchSupportChatHash } from './supportChat'
export { useCustomerNames, useFeatureNames } from './entityNames'
export type { NameMap } from './entityNames'
export { toAccessControl, useAccessControl } from './access'
export type { AccessControl, AccessStatus } from './access'
export {
  isAccountLockedError,
  localToday as selfBillingToday,
  toCheckoutBody,
  toSelfBillingCheckout,
  toSelfBillingStatus,
  toSelfBillingSummary,
  useCancelSelfBillingCheckout,
  useRefreshSelfBilling,
  useSelfBillingCheckout,
  useSelfBillingPortalSession,
  useSelfBillingStatus,
  useSelfBillingSummary,
  useStartSelfBillingCheckout,
} from './selfBilling'
export {
  useAddPortalPaymentMethod,
  usePayPortalInvoice,
  usePortalConfig,
  usePortalCustomer,
  usePortalGateways,
  usePortalInvoice,
  usePortalInvoicePdf,
  usePortalInvoices,
  usePortalPaymentMethods,
  usePortalQuotas,
  usePortalSpend,
  usePortalSubscriptions,
  usePortalTopUps,
  usePortalWalletTransactions,
  usePortalWallets,
  useRemovePortalPaymentMethod,
  useSetDefaultPortalPaymentMethod,
  useTopUpPortalWallet,
  useUpdatePortalAutoTopup,
} from './customerPortal'
export type { PortalAction, PortalQuery } from './customerPortal'
export type { PortalAuth } from '@fp/api'
export { useCreateCustomerPortalSession } from './customerPortalSession'
export { useInvoiceHostedLink, useInvoiceHostedUrl } from './invoiceHostedLink'
export { usePushCustomerToIntegrations } from './integrationSync'
