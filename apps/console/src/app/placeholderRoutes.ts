/**
 * The destinations that exist in the navigation but not yet in V2.
 *
 * This table is the migration's to-do list, and it is deliberately in one
 * place: a row disappears when its real page lands, so the size of this file
 * is the size of what is left. Descriptions are written for the person using
 * the screen, not the person building it.
 *
 * `legacy` is the path in the current dashboard. The origin is configuration:
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
   * records arrive rather than being made: payments, events, revenue: must
   * not offer to create one.
   */
  emptyTitle: string
  emptyDescription: string
  /** The primary action's label, or `null` where creating one is not the move. */
  cta: string | null
  legacy?: string
}

export const PLACEHOLDER_ROUTES: readonly PlaceholderRoute[] = [
  // `/` (Home) is a real page now: see `homeRoute` in router.tsx.
  // Product catalogue
  // `/plans` is a real page now: see `plansRoute` in router.tsx.
  // `/coupons` is a real page now: see `couponsRoute` in router.tsx.
  // `/addons` is a real page now: see `addonsRoute` in router.tsx.
  // `/price-units` is a real page now: see `priceUnitsRoute` in router.tsx.
  // `/cost-sheets` is a real page now: see `costSheetsRoute` in router.tsx.
  // `/groups` is a real page now: see `groupsRoute` in router.tsx.
  // `/pricing-widget` is a real page: see `pricingWidgetRoute` in router.tsx.
  // Billing
  // `/customers` is a real page now: see `customersRoute` in router.tsx.
  // `/contracts` is a real page now: see `subscriptionsRoute` in router.tsx.
  // `/payments` is a real page now: see `paymentsRoute` in router.tsx.
  // `/invoices` is a real page (invoicesRoute); `/taxes` too (taxesRoute).
  // `/credit-memos` is a real page: see `creditNotesRoute` in router.tsx.
  // `/revenue` is a real page now: see `revenueRoute` in router.tsx.
  // Developers
  // `/api-keys`, `/service-accounts` are real: each lands on its Developers
  // panel (see `developerRedirects` in router.tsx).
  // `/webhooks` is a real page: see `webhooksRoute` in router.tsx.
  // `/events` is a real page: see `eventsRoute` in router.tsx.
  // `/exports` is a real page: see `exportsRoute` in router.tsx.
  // `/usage-syncs` is a real page: see `usageSyncsRoute` in router.tsx.
  // `/workflows` is a real page: see `workflowsRoute` in router.tsx.
  // Elsewhere
  // `/integrations` is a real page: see `integrationsRoute` in router.tsx.
  // `/settings` is a real page now: see `settingsRoute` in router.tsx.
  // `/labels` redirects to Settings → Labels: see `labelsRedirect` in router.tsx.
  // Documentation is not a route: its sidebar row links out to docs.flexprice.io.
]
