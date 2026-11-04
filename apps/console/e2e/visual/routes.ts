/**
 * The visual contracts: every route the screenshot suite captures.
 *
 * Each row says which route to open, which file in the reference design it is
 * meant to match, and what has to be on screen before the capture is taken.
 * `reference` names the file under the reference app's `src/app/pages/` (see
 * its `COMPONENT_MAP.md`) that defines the screen. Today it is documentation;
 * the follow-up step in `README.md` uses it to pair a baseline with a capture
 * of the reference app.
 *
 * Ids are real fixture ids (`packages/query/src/__fixtures__`), taken from the
 * first rows the mocked lists render. Prefer `*_synth_*` ids over the
 * `*_recent_*` rows: those are generated relative to "now", and although the
 * suite freezes the clock, a synth id does not depend on it.
 *
 * Deliberately NOT covered, because the capture would not be stable or would
 * not show the screen:
 *  - Anything behind a real network call (live-auth, live-flows): the suite is
 *    mock-only, like the journeys.
 *  - Dark mode: the contract is the light theme; a theme pass is its own
 *    follow-up, not a second copy of every baseline.
 */

export type Pattern = 'list' | 'detail' | 'create' | 'edit' | 'settings' | 'dashboard'

/**
 * What must be visible before the page is captured.
 *
 *  - `heading` — an `<h1>`/`<h2>`/`<h3>` by accessible name (substring).
 *  - `text` — any element containing this text.
 *  - `rows` — also wait for the first data row of a grid: a list's heading
 *    renders before its rows do, and a screenshot of a skeleton is not a
 *    screenshot of the page.
 */
export interface Ready {
  heading?: string
  text?: string
  rows?: boolean
}

export interface VisualContract {
  /** Baseline file name (`__screenshots__/<name>.png`). Unique, kebab-case. */
  name: string
  /** Path and query, relative to `baseURL`. */
  route: string
  /** The reference app's page file that defines this screen. */
  reference: string
  pattern: Pattern
  ready: Ready
  /** Open the route without the demo session (the sign-in screen). */
  unauthenticated?: boolean
}

const PLAN = 'plan_synth_0000'
const FEATURE = 'feat_synth_0000'
const ADDON = 'addon_synth_0000'
const CUSTOMER = 'cus_synth_0000'
const SUBSCRIPTION = 'subs_synth_0000'
const INVOICE = 'inv_synth_0000'
const COUPON = 'coupon_01M38QAAA0000000000000002'
const COST_SHEET = 'cost_seed_1'
const PRICE_UNIT = 'pu_01M38QBBB0000000000000003'
const CREDIT_NOTE = 'cnote_01M38Q0000000000'

export const VISUAL_CONTRACTS: readonly VisualContract[] = [
  // Dashboard
  {
    name: 'home',
    route: '/',
    reference: 'pages/home.tsx',
    pattern: 'dashboard',
    ready: { heading: 'Overview' },
  },
  {
    name: 'revenue',
    route: '/reports',
    reference: 'pages/revenue.tsx',
    pattern: 'dashboard',
    ready: { text: 'Receivables aging' },
  },

  // Product catalogue
  {
    name: 'features-list',
    route: '/features',
    reference: 'pages/catalog.tsx',
    pattern: 'list',
    ready: { heading: 'Features', rows: true },
  },
  {
    name: 'feature-detail',
    route: `/features/${FEATURE}`,
    reference: 'pages/feature-detail.tsx',
    pattern: 'detail',
    // "Plans attached" was a four-row preview of the charges; the Overview
    // tab shows the Charges table in full now, so that is what to wait for.
    ready: { heading: 'Charges' },
  },
  {
    name: 'feature-new',
    route: '/features/new',
    reference: 'pages/catalog.tsx',
    pattern: 'create',
    ready: { heading: 'Feature' },
  },
  {
    name: 'plans-list',
    route: '/plans',
    reference: 'pages/catalog.tsx',
    pattern: 'list',
    ready: { heading: 'Plans', rows: true },
  },
  {
    name: 'plan-detail',
    route: `/plans/${PLAN}`,
    reference: 'pages/plan-detail.tsx',
    pattern: 'detail',
    ready: { heading: 'Charges' },
  },
  {
    name: 'plan-detail-entitlements',
    route: `/plans/${PLAN}?tab=entitlements`,
    reference: 'pages/plan-detail.tsx',
    pattern: 'detail',
    ready: { text: 'Entitlements' },
  },
  {
    name: 'plan-detail-information',
    route: `/plans/${PLAN}?tab=information`,
    reference: 'pages/plan-detail.tsx',
    pattern: 'detail',
    ready: { text: 'Information' },
  },
  {
    name: 'plan-new',
    route: '/plans/new',
    reference: 'pages/catalog.tsx',
    pattern: 'create',
    ready: { heading: 'Plan details' },
  },
  {
    name: 'plan-new-charges',
    route: '/plans/new?step=charges',
    reference: 'pages/plan-detail.tsx',
    pattern: 'create',
    ready: { text: 'Add charge' },
  },
  {
    name: 'plan-edit',
    route: `/plans/${PLAN}/edit`,
    reference: 'pages/catalog.tsx',
    pattern: 'edit',
    ready: { heading: 'Edit ' },
  },
  {
    name: 'addons-list',
    route: '/addons',
    reference: 'pages/catalog.tsx',
    pattern: 'list',
    ready: { heading: 'Add-ons', rows: true },
  },
  {
    name: 'addon-detail',
    route: `/addons/${ADDON}`,
    reference: 'pages/catalog-details.tsx',
    pattern: 'detail',
    ready: { heading: 'Charges' },
  },
  {
    name: 'addon-new',
    route: '/addons/new',
    reference: 'pages/catalog.tsx',
    pattern: 'create',
    ready: { heading: 'Add-on details' },
  },
  {
    name: 'coupons-list',
    route: '/coupons',
    reference: 'pages/catalog.tsx',
    pattern: 'list',
    ready: { heading: 'Coupons', rows: true },
  },
  {
    name: 'coupon-detail',
    route: `/coupons/${COUPON}`,
    reference: 'pages/catalog-details.tsx',
    pattern: 'detail',
    ready: { heading: 'Redemptions' },
  },
  {
    name: 'cost-sheets-list',
    route: '/cost-sheets',
    reference: 'pages/catalog.tsx',
    pattern: 'list',
    ready: { heading: 'Cost sheets', rows: true },
  },
  {
    name: 'cost-sheet-detail',
    route: `/cost-sheets/${COST_SHEET}`,
    reference: 'pages/catalog-details.tsx',
    pattern: 'detail',
    ready: { heading: 'Margin' },
  },
  {
    name: 'price-units-list',
    route: '/price-units',
    reference: 'pages/catalog.tsx',
    pattern: 'list',
    ready: { heading: 'Price units', rows: true },
  },
  {
    name: 'price-unit-detail',
    route: `/price-units/${PRICE_UNIT}`,
    reference: 'pages/catalog-details.tsx',
    pattern: 'detail',
    ready: { heading: 'Conversion' },
  },
  {
    name: 'groups-list',
    route: '/groups',
    reference: 'pages/catalog.tsx',
    pattern: 'list',
    ready: { heading: 'Tags', rows: true },
  },
  {
    name: 'group-new',
    route: '/groups/new',
    reference: 'pages/catalog.tsx',
    pattern: 'create',
    ready: { text: 'Create tag' },
  },

  // Billing
  {
    name: 'customers-list',
    route: '/customers',
    reference: 'pages/billing.tsx',
    pattern: 'list',
    ready: { heading: 'Customers', rows: true },
  },
  {
    name: 'customer-detail',
    route: `/customers/${CUSTOMER}`,
    reference: 'pages/customer-detail.tsx',
    pattern: 'detail',
    ready: { heading: 'Activity' },
  },
  {
    name: 'customer-detail-wallet',
    route: `/customers/${CUSTOMER}?tab=wallet`,
    reference: 'pages/customer-wallet.tsx',
    pattern: 'detail',
    ready: { text: 'Wallet' },
  },
  {
    name: 'customer-detail-usage',
    route: `/customers/${CUSTOMER}?tab=usage`,
    reference: 'pages/customer-analytics.tsx',
    pattern: 'detail',
    ready: { text: 'Analytics' },
  },
  {
    name: 'customer-new',
    route: '/customers/new',
    reference: 'pages/billing.tsx',
    pattern: 'create',
    ready: { heading: 'Customer details' },
  },
  {
    name: 'subscriptions-list',
    route: '/contracts',
    reference: 'pages/billing.tsx',
    pattern: 'list',
    ready: { heading: 'Contracts', rows: true },
  },
  {
    name: 'subscription-detail',
    route: `/contracts/${SUBSCRIPTION}`,
    reference: 'pages/billing.tsx',
    pattern: 'detail',
    ready: { heading: 'Related' },
  },
  {
    name: 'subscription-new',
    route: '/contracts/new',
    reference: 'pages/billing.tsx',
    pattern: 'create',
    ready: { heading: 'Customer' },
  },
  {
    name: 'invoices-list',
    route: '/invoices',
    reference: 'pages/billing.tsx',
    pattern: 'list',
    ready: { heading: 'Invoices', rows: true },
  },
  {
    name: 'invoice-detail',
    route: `/invoices/${INVOICE}`,
    reference: 'pages/invoice-detail.tsx',
    pattern: 'detail',
    ready: { heading: 'Activity' },
  },
  {
    name: 'invoice-new',
    route: '/invoices/new',
    reference: 'pages/billing.tsx',
    pattern: 'create',
    ready: { heading: 'Line Items' },
  },
  {
    name: 'payments-list',
    route: '/payments',
    reference: 'pages/billing.tsx',
    pattern: 'list',
    ready: { heading: 'Payments', rows: true },
  },
  {
    name: 'credit-notes-list',
    route: '/credit-memos',
    reference: 'pages/billing.tsx',
    pattern: 'list',
    ready: { heading: 'Credit memos', rows: true },
  },
  {
    name: 'credit-note-detail',
    route: `/credit-memos/${CREDIT_NOTE}`,
    reference: 'pages/credit-memo-detail.tsx',
    pattern: 'detail',
    ready: { text: 'Total credited' },
  },
  {
    name: 'taxes-list',
    route: '/taxes',
    reference: 'pages/billing.tsx',
    pattern: 'list',
    ready: { heading: 'Tax rates', rows: true },
  },

  // Developers
  {
    name: 'events',
    route: '/events',
    reference: 'pages/developers.tsx',
    pattern: 'list',
    ready: { heading: 'Events' },
  },
  {
    name: 'api-keys',
    route: '/api-keys',
    reference: 'pages/developers.tsx',
    pattern: 'list',
    ready: { text: 'Create API key' },
  },
  {
    name: 'service-accounts',
    route: '/service-accounts',
    reference: 'pages/developers.tsx',
    pattern: 'list',
    // The page's own action and rows, not the nav label: "Service accounts" is
    // also on an access-error page, which a baseline once captured.
    ready: { text: 'New service account', rows: true },
  },
  {
    name: 'webhooks',
    route: '/webhooks',
    reference: 'pages/developers.tsx',
    pattern: 'list',
    // As above: the endpoint list itself, not the nav label.
    ready: { text: 'Add endpoint', rows: true },
  },
  {
    name: 'exports',
    route: '/exports',
    reference: 'pages/developers.tsx',
    pattern: 'list',
    ready: { heading: 'Exports' },
  },
  {
    name: 'usage-syncs',
    route: '/usage-syncs',
    reference: 'pages/developers.tsx',
    pattern: 'list',
    ready: { heading: 'Usage Syncs' },
  },
  {
    name: 'workflows',
    route: '/workflows',
    reference: 'pages/developers.tsx',
    pattern: 'list',
    ready: { heading: 'Workflows' },
  },

  // Elsewhere
  {
    name: 'integrations',
    route: '/integrations',
    reference: 'pages/integrations.tsx',
    pattern: 'list',
    ready: { heading: 'Available', text: 'Stripe' },
  },
  {
    name: 'pricing-widget',
    route: '/pricing-widget',
    reference: 'pages/pricing-widget.tsx',
    pattern: 'dashboard',
    ready: { heading: 'Free' },
  },
  {
    name: 'settings-organization',
    route: '/settings?section=organization&tab=profile',
    reference: 'pages/settings.tsx',
    pattern: 'settings',
    ready: { text: 'Billing email' },
  },
  {
    name: 'settings-team',
    route: '/settings?section=team&tab=members',
    reference: 'pages/settings.tsx',
    pattern: 'settings',
    ready: { text: 'Invite member' },
  },
  {
    name: 'sign-in',
    route: '/sign-in',
    reference: 'pages/auth.tsx',
    pattern: 'create',
    ready: { heading: 'Sign in to Flexprice' },
    unauthenticated: true,
  },
]
