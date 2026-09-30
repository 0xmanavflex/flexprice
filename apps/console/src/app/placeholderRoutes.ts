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
  // `/` (Home) is a real page now — see `homeRoute` in router.tsx.

  // Product catalogue
  // `/plans` is a real page now — see `plansRoute` in router.tsx.
  // `/coupons` is a real page now — see `couponsRoute` in router.tsx.
  // `/addons` is a real page now — see `addonsRoute` in router.tsx.
  // `/price-units` is a real page now — see `priceUnitsRoute` in router.tsx.
  // `/cost-sheets` is a real page now — see `costSheetsRoute` in router.tsx.
  // `/groups` is a real page now — see `groupsRoute` in router.tsx.
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
  // `/customers` is a real page now — see `customersRoute` in router.tsx.
  // `/subscriptions` is a real page now — see `subscriptionsRoute` in router.tsx.
  // `/payments` is a real page now — see `paymentsRoute` in router.tsx.
  // `/invoices` is a real page (invoicesRoute); `/taxes` too (taxesRoute).
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
  // `/revenue` is a real page now — see `revenueRoute` in router.tsx.

  // Developers
  // `/api-keys`, `/service-accounts`, `/webhooks` are real: each lands on its
  // Settings → Developers panel (see `developerRedirects` in router.tsx).
  // `/events` is a real page — see `eventsRoute` in router.tsx.
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
  // `/settings` is a real page now — see `settingsRoute` in router.tsx.
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
