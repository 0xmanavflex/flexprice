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
  /**
   * The empty state's own copy, written as a product would write it.
   *
   * Not derived from `title`: "No cost sheets yet" and "No integrations
   * connected" are not the same sentence with a noun swapped, and a page where
   * records arrive rather than being made — payments, events, revenue — must
   * not offer to create one.
   */
  emptyTitle: string
  emptyDescription: string
  /** The primary action's label, or `null` where creating one is not the move. */
  cta: string | null
  legacy?: string
}

export const PLACEHOLDER_ROUTES = [
  {
    path: '/',
    title: 'Home',
    description: 'Revenue, usage and anything that needs attention today.',
    emptyTitle: 'Nothing to show yet',
    emptyDescription:
      'Revenue, usage and anything needing attention will appear here once you have customers.',
    cta: null,
    legacy: '/',
  },

  // Product catalogue
  // `/plans` is a real page now — see `plansRoute` in router.tsx.
  // `/coupons` is a real page now — see `couponsRoute` in router.tsx.
  // `/addons` is a real page now — see `addonsRoute` in router.tsx.
  {
    path: '/cost-sheets',
    title: 'Cost Sheets',
    description: 'What each unit of usage costs you, so margin is visible.',
    emptyTitle: 'No cost sheets yet',
    emptyDescription:
      'Cost sheets record what usage costs you, so margin can be measured against what you charge.',
    cta: 'Create cost sheet',
    legacy: '/product-catalog/cost-sheets',
  },
  {
    path: '/price-units',
    title: 'Price Units',
    description: 'The units you price in — tokens, seats, gigabytes.',
    emptyTitle: 'No price units yet',
    emptyDescription:
      'Price units let you charge in credits, tokens or minutes instead of a currency.',
    cta: 'Create price unit',
    legacy: '/product-catalog/price-units',
  },
  {
    path: '/groups',
    title: 'Groups',
    description: 'Collections of features and plans, managed together.',
    emptyTitle: 'No groups yet',
    emptyDescription:
      'Groups bundle features or prices so they report and invoice together.',
    cta: 'Create group',
    legacy: '/product-catalog/groups',
  },
  {
    path: '/pricing-widget',
    title: 'Pricing Widget',
    description: 'The embeddable pricing table your customers see.',
    emptyTitle: 'No pricing widget yet',
    emptyDescription:
      'The pricing widget is the embeddable table your customers choose a plan from.',
    cta: 'Configure widget',
    legacy: '/product-catalog/pricing-widget',
  },

  // Billing
  {
    path: '/customers',
    title: 'Customers',
    description: 'Who you bill, what they are on, and what they owe.',
    emptyTitle: 'No customers yet',
    emptyDescription:
      'Customers are who you bill. Each one carries subscriptions, invoices and a payment history.',
    cta: 'Create customer',
    legacy: '/customer-management/customers',
  },
  {
    path: '/subscriptions',
    title: 'Subscriptions',
    description: 'Every active, paused and cancelled subscription.',
    emptyTitle: 'No subscriptions yet',
    emptyDescription:
      'A subscription puts a customer on a plan and starts their billing cycle.',
    cta: 'Create subscription',
    legacy: '/customer-management/subscriptions',
  },
  {
    path: '/payments',
    title: 'Payments',
    description: 'Money received, and anything that failed to collect.',
    emptyTitle: 'No payments yet',
    emptyDescription:
      'Payments appear here as they are collected against invoices, successful or failed.',
    cta: null,
    legacy: '/billing/payments',
  },
  {
    path: '/credit-notes',
    title: 'Credit Notes',
    description: 'Refunds and adjustments issued against invoices.',
    emptyTitle: 'No credit notes yet',
    emptyDescription:
      'Credit notes refund or adjust an invoice after it has been issued.',
    cta: 'Create credit note',
    legacy: '/billing/credit-notes',
  },
  {
    path: '/taxes',
    title: 'Taxes',
    description: 'Tax rates, and where each one applies.',
    emptyTitle: 'No tax rates yet',
    emptyDescription:
      'Tax rates decide what is added to an invoice, and where each rate applies.',
    cta: 'Create tax rate',
    legacy: '/billing/taxes',
  },
  {
    path: '/revenue',
    title: 'Revenue',
    description: 'Recognised revenue, billed and unbilled.',
    emptyTitle: 'No revenue to report yet',
    emptyDescription:
      'Recognised and deferred revenue appear here once invoices have been issued.',
    cta: null,
    legacy: '/revenue',
  },

  // Developers
  {
    path: '/events',
    title: 'Events Debugger',
    description: 'The raw usage events as they arrived, so you can see why a bill is what it is.',
    emptyTitle: 'No events received yet',
    emptyDescription:
      'Usage events sent by your systems appear here as they arrive, so a bill can be traced to what caused it.',
    cta: null,
    legacy: '/usage-tracking/events',
  },
  {
    path: '/api-keys',
    title: 'API Keys',
    description: 'Keys your systems use to send usage and read billing data.',
    emptyTitle: 'No API keys yet',
    emptyDescription:
      'API keys let your systems send usage and read billing data.',
    cta: 'Create API key',
    legacy: '/developers/api-keys',
  },
  {
    path: '/service-accounts',
    title: 'Service Accounts',
    description: 'Non-human identities, and what each one may do.',
    emptyTitle: 'No service accounts yet',
    emptyDescription:
      'Service accounts are non-human identities, each with its own permissions.',
    cta: 'Create service account',
    legacy: '/developers/service-accounts',
  },
  {
    path: '/webhooks',
    title: 'Webhooks',
    description: 'Where Flexprice tells your systems that something happened.',
    emptyTitle: 'No webhooks yet',
    emptyDescription:
      'Webhooks tell your systems when something happens in Flexprice — an invoice finalised, a payment failed.',
    cta: 'Create webhook',
    legacy: '/developers/webhooks',
  },
  {
    path: '/exports',
    title: 'Exports',
    description: 'Scheduled extracts of billing data to your own storage.',
    emptyTitle: 'No exports yet',
    emptyDescription:
      'Exports send billing data to your own storage on a schedule.',
    cta: 'Create export',
    legacy: '/tools/exports',
  },
  {
    path: '/usage-syncs',
    title: 'Usage Syncs',
    description: 'Usage pulled in from somewhere else, and whether it is current.',
    emptyTitle: 'No usage syncs yet',
    emptyDescription:
      'Usage syncs pull usage in from another system and keep it current.',
    cta: 'Create usage sync',
    legacy: '/tools/usage-syncs',
  },
  {
    path: '/workflows',
    title: 'Workflows',
    description: 'Automations that run on billing events, and their recent runs.',
    emptyTitle: 'No workflows yet',
    emptyDescription:
      'Workflows run automatically on billing events, and their runs are listed here.',
    cta: 'Create workflow',
    legacy: '/developers/workflows',
  },

  // Elsewhere
  {
    path: '/integrations',
    title: 'Integrations',
    description: 'Connections to your payment processor, ledger and data warehouse.',
    emptyTitle: 'No integrations connected',
    emptyDescription:
      'Integrations connect Flexprice to your payment processor, ledger and data warehouse.',
    cta: 'Connect an integration',
    legacy: '/tools/integrations',
  },
  {
    path: '/settings',
    title: 'Settings',
    description: 'Your organisation, its members, and how billing behaves by default.',
    emptyTitle: 'Nothing configured yet',
    emptyDescription:
      'Your organisation, its members, and how billing behaves by default.',
    cta: null,
    legacy: '/settings',
  },
  {
    path: '/docs',
    title: 'Documentation',
    description: 'How Flexprice works, and the API reference.',
    emptyTitle: 'Documentation',
    emptyDescription:
      'How Flexprice works, and the full API reference.',
    cta: 'Open documentation',
  },
] as const satisfies readonly PlaceholderRoute[]
