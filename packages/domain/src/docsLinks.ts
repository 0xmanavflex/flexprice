/**
 * Every page of Flexprice's documentation the console links to, by topic.
 *
 * This is the one place a docs URL is written: a call site names the topic
 * (`DOCS.eventDebugger`), never the address, so a page that moves on
 * docs.flexprice.io is fixed here and nowhere else. Each URL is the page's
 * canonical address as `docs.flexprice.io/sitemap.xml` lists it, not one that
 * only works through a redirect; check a new one against the sitemap too.
 */
const BASE = 'https://docs.flexprice.io'

export const DOCS = {
  /** The welcome page, where the sidebar's Documentation row goes. */
  home: `${BASE}/docs/welcome-to-flexprice`,
  apiReference: `${BASE}/api-reference/introduction`,

  customers: `${BASE}/docs/customers/overview`,
  customerArchive: `${BASE}/docs/customers/archive`,
  apiCreateCustomer: `${BASE}/api-reference/customers/create-customer`,

  subscriptionCreate: `${BASE}/docs/subscriptions/customers-create-subscription`,
  subscriptionSettings: `${BASE}/docs/settings/settings#subscription-configuration`,

  plans: `${BASE}/docs/product-catalogue/plans/overview`,
  planCreate: `${BASE}/docs/product-catalogue/plans/create`,
  planPricing: `${BASE}/docs/product-catalogue/plans/pricing`,

  addons: `${BASE}/docs/product-catalogue/addons/overview`,
  addonCreate: `${BASE}/docs/product-catalogue/addons/create`,
  addonOnSubscription: `${BASE}/docs/product-catalogue/addons/add-to-subscription`,

  featureUseCases: `${BASE}/docs/product-catalogue/features/use-cases`,
  featureLinkToPlans: `${BASE}/docs/product-catalogue/features/linking-to-plans`,
  featureCustomExpression: `${BASE}/docs/product-catalogue/features/custom-expression`,

  coupons: `${BASE}/docs/product-catalogue/coupons/overview`,
  couponCreate: `${BASE}/docs/product-catalogue/coupons/create`,
  couponOnSubscription: `${BASE}/docs/product-catalogue/coupons/apply-discount-on-subscription`,

  groups: `${BASE}/docs/product-catalogue/groups/overview`,
  groupCreate: `${BASE}/docs/product-catalogue/groups/create`,
  groupCharges: `${BASE}/docs/product-catalogue/groups/charges-grouping`,

  pricingUnit: `${BASE}/docs/product-catalogue/custom-pricing/pricing-unit`,
  customCurrency: `${BASE}/docs/product-catalogue/custom-pricing/custom-currency`,
  customPricingUseCases: `${BASE}/docs/product-catalogue/custom-pricing/use-cases`,

  costTracking: `${BASE}/docs/ai-cost-tracking/overview`,
  costIngestAiUsage: `${BASE}/docs/ai-cost-tracking/ingesting-ai-usage`,
  apiCreateCostSheet: `${BASE}/api-reference/costs/create-costsheet`,

  apiCreateTaxAssociation: `${BASE}/api-reference/tax-associations/create-tax-association`,
  apiListTaxAssociations: `${BASE}/api-reference/tax-associations/list-tax-associations`,
  apiUpdateTaxAssociation: `${BASE}/api-reference/tax-associations/update-tax-association`,

  invoiceSettings: `${BASE}/docs/settings/settings#invoice-configuration`,
  apiCreateOneOffInvoice: `${BASE}/api-reference/invoices/create-one-off-invoice`,
  apiUpdateInvoicePaymentStatus: `${BASE}/api-reference/invoices/update-invoice-payment-status`,

  apiCreatePayment: `${BASE}/api-reference/payments/create-payment`,
  apiUpdatePayment: `${BASE}/api-reference/payments/update-payment`,

  apiCreateCreditNote: `${BASE}/api-reference/credit-notes/create-credit-note`,
  apiFinalizeCreditNote: `${BASE}/api-reference/credit-notes/finalize-credit-note`,
  apiVoidCreditNote: `${BASE}/api-reference/credit-notes/void-credit-note`,

  bonusCredits: `${BASE}/docs/settings/settings#bonus-credits-topup-configuration`,

  eventDebugger: `${BASE}/docs/event-ingestion/event-debugger`,
  apiIngestEvent: `${BASE}/api-reference/events/ingest-event`,
  apiBulkIngestEvents: `${BASE}/api-reference/events/bulk-ingest-events`,

  webhooks: `${BASE}/docs/webhook/webhooks`,
  webhookSignatures: `${BASE}/developers/webhooks/signature-verification`,
  webhookEventCatalog: `${BASE}/developers/webhooks/event-catalog`,

  serviceAccounts: `${BASE}/docs/rbac/service-accounts/create`,
  s3Export: `${BASE}/docs/data-exports/amazon-s3/export`,
  /** There is no guide to workflow runs yet; the API page lists what they are. */
  apiQueryWorkflows: `${BASE}/api-reference/workflows/query-workflows`,

  marketplaces: `${BASE}/integrations/marketplace-integration/overview`,
  marketplaceUsageReporting: `${BASE}/integrations/marketplace-integration/aws/usage-reporting`,

  /** Each integration's setup guide, where its catalogue card and credential help point. */
  integrations: {
    stripe: `${BASE}/integrations/stripe/connection-setup`,
    razorpay: `${BASE}/integrations/razorpay/connection-setup`,
    chargebee: `${BASE}/integrations/chargebee/connection-setup`,
    quickbooks: `${BASE}/integrations/quickbooks/connection-setup`,
    nomod: `${BASE}/integrations/nomod/connection-setup`,
    moyasar: `${BASE}/integrations/moyasar/connection-setup`,
    awsMarketplace: `${BASE}/integrations/marketplace-integration/aws/connection-setup`,
    gcpMarketplace: `${BASE}/integrations/marketplace-integration/gcp/connection-setup`,
    azureMarketplace: `${BASE}/integrations/marketplace-integration/azure/connection-setup`,
  },
} as const
