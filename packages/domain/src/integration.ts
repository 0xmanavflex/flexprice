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
    description:
      'Send invoices, calculate tax, and collect payments using our native connector to Stripe.',
    docsUrl: 'https://docs.flexprice.io/integrations/stripe/',
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    providerType: 'razorpay',
    categories: ['Payments', 'Invoices'],
    description: 'Accept, process and disburse payments using our native connector to Razorpay.',
    docsUrl: 'https://docs.flexprice.io/integrations/razorpay/',
  },
  {
    id: 'chargebee',
    name: 'Chargebee',
    providerType: 'chargebee',
    categories: ['Payments', 'Invoices'],
    description:
      'Sync invoices and charges/prices between Flexprice and Chargebee for seamless billing operations.',
    docsUrl: 'https://docs.flexprice.io/integrations/chargebee/',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    providerType: 'hubspot',
    categories: ['CRM', 'Sales', 'Marketing'],
    description: 'HubSpot is a CRM, sales, marketing and customer service platform.',
  },
  {
    id: 'zoho',
    name: 'Zoho',
    providerType: 'zoho_books',
    categories: ['Accounting', 'Invoices'],
    description:
      'The Zoho Books integration lets you manage critical accounting tasks directly from Flexprice.',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    providerType: 'quickbooks',
    categories: ['Accounting', 'Invoices'],
    description:
      'Sync plans, customers, and invoices from Flexprice to QuickBooks Online for seamless accounting operations.',
    docsUrl: 'https://docs.flexprice.io/integrations/quickbooks/',
  },
  {
    id: 'nomod',
    name: 'Nomod',
    providerType: 'nomod',
    categories: ['Payments', 'Invoices'],
    description:
      'Send invoices and collect payments using payment links through Nomod integration.',
    docsUrl: 'https://docs.flexprice.io/integrations/nomod',
  },
  {
    id: 'moyasar',
    name: 'Moyasar',
    providerType: 'moyasar',
    categories: ['Payments', 'Invoices'],
    description: 'Send invoices and collect payments using Moyasar payment gateway integration.',
    docsUrl: 'https://docs.flexprice.io/integrations/moyasar/',
  },
  {
    id: 'paddle',
    name: 'Paddle',
    providerType: 'paddle',
    categories: ['Payments', 'Invoices'],
    description: 'Send invoices and collect payments using Paddle payment gateway integration.',
  },
  {
    id: 'whop',
    name: 'Whop',
    providerType: 'whop',
    categories: ['Invoices', 'Payments'],
    description: 'Sync invoices to Whop with automatic payment status updates.',
  },
  {
    id: 'tabs',
    name: 'Tabs',
    providerType: 'tabs',
    categories: ['Payments', 'Invoices'],
    description: 'Sync invoices to Tabs using your Tabs API key.',
  },
  {
    id: 'aws_marketplace',
    name: 'AWS Marketplace',
    providerType: 'aws_marketplace',
    categories: ['Marketplace', 'Usage metering'],
    description:
      'Report metered usage to AWS Marketplace so your AWS buyers are billed for what they consume.',
    docsUrl: 'https://docs.flexprice.io/integrations/marketplace-integration/aws/connection-setup',
  },
  {
    id: 'gcp_marketplace',
    name: 'GCP Marketplace',
    providerType: 'gcp_marketplace',
    categories: ['Marketplace', 'Usage metering'],
    description:
      'Report metered usage to GCP Marketplace so your GCP buyers are billed for what they consume.',
    docsUrl: 'https://docs.flexprice.io/integrations/marketplace-integration/gcp/connection-setup',
  },
  {
    id: 'azure_marketplace',
    name: 'Azure Marketplace',
    providerType: 'azure_marketplace',
    categories: ['Marketplace', 'Usage metering'],
    description:
      'Report metered usage to Azure Marketplace so your Azure buyers are billed for what they consume.',
    docsUrl:
      'https://docs.flexprice.io/integrations/marketplace-integration/azure/connection-setup',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    providerType: 'salesforce',
    categories: ['CRM', 'Accounting'],
    description: 'Salesforce is a customer relationship management (CRM) platform.',
    premium: true,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    providerType: 'paypal',
    categories: ['Payment', 'Invoice customer'],
    description: 'PayPal is an online payment system that supports online money transfers.',
    premium: true,
  },
]

/** An integration as the grid shows it: the catalogue entry plus this environment's connection count. */
export interface Integration extends IntegrationSpec {
  connections: number
}
