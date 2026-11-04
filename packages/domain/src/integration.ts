import { DOCS } from './docsLinks'
/**
 * The integrations Flexprice can connect to, and whether this environment has
 * connected each. The catalogue is fixed product knowledge (V1 hard-codes it
 * too); only the connection state comes from the API.
 */
export interface IntegrationSpec {
  id: string
  name: string
  description: string
  /** The `provider_type` a connection of this integration carries. */
  providerType: string
  categories: string[]
  docsUrl?: string
  /** Not self-serve: shown as a premium add-on rather than a connectable app. */
  premium?: boolean
}

export const INTEGRATION_CATALOG: IntegrationSpec[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    providerType: 'stripe',
    categories: ['Payments', 'Invoices'],
    description: 'Collect payments, sync invoices and calculate tax with Stripe.',
    docsUrl: DOCS.integrations.stripe,
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    providerType: 'razorpay',
    categories: ['Payments', 'Invoices'],
    description: 'Send invoices to Razorpay and collect payment on them.',
    docsUrl: DOCS.integrations.razorpay,
  },
  {
    id: 'chargebee',
    name: 'Chargebee',
    providerType: 'chargebee',
    categories: ['Payments', 'Invoices'],
    description: 'Send invoices to Chargebee.',
    docsUrl: DOCS.integrations.chargebee,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    providerType: 'hubspot',
    categories: ['CRM', 'Sales', 'Marketing'],
    description: 'Push deals, quotes and invoices to HubSpot.',
  },
  {
    id: 'zoho',
    name: 'Zoho',
    providerType: 'zoho_books',
    categories: ['Accounting', 'Invoices'],
    description: 'Send invoices to Zoho Books and pull customers from it.',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    providerType: 'quickbooks',
    categories: ['Accounting', 'Invoices'],
    description: 'Send invoices to QuickBooks Online and pull payments back.',
    docsUrl: DOCS.integrations.quickbooks,
  },
  {
    id: 'nomod',
    name: 'Nomod',
    providerType: 'nomod',
    categories: ['Payments', 'Invoices'],
    description: 'Collect payments with Nomod payment links.',
    docsUrl: DOCS.integrations.nomod,
  },
  {
    id: 'moyasar',
    name: 'Moyasar',
    providerType: 'moyasar',
    categories: ['Payments', 'Invoices'],
    description: 'Collect payments through Moyasar.',
    docsUrl: DOCS.integrations.moyasar,
  },
  {
    id: 'paddle',
    name: 'Paddle',
    providerType: 'paddle',
    categories: ['Payments', 'Invoices'],
    description: 'Collect payments through Paddle.',
  },
  {
    id: 'whop',
    name: 'Whop',
    providerType: 'whop',
    categories: ['Payments', 'Invoices'],
    description: 'Sync invoices to Whop and keep payment status current.',
  },
  {
    id: 'tabs',
    name: 'Tabs',
    providerType: 'tabs',
    categories: ['Payments', 'Invoices'],
    description: 'Sync invoices to Tabs.',
  },
  {
    id: 'aws_marketplace',
    name: 'AWS Marketplace',
    providerType: 'aws_marketplace',
    categories: ['Marketplace', 'Usage metering'],
    description: 'Bill AWS Marketplace buyers for their metered usage.',
    docsUrl: DOCS.integrations.awsMarketplace,
  },
  {
    id: 'gcp_marketplace',
    name: 'GCP Marketplace',
    providerType: 'gcp_marketplace',
    categories: ['Marketplace', 'Usage metering'],
    description: 'Bill GCP Marketplace buyers for their metered usage.',
    docsUrl: DOCS.integrations.gcpMarketplace,
  },
  {
    id: 'azure_marketplace',
    name: 'Azure Marketplace',
    providerType: 'azure_marketplace',
    categories: ['Marketplace', 'Usage metering'],
    description: 'Bill Azure Marketplace buyers for their metered usage.',
    docsUrl: DOCS.integrations.azureMarketplace,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    providerType: 'salesforce',
    categories: ['CRM', 'Accounting'],
    description: 'Connect Salesforce to your billing data.',
    premium: true,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    providerType: 'paypal',
    categories: ['Payment', 'Invoice customer'],
    description: 'Collect payments through PayPal.',
    premium: true,
  },
]

/**
 * Providers a card can be saved at from a customer's page, through a hosted
 * setup page (`POST /payments/customers/{id}/setup/intent`). V1 offers Stripe
 * from the customer page and Moyasar from its mapping card; Razorpay is offered
 * as well. The menu item shows only when one of these is connected.
 */
export const CARD_SETUP_PROVIDERS = ['stripe', 'razorpay', 'moyasar'] as const

/** A published connection. Secrets never come back from the API, so none are here. */
export interface IntegrationConnection {
  id: string
  name: string
  providerType: string
  /** Entity → which directions are on, as the connection was saved. */
  syncConfig: Record<string, { inbound?: boolean; outbound?: boolean }>
  /** The non-secret settings saved with it (environment, redirect URLs). */
  metadata: Record<string, string>
  /** The billing entity that owns it; null when the environment has no entities or the provider is not per entity. */
  billingEntityId: string | null
  /** Whether the secret that verifies its inbound webhooks is saved; absent for providers without webhooks. */
  webhookSecretSet?: boolean | undefined
  createdAt?: string | undefined
}

/** An integration as the grid shows it: the catalogue entry plus this environment's published connections. */
export interface Integration extends IntegrationSpec {
  connections: IntegrationConnection[]
}
