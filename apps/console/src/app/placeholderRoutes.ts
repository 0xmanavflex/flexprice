/**
 * The destinations that exist in the navigation but not yet in V2.
 *
 * This table is the migration's to-do list, and it is deliberately in one
 * place: a row disappears when its real page lands, so the size of this file
 * is the size of what is left. Descriptions are written for the person using
 * the screen, not the person building it.
 *
 * `legacy` is the path in the current dashboard. The origin is configuration —
 * see `VITE_LEGACY_CONSOLE_URL`.
 */
export interface PlaceholderRoute {
  path: string
  title: string
  description: string
  legacy?: string
}

export const PLACEHOLDER_ROUTES = [
  {
    path: '/',
    title: 'Home',
    description: 'Revenue, usage and anything that needs attention today.',
    legacy: '/',
  },

  // Product catalogue
  {
    path: '/plans',
    title: 'Plans',
    description: 'What you sell, and what each plan charges for.',
    legacy: '/product-catalog/plans',
  },
  {
    path: '/coupons',
    title: 'Coupons',
    description: 'Discounts you can apply to a subscription or an invoice.',
    legacy: '/product-catalog/coupons',
  },
  {
    path: '/addons',
    title: 'Addons',
    description: 'Extras a customer can buy alongside a plan.',
    legacy: '/product-catalog/addons',
  },
  {
    path: '/cost-sheets',
    title: 'Cost Sheets',
    description: 'What each unit of usage costs you, so margin is visible.',
    legacy: '/product-catalog/cost-sheets',
  },
  {
    path: '/price-units',
    title: 'Price Units',
    description: 'The units you price in — tokens, seats, gigabytes.',
    legacy: '/product-catalog/price-units',
  },
  {
    path: '/groups',
    title: 'Groups',
    description: 'Collections of features and plans, managed together.',
    legacy: '/product-catalog/groups',
  },
  {
    path: '/pricing-widget',
    title: 'Pricing Widget',
    description: 'The embeddable pricing table your customers see.',
    legacy: '/product-catalog/pricing-widget',
  },

  // Billing
  {
    path: '/customers',
    title: 'Customers',
    description: 'Who you bill, what they are on, and what they owe.',
    legacy: '/customer-management/customers',
  },
  {
    path: '/subscriptions',
    title: 'Subscriptions',
    description: 'Every active, paused and cancelled subscription.',
    legacy: '/customer-management/subscriptions',
  },
  {
    path: '/payments',
    title: 'Payments',
    description: 'Money received, and anything that failed to collect.',
    legacy: '/billing/payments',
  },
  {
    path: '/credit-notes',
    title: 'Credit Notes',
    description: 'Refunds and adjustments issued against invoices.',
    legacy: '/billing/credit-notes',
  },
  {
    path: '/taxes',
    title: 'Taxes',
    description: 'Tax rates, and where each one applies.',
    legacy: '/billing/taxes',
  },
  {
    path: '/revenue',
    title: 'Revenue',
    description: 'Recognised revenue, billed and unbilled.',
    legacy: '/revenue',
  },

  // Developers
  {
    path: '/events',
    title: 'Events Debugger',
    description: 'The raw usage events as they arrived, so you can see why a bill is what it is.',
    legacy: '/usage-tracking/events',
  },
  {
    path: '/api-keys',
    title: 'API Keys',
    description: 'Keys your systems use to send usage and read billing data.',
    legacy: '/developers/api-keys',
  },
  {
    path: '/service-accounts',
    title: 'Service Accounts',
    description: 'Non-human identities, and what each one may do.',
    legacy: '/developers/service-accounts',
  },
  {
    path: '/webhooks',
    title: 'Webhooks',
    description: 'Where Flexprice tells your systems that something happened.',
    legacy: '/developers/webhooks',
  },
  {
    path: '/exports',
    title: 'Exports',
    description: 'Scheduled extracts of billing data to your own storage.',
    legacy: '/tools/exports',
  },
  {
    path: '/usage-syncs',
    title: 'Usage Syncs',
    description: 'Usage pulled in from somewhere else, and whether it is current.',
    legacy: '/tools/usage-syncs',
  },
  {
    path: '/workflows',
    title: 'Workflows',
    description: 'Automations that run on billing events, and their recent runs.',
    legacy: '/developers/workflows',
  },

  // Elsewhere
  {
    path: '/integrations',
    title: 'Integrations',
    description: 'Connections to your payment processor, ledger and data warehouse.',
    legacy: '/tools/integrations',
  },
  {
    path: '/settings',
    title: 'Settings',
    description: 'Your organisation, its members, and how billing behaves by default.',
    legacy: '/settings',
  },
  {
    path: '/docs',
    title: 'Documentation',
    description: 'How Flexprice works, and the API reference.',
  },
] as const satisfies readonly PlaceholderRoute[]
