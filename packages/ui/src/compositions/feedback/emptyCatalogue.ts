import type { FigureMotion, FigureName } from './Figures'

/**
 * Every empty state the product can show, as data: figure, copy and motion.
 *
 * Rules the copy follows:
 *   - "First time" states invite; they say what the thing is for and name the
 *     one next step.
 *   - "Filtered" and "search" states never offer to create and never suggest
 *     anything was lost; they say the records are still there.
 *   - "Period" states say the window is empty, not the account.
 *   - Nothing here says "something went wrong"; that is an error, not an empty.
 *
 * Motion: `interactive` for a blank page with room to play, `ambient` for a
 * card, `static` anywhere the toolbar above is the focus (table bodies).
 */
export type EmptyKind =
  | 'customers'
  | 'subscriptions'
  | 'plans'
  | 'features'
  | 'charges'
  | 'entitlements'
  | 'events'
  | 'invoices'
  | 'payments'
  | 'credits'
  | 'usage-period'
  | 'revenue-period'
  | 'integrations'
  | 'environments'
  | 'activity'
  | 'chart'
  | 'search'
  | 'filter'
  | 'permission'
  | 'setup'
  | 'unavailable'

export interface EmptyCopy {
  figure: FigureName
  motion: FigureMotion
  title: string
  description: string
  /** Suggested label for the primary action; the page supplies the handler. */
  primaryLabel?: string
  secondaryLabel?: string
}

export const EMPTY_CATALOGUE: Record<EmptyKind, EmptyCopy> = {
  customers: {
    figure: 'people',
    motion: 'interactive',
    title: 'No customers yet',
    description:
      'Customers are who you bill. Add one by hand, or they appear when your app sends their first event.',
    primaryLabel: 'Add customer',
    secondaryLabel: 'Read the guide',
  },
  subscriptions: {
    figure: 'rail',
    motion: 'interactive',
    title: 'No subscriptions yet',
    description: 'A subscription connects a customer to a plan. Create one to start billing.',
    primaryLabel: 'Create subscription',
  },
  plans: {
    figure: 'stack',
    motion: 'interactive',
    title: 'No plans yet',
    description:
      'Plans bundle your prices and entitlements. Create one, then subscribe a customer to it.',
    primaryLabel: 'Create plan',
  },
  features: {
    figure: 'stack',
    motion: 'interactive',
    title: 'No features yet',
    description:
      'Features are the things customers get or consume, such as seats or API calls. Define one to meter or gate it.',
    primaryLabel: 'Create feature',
  },
  charges: {
    figure: 'ledger',
    motion: 'ambient',
    title: 'No charges on this plan',
    description: 'Add a recurring or usage-based charge to decide what this plan costs.',
    primaryLabel: 'Add charge',
  },
  entitlements: {
    figure: 'padlock',
    motion: 'ambient',
    title: 'No entitlements yet',
    description: 'Entitlements say which features this plan includes and how much of each.',
    primaryLabel: 'Add entitlement',
  },
  events: {
    figure: 'signal',
    motion: 'interactive',
    title: 'No events received yet',
    description:
      'Usage events show up here as soon as your app sends them. Send a test event to check the connection.',
    primaryLabel: 'Send a test event',
    secondaryLabel: 'Read the guide',
  },
  invoices: {
    figure: 'ledger',
    motion: 'interactive',
    title: 'No invoices yet',
    description: 'Invoices are generated from subscriptions at the end of each billing period.',
    primaryLabel: 'Create subscription',
  },
  payments: {
    figure: 'ledger',
    motion: 'ambient',
    title: 'No payments yet',
    description: 'Payments are recorded here when an invoice is paid.',
  },
  credits: {
    figure: 'ledger',
    motion: 'ambient',
    title: 'No credits yet',
    description: 'Credit notes and wallet credits appear here once they are issued.',
  },
  'usage-period': {
    figure: 'plot',
    motion: 'ambient',
    title: 'No usage in this period',
    description:
      'Nothing was recorded between these dates. Your earlier data is unchanged; pick a wider range to see it.',
  },
  'revenue-period': {
    figure: 'plot',
    motion: 'ambient',
    title: 'No revenue in this period',
    description:
      'No invoices fell in this range. Earlier periods are unchanged; pick a wider range to see them.',
  },
  integrations: {
    figure: 'plug',
    motion: 'interactive',
    title: 'Nothing connected yet',
    description: 'Connect a payment provider, CRM or accounting tool to sync billing data.',
    primaryLabel: 'Browse integrations',
  },
  environments: {
    figure: 'drawer',
    motion: 'ambient',
    title: 'No environments',
    description: 'Environments keep test and live data apart. Create one to start.',
    primaryLabel: 'Create environment',
  },
  activity: {
    figure: 'rail',
    motion: 'static',
    title: 'No activity yet',
    description: 'Changes to this record are listed here as they happen.',
  },
  chart: {
    figure: 'plot',
    motion: 'ambient',
    title: 'Nothing to chart',
    description: 'There are no data points in this range.',
  },
  search: {
    figure: 'loupe',
    motion: 'static',
    title: 'No results',
    description: 'Check the spelling or try a shorter term. Your records are all still here.',
  },
  filter: {
    figure: 'sieve',
    motion: 'static',
    title: 'No matches for these filters',
    description:
      'Nothing fits every filter at once. Your records are all still here; clear a filter to see them.',
    primaryLabel: 'Clear filters',
  },
  permission: {
    figure: 'padlock',
    motion: 'ambient',
    title: 'You don’t have access to this',
    description: 'Ask an administrator to give your role access.',
  },
  setup: {
    figure: 'plug',
    motion: 'ambient',
    title: 'Finish setting this up',
    description: 'A step is missing before this page can show anything.',
    primaryLabel: 'Continue setup',
  },
  unavailable: {
    figure: 'drawer',
    motion: 'ambient',
    title: 'Not available here',
    description: 'This feature is not turned on for your workspace.',
  },
}

/** Copy for a search that matched nothing; quotes what was typed. */
export function searchMissCopy(query: string): Pick<EmptyCopy, 'title' | 'description'> {
  const q = query.trim()
  return {
    title: q
      ? `No results for “${q.length > 40 ? `${q.slice(0, 40)}…` : q}”`
      : EMPTY_CATALOGUE.search.title,
    description: EMPTY_CATALOGUE.search.description,
  }
}

/** Copy for filters that matched nothing, naming the records ("invoices"). */
export function filterMissCopy(noun: string): Pick<EmptyCopy, 'title' | 'description'> {
  return {
    title: `No ${noun} match these filters`,
    description: `Your ${noun} are all still here. Clear a filter to see them.`,
  }
}
