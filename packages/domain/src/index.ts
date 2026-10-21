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
export { activityByline, activitySourceLabel, activityTitle, describeActivity } from './activity'
export type { ActivityEntry, ActivityFacts } from './activity'
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
  FILTER_OPS,
  FilterOp,
  decodeListFilters,
  encodeListFilters,
  isRunnableFilter,
  runnableFilters,
  withFilterOptions,
} from './listFilter'
export type { FilterKind, ListFilter, ListFilterSpec } from './listFilter'

export {
  DEFAULT_INVOICE_QUERY,
  INVOICE_FILTERS,
  InvoiceLinePriceType,
  InvoiceSortField,
  InvoiceStatus,
  createInvoiceSchema,
  sumLineAmounts,
  deriveInvoiceStatus,
  emptyInvoice,
  isStoredInvoiceStatus,
  needsAttention,
  STORED_INVOICE_STATUSES,
} from './invoice'
export type {
  CreateInvoice,
  Invoice,
  InvoiceDetail,
  InvoiceDetailLine,
  InvoiceQuery,
  InvoiceStatusInput,
  InvoiceTax,
} from './invoice'

export {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BILLING_PERIOD_SHORT,
  BillingModel,
  BillingPeriod,
  INVOICE_CADENCE_LABEL,
  InvoiceCadence,
  PRICE_TYPE_LABEL,
  PRICE_WINDOW_SIZE_LABEL,
  PriceEntityType,
  PriceType,
  PriceWindowSize,
  WINDOWABLE_AGGREGATIONS,
  RoundType,
  TIER_MODE_LABEL,
  TierMode,
  chargeToDraft,
  createChargeSchema,
  emptyCharge,
  nonNegativeAmount,
  priceTierSchema,
  tiersSchema,
  chargeLineages,
  type ChargeLineage,
} from './price'
export type { Charge, CreateCharge, PriceTier, Tier } from './price'
export { ChargeSection, chargeFlags, isChargeCustomised } from './chargeFlags'
export type {
  ChargeAlert,
  ChargeCommitmentDetail,
  ChargeCommitmentWindow,
  ChargeCoupon,
  ChargeDetail,
  ChargeFlag,
  ChargeVersion,
} from './chargeFlags'

export { emptyOverride, priceOverrideSchema } from './priceOverride'
export type { PriceOverride } from './priceOverride'

export {
  EntitlementEntityType,
  USAGE_RESET_PERIOD_LABEL,
  UsageResetPeriod,
  createEntitlementSchema,
  emptyEntitlement,
  editEntitlementSchema,
  entitlementToEdit,
  EntitlementGrantMeasure,
  EntitlementGrantDurationUnit,
  EntitlementGrantAllocationBehavior,
  EntitlementAggregationMode,
} from './entitlement'
export type { CreateEntitlement, Entitlement, EditEntitlement } from './entitlement'

export {
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  CreditGrantCadence,
  CreditGrantExpiryDurationUnit,
  CreditGrantExpiryType,
  CreditGrantPeriod,
  CreditGrantScope,
  createCreditGrantSchema,
  emptyCreditGrant,
  editCreditGrantSchema,
  creditGrantToEdit,
  creditGrantToDraft,
} from './creditGrant'
export type { CreateCreditGrant, CreditGrant, EditCreditGrant } from './creditGrant'

export {
  AGGREGATION_LABEL,
  aggregationFormula,
  AggregationType,
  DEFAULT_FEATURE_QUERY,
  FEATURE_FILTERS,
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
  meterFilterSchema,
  reportingUnitSchema,
  editFeatureSchema,
  cloneFeatureSchema,
  defaultFeatureLookupKey,
  emptyCloneFeature,
} from './feature'
export type {
  CreateFeature,
  Feature,
  FeatureQuery,
  MeterDraft,
  MeterFilterDraft,
  ReportingUnitDraft,
  EditFeature,
  CloneFeature,
} from './feature'

export {
  DEFAULT_PLAN_QUERY,
  PLAN_FILTERS,
  PLAN_KIND_LABEL,
  PLAN_SORT_LABEL,
  PLAN_STATUS_LABEL,
  PlanKind,
  PlanSortField,
  PlanStatus,
  PlanView,
  createPlanSchema,
  emptyPlan,
  planKind,
  planKindLabel,
} from './plan'
export type { CreatePlan, Plan, PlanHeadline, PlanQuery } from './plan'

export {
  ADDON_SORT_LABEL,
  ADDON_STATUS_LABEL,
  AddonSortField,
  AddonStatus,
  AddonView,
  DEFAULT_ADDON_QUERY,
  ADDON_FILTERS,
  createAddonSchema,
  emptyAddon,
} from './addon'
export type { Addon, AddonQuery, CreateAddon } from './addon'

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
  COUPON_FILTERS,
  editCouponSchema,
  createCouponSchema,
  emptyCoupon,
} from './coupon'
export type { Coupon, CouponAssociation, CouponQuery, EditCoupon, CreateCoupon } from './coupon'

export {
  DEFAULT_PRICE_UNIT_QUERY,
  PRICE_UNIT_FILTERS,
  PRICE_UNIT_CURRENCIES,
  PRICE_UNIT_SORT_LABEL,
  PRICE_UNIT_STATUS_LABEL,
  PriceUnitSortField,
  PriceUnitStatus,
  PriceUnitView,
  createPriceUnitSchema,
  emptyPriceUnit,
} from './priceUnit'
export type { CreatePriceUnit, PriceUnit, PriceUnitQuery } from './priceUnit'

export {
  DEFAULT_GROUP_QUERY,
  GROUP_FILTERS,
  GROUP_ENTITY_TYPE_LABEL,
  GROUP_SORT_LABEL,
  GROUP_STATUS_LABEL,
  GroupEntityType,
  GroupSortField,
  GroupStatus,
  GroupView,
  createGroupSchema,
  emptyGroup,
} from './group'
export type { Group, GroupQuery, CreateGroup } from './group'

export {
  COST_SHEET_SORT_LABEL,
  COST_SHEET_STATUS_LABEL,
  CostSheetSortField,
  CostSheetStatus,
  CostSheetView,
  DEFAULT_COST_SHEET_QUERY,
  COST_SHEET_FILTERS,
  createCostSheetSchema,
  editCostSheetSchema,
  emptyCostSheet,
  costSheetToEdit,
} from './costSheet'
export type { CostSheet, CostSheetQuery, CreateCostSheet, EditCostSheet } from './costSheet'

export {
  CUSTOMER_SORT_LABEL,
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_TAX_TREATMENT_LABEL,
  CustomerSortField,
  CustomerStatus,
  CustomerTaxTreatment,
  DEFAULT_CUSTOMER_QUERY,
  CUSTOMER_FILTERS,
  createCustomerSchema,
  editCustomerSchema,
  emptyCustomer,
  customerToEdit,
} from './customer'
export type {
  Customer,
  CustomerDetail,
  CustomerIntegration,
  IntegrationLink,
  CustomerQuery,
  CreateCustomer,
  EditCustomer,
} from './customer'

export {
  DEFAULT_SUBSCRIPTION_QUERY,
  SUBSCRIPTION_FILTERS,
  SUBSCRIPTION_BILLING_PERIODS,
  SUBSCRIPTION_CANCELLATION_TYPES,
  SUBSCRIPTION_SCHEDULE_LABEL,
  SUBSCRIPTION_SORT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  SubscriptionScheduleType,
  SubscriptionSortField,
  SubscriptionStatus,
  createSubscriptionSchema,
  emptySubscription,
  emptyPhase,
  phaseStarts,
  subscriptionDiscountSchema,
  subscriptionPhaseSchema,
  chargeCommitmentSchema,
  commitmentWindowSchema,
  CommitmentType,
  WindowBillingModel,
  WINDOW_BILLING_MODEL_LABEL,
  type CommitmentWindow,
  type CommitmentPriceBase,
  PaymentTerms,
  PAYMENT_TERMS_LABEL,
  BillingCycle,
  validateLineChange,
  lineLineages,
  lineRevertDraft,
  type LineLineage,
} from './subscription'
export type {
  ChangeLineQuantity,
  LineChangeError,
  LineChangePreview,
  EndContractCharge,
  CancelSubscription,
  CreateSubscription,
  SubscriptionDiscount,
  SubscriptionPhase,
  ChargeCommitment,
  InvoicePreview,
  InvoicePreviewLine,
  Subscription,
  SubscriptionAddon,
  SubscriptionCancellationType,
  SubscriptionCoupon,
  SubscriptionDetail,
  SubscriptionEntitlement,
  SubscriptionLine,
  SubscriptionLineSource,
  SubscriptionQuery,
  SubscriptionSchedule,
  SubscriptionTax,
  AddContractAddon,
  AddContractCoupon,
  SubscriptionUsage,
  SubscriptionUsageCharge,
} from './subscription'

export {
  BUCKET_SIZE_LABEL,
  BucketSize,
  COMMITMENT_KIND_LABEL,
  CommitmentKind,
  NO_USAGE_TERMS,
  PRORATION,
  PRORATION_LABEL,
  hasTermsErrors,
  validateContractTerms,
} from './contractCharge'
export type {
  AddContractCharge,
  ContractTermsErrors,
  EditContractCharge,
  LineCommitment,
  LinePricing,
  Proration,
  UsageTerms,
} from './contractCharge'

export {
  DEFAULT_PAYMENT_QUERY,
  PAYMENT_METHOD_LABEL,
  PAYMENT_SORT_LABEL,
  PAYMENT_STATUS_LABEL,
  PaymentMethod,
  PaymentSortField,
  PaymentStatus,
  emptyPayment,
  recordPaymentSchema,
  toPaymentStatus,
} from './payment'
export type { Payment, PaymentDetail, PaymentQuery, RecordPayment } from './payment'

export {
  CREDIT_NOTE_REASON_LABEL,
  CREDIT_NOTE_REFUND_TARGET_LABEL,
  CREDIT_NOTE_STATUS_LABEL,
  CREDIT_NOTE_TYPE_LABEL,
  CreditNoteReason,
  CreditNoteStatus,
  CreditNoteType,
  DEFAULT_CREDIT_NOTE_QUERY,
  createCreditNoteSchema,
  emptyCreditNote,
} from './creditNote'
export type {
  CreateCreditNote,
  CreditNote,
  CreditNoteDetail,
  CreditNoteDetailLine,
  CreditNoteQuery,
} from './creditNote'

export {
  DEFAULT_TAX_RATE_QUERY,
  TAX_RATE_SCOPE_LABEL,
  TAX_RATE_SORT_LABEL,
  TAX_RATE_STATUS_LABEL,
  TaxRateScope,
  TaxRateSortField,
  TaxRateStatus,
  createTaxRateSchema,
  editTaxRateSchema,
  emptyTaxRate,
  taxRateToEdit,
} from './taxRate'
export type { TaxRate, TaxRateQuery, CreateTaxRate, EditTaxRate } from './taxRate'

export { DEFAULT_RAW_EVENT_QUERY } from './rawEvent'
export type { RawEvent, RawEventQuery } from './rawEvent'

/**
 * Settings: who is in the organisation, what they may do, and what it pays.
 */
export {
  DEFAULT_MEMBER_QUERY,
  DEFAULT_SERVICE_ACCOUNT_QUERY,
  MEMBER_TYPE_LABEL,
  MemberType,
  createServiceAccountSchema,
  emptyInvite,
  emptyServiceAccount,
  inviteMemberSchema,
  isServiceAccount,
  matchesMemberQuery,
  memberDisplayName,
  renameMemberSchema,
} from './user'
export type { CreateServiceAccount, InviteMember, Member, MemberQuery, RenameMember } from './user'

export {
  RoleAudience,
  SUPER_ADMIN_ROLE_ID,
  grantsEverything,
  isRoleSelected,
  isSuperAdminRole,
  normalizeRoleSelection,
  summarizePermissions,
  toggleRole,
} from './role'
export type { Role, RolePermission } from './role'

export {
  API_KEY_STATUS_LABEL,
  API_KEY_TYPE_LABEL,
  ApiKeyStatus,
  ApiKeyType,
  ISSUABLE_API_KEY_TYPES,
  createApiKeySchema,
  emptyApiKey,
  isActive,
  isExpired,
} from './apiKey'
export type { ApiKey, CreateApiKey, CreatedApiKey } from './apiKey'

export {
  EMPTY_TENANT_BILLING_USAGE,
  TenantStatus,
  emptyAddress,
  formatAddress,
  isEmptyAddress,
  isOverLimit,
  toUpdateTenantDraft,
  updateTenantSchema,
  TenantMetadataKey,
  TenantMetadataFlag,
  isTenantOnboarded,
} from './tenant'
export type {
  Tenant,
  TenantAddress,
  TenantBillingUsage,
  TenantFeatureUsage,
  TenantPlan,
  UpdateTenant,
} from './tenant'

export {
  ALERT_CONDITION_LABEL,
  ALERT_ENTITY_TYPE_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_SEVERITY_ORDER,
  ALERT_THRESHOLD_TYPE_LABEL,
  AlertCondition,
  AlertEntityType,
  AlertSeverity,
  AlertThresholdType,
  alertSettingConfigSchema,
  configuredSeverities,
  createAlertSettingSchema,
  emptyAlertSettingConfig,
  toAlertSettingConfig,
  DEFAULT_ALERT_SETTING_QUERY,
} from './alertSetting'
export type {
  AlertSetting,
  AlertSettingConfig,
  AlertSettingQuery,
  AlertThreshold,
  CreateAlertSetting,
} from './alertSetting'

/**
 * The seven `/settings/{key}` records — invoice numbering, subscription
 * dunning, custom currencies, the customer portal, onboarding automation,
 * wallet alerts and SAML.
 *
 * Enumerated here rather than `export *`-ed, like everything else in this
 * file, so that what the package offers is readable in one place. The keys
 * themselves live in `settings/`, one file each — and mind that the
 * tenant-wide wallet alert config is not the per-entity `alertSetting.ts`
 * above.
 */
export {
  CUSTOMER_ONBOARDING_WORKFLOW,
  INVOICE_NUMBER_FORMATS,
  INVOICE_NUMBER_FORMAT_LABEL,
  ONBOARDING_ACTION_LABEL,
  ONBOARDING_WALLET_TYPE_LABEL,
  OnboardingAction,
  OnboardingBillingCycle,
  OnboardingWalletType,
  PORTAL_TAB_TYPE_LABEL,
  PortalTabType,
  SAML_DEFAULT_ROLES,
  SAML_DEFAULT_ROLE_LABEL,
  SAML_UNAVAILABLE,
  createCustomerActionSchema,
  createFeatureAndPriceActionSchema,
  createSubscriptionActionSchema,
  createWalletActionSchema,
  customCurrencyConfigSchema,
  customerOnboardingSchema,
  customerPortalConfigSchema,
  defaultCustomCurrencyConfig,
  defaultCustomerOnboarding,
  defaultInvoiceConfig,
  defaultSamlConfig,
  defaultSubscriptionConfig,
  defaultWalletAlertConfig,
  emptyCustomCurrency,
  emptyCustomerPortalConfig,
  emptyOnboardingAction,
  invoiceConfigSchema,
  onboardingActionSchema,
  orderedSections,
  orderedTabs,
  portalMetricCardsSchema,
  portalSectionSchema,
  portalTabLabel,
  portalTabSchema,
  portalThemeSchema,
  portalUsageGraphSchema,
  previewInvoiceNumber,
  quotedFiatCurrencies,
  rolloutToSubscriptionsActionSchema,
  samlConfigSchema,
  splitDelay,
  subscriptionConfigSchema,
  visibleTabTypes,
  walletAlertConfigSchema,
  withMetricCards,
  withSectionEnabled,
  withSectionOrder,
  withTabEnabled,
  withTabOrder,
  withUsageGraph,
} from './settings'
export type {
  CreateCustomerAction,
  CreateFeatureAndPriceAction,
  CreateSubscriptionAction,
  CreateWalletAction,
  CustomCurrencyConfig,
  CustomCurrencyDefinition,
  CustomerOnboarding,
  CustomerPortalConfig,
  InvoiceConfig,
  InvoiceNumberFormat,
  OnboardingActionConfig,
  PortalMetricCards,
  PortalSection,
  PortalTab,
  PortalTheme,
  PortalUsageGraph,
  RolloutToSubscriptionsAction,
  SamlConfig,
  SamlConfigDraft,
  SamlDefaultRole,
  SamlSettings,
  SubscriptionConfig,
  WalletAlertConfig,
  WalletAlertThreshold,
} from './settings'

export { resetRequestSchema, setPasswordSchema, signInSchema, signUpSchema } from './auth'
export type { ResetRequest, SetPassword, SignInCredentials, SignUpDetails } from './auth'
export {
  ENVIRONMENT_TYPE_DESCRIPTION,
  ENVIRONMENT_TYPE_LABEL,
  EnvironmentType,
  SANDBOX_AUTO_CANCELLATION_DAYS,
  createEnvironmentSchema,
  emptyEnvironment,
  environmentKind,
  environmentSchema,
} from './environment'
export type { CreateEnvironment, Environment } from './environment'
export {
  DEFAULT_WORKFLOW_QUERY,
  WORKFLOW_STATUS_LABEL,
  WORKFLOW_STATUS_WIRE,
  WorkflowStatus,
} from './workflowRun'
export type { WorkflowQuery, WorkflowRun } from './workflowRun'
export { DEFAULT_USAGE_SYNC_QUERY, USAGE_SYNC_STATE, USAGE_SYNC_STATE_LABEL } from './usageSync'
export type { UsageSync, UsageSyncEntry, UsageSyncQuery, UsageSyncState } from './usageSync'
export {
  ALLOWED_METADATA_ENTITIES,
  DEFAULT_DATA_EXPORT_QUERY,
  DEFAULT_EXPORT_RUN_QUERY,
  EXPORT_ENTITY,
  EXPORT_ENTITY_LABEL,
  EXPORT_INTERVAL,
  EXPORT_INTERVAL_LABEL,
  EXPORT_METADATA_ENTITY,
  EXPORT_METADATA_ENTITY_LABEL,
  EXPORT_RUN_STATUS,
  EXPORT_RUN_STATUS_LABEL,
  EXPORT_STATE,
  clampMetadataFields,
  emptyDataExport,
  emptyS3Connection,
  validateDataExport,
  validateS3Connection,
} from './dataExport'
export type {
  CreateDataExport,
  CreateS3Connection,
  DataExport,
  DataExportErrors,
  DataExportQuery,
  ExportEntity,
  ExportInterval,
  ExportMetadataEntity,
  ExportMetadataField,
  ExportRun,
  ExportRunQuery,
  ExportRunRequest,
  ExportRunStatus,
  ExportState,
  S3Connection,
  S3ConnectionErrors,
} from './dataExport'
export { INTEGRATION_CATALOG } from './integration'
export type { Integration, IntegrationConnection, IntegrationSpec } from './integration'
export * from './integrationConnect'
export {
  WALLET_STATUS_LABEL,
  WalletStatus,
  WalletTopUpKind,
  autoTopupSchema,
  createWalletSchema,
  emptyAutoTopup,
  debitWalletSchema,
  emptyDebit,
  emptyTopUp,
  emptyWallet,
  topUpWalletSchema,
} from './wallet'
export type {
  AutoTopup,
  CreateWallet,
  DebitWallet,
  TopUpWallet,
  Wallet,
  WalletConsumption,
  WalletTransaction,
  WalletTransactionDirection,
} from './wallet'
export {
  TAX_BEHAVIOR_LABEL,
  TaxBehavior,
  createTaxAssociationSchema,
  editTaxAssociationSchema,
  emptyTaxAssociation,
} from './taxAssociation'
export type { CreateTaxAssociation, EditTaxAssociation, TaxAssociation } from './taxAssociation'
export {
  WEBHOOK_DELIVERY_STATUS_LABEL,
  WEBHOOK_RECOVER_WINDOWS,
  WebhookDeliveryStatus,
  createWebhookEndpointSchema,
  emptyWebhookEndpoint,
  groupWebhookEventTypes,
  recoverSince,
  webhookErrorRate,
} from './webhook'
export type {
  CreateWebhookEndpoint,
  WebhookActivityPoint,
  WebhookAttempt,
  WebhookEndpoint,
  WebhookEndpointMessage,
  WebhookEndpointPatch,
  WebhookEndpointStats,
  WebhookEventType,
  WebhookEventTypeGroup,
  WebhookHeader,
  WebhookMessage,
  WebhookRecoverWindow,
  WebhookStatusFilter,
} from './webhook'

export * from './suggestKey'

export { currencyCodes } from './currencies'
export {
  MANUAL_PAYMENT_STATUS_EFFECT,
  manualPaymentStatusBlocked,
  manualPaymentStatusChoices,
  toWirePaymentStatus,
} from './invoicePaymentStatus'

export {
  AI_SETUP_METADATA,
  normalisePricingSchema,
  pricingSchemaProblems,
  pricingSchemaTotals,
} from './pricingSchema'
export type {
  PricingCreditGrant,
  PricingEntitlement,
  PricingFeature,
  PricingPlan,
  PricingPrice,
  PricingSchema,
  PricingUsageCharge,
} from './pricingSchema'
export { GEMINI_PRICING_SCHEMA, SYSTEM_PROMPT, buildPricingPrompt } from './pricingPrompt'

export {
  EVENT_DEBUG_STAGES,
  EVENT_DEBUG_STAGE_LABEL,
  EVENT_DEBUG_STAGE_WIRE,
  eventDebugSummary,
  toEventDebug,
} from './eventDebug'
export type {
  EventDebug,
  EventDebugMatch,
  EventDebugOutcome,
  EventDebugStage,
  EventDebugStageResult,
  EventVersion,
  ProcessedUsage,
} from './eventDebug'

export { COUNTRY_CODES, countryName, countryOptions } from './countries'
export type { CountryCode, CountryOption } from './countries'
export {
  IANA_TIMEZONES,
  timezoneChoices,
  timezoneOptions as toTimezoneOptions,
  toTimezoneOption,
} from './timezones'
export type { TimezoneOption } from './timezones'

export { cadenceAllowed, selectContractCharges } from './contractCharges'
export type { ContractChargeSelection } from './contractCharges'
export {
  RBAC_ACTION,
  RBAC_ENTITY,
  accessDeniedReason,
  canAccess,
  canDeleteMember,
  canEditMemberRoles,
  canRemoveMember,
  isSuperAdmin,
  meetsRequirement,
  resolveGrants,
} from './access'
export type { AccessGrants, AccessRequirement, RbacAction, RbacEntity } from './access'
