/**
 * The seven settings keys, one file each.
 *
 * Everything behind `GET/PUT/DELETE /settings/{key}`. They share a route and a
 * lifecycle: read, edit, save, reset to the server's defaults: and nothing
 * else: an invoice numbering scheme and a customer portal's navigation tree
 * have no common shape worth extracting. So they are modelled separately and
 * collected here, rather than generalised into a `Setting<T>` that would make
 * every screen unwrap the same envelope.
 *
 * A folder rather than seven files at `src/` because they are read together:
 * a Settings page is the only thing that imports any of them: and because
 * `alertSetting.ts` is next door and is *not* one of these. See the warning at
 * the top of `walletAlertConfig.ts`.
 */
export {
  INVOICE_NUMBER_FORMATS,
  INVOICE_NUMBER_FORMAT_LABEL,
  defaultInvoiceConfig,
  invoiceConfigSchema,
  previewInvoiceNumber,
  splitDelay,
} from './invoiceConfig'
export type { InvoiceConfig, InvoiceNumberFormat } from './invoiceConfig'

export { defaultSubscriptionConfig, subscriptionConfigSchema } from './subscriptionConfig'
export type { SubscriptionConfig } from './subscriptionConfig'

export {
  customCurrencyConfigSchema,
  defaultCustomCurrencyConfig,
  emptyCustomCurrency,
  quotedFiatCurrencies,
} from './customCurrencyConfig'
export type { CustomCurrencyConfig, CustomCurrencyDefinition } from './customCurrencyConfig'

export {
  PORTAL_TAB_TYPE_LABEL,
  PortalTabType,
  customerPortalConfigSchema,
  emptyCustomerPortalConfig,
  orderedSections,
  orderedTabs,
  portalMetricCardsSchema,
  portalSectionSchema,
  portalTabLabel,
  portalTabSchema,
  portalThemeSchema,
  portalUsageGraphSchema,
  visibleTabTypes,
  withMetricCards,
  withSectionEnabled,
  withSectionOrder,
  withTabEnabled,
  withTabOrder,
  withUsageGraph,
} from './customerPortalConfig'
export type {
  CustomerPortalConfig,
  PortalMetricCards,
  PortalSection,
  PortalTab,
  PortalTheme,
  PortalUsageGraph,
} from './customerPortalConfig'

export {
  CUSTOMER_ONBOARDING_WORKFLOW,
  ONBOARDING_ACTION_LABEL,
  ONBOARDING_WALLET_TYPE_LABEL,
  OnboardingAction,
  OnboardingBillingCycle,
  OnboardingWalletType,
  createCustomerActionSchema,
  createFeatureAndPriceActionSchema,
  createSubscriptionActionSchema,
  createWalletActionSchema,
  customerOnboardingSchema,
  defaultCustomerOnboarding,
  emptyOnboardingAction,
  onboardingActionSchema,
  rolloutToSubscriptionsActionSchema,
} from './customerOnboarding'
export type {
  CreateCustomerAction,
  CreateFeatureAndPriceAction,
  CreateSubscriptionAction,
  CreateWalletAction,
  CustomerOnboarding,
  OnboardingActionConfig,
  RolloutToSubscriptionsAction,
} from './customerOnboarding'

export { defaultWalletAlertConfig, walletAlertConfigSchema } from './walletAlertConfig'
export type { WalletAlertConfig, WalletAlertThreshold } from './walletAlertConfig'

export {
  SAML_DEFAULT_ROLES,
  SAML_DEFAULT_ROLE_LABEL,
  SAML_UNAVAILABLE,
  defaultSamlConfig,
  samlConfigSchema,
} from './samlConfig'
export type { SamlConfig, SamlConfigDraft, SamlDefaultRole, SamlSettings } from './samlConfig'

export {
  EXTERNAL_TAX_PROVIDERS,
  TAX_PROVIDER_LABEL,
  TaxProvider,
  defaultTaxConfig,
  taxConfigSchema,
  usesExternalTaxEngine,
} from './taxConfig'
export type { TaxConfig } from './taxConfig'
