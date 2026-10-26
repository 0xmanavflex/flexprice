import { request } from './settings'

/**
 * Revenue recognition: revenue contracts, performance obligations (POBs) and
 * the revenue waterfall. Live on the API but not yet in the SDK, so this speaks
 * `fetch` the way `revenue.ts` does. Every amount is a decimal string.
 */
export interface RevenueContractWire {
  id?: string
  customer_id?: string
  currency?: string
  term_start?: string
  term_end?: string | null
  contract_status?: string
}

export interface PerformanceObligationWire {
  id?: string
  contract_id?: string
  name?: string
  recognition_method?: string
  amortization_method?: string
  service_start?: string
  service_end?: string | null
  pob_status?: string
}

export interface WaterfallCellWire {
  period?: string
  revenue?: { total?: string; actual?: string; pending?: string; scheduled?: string }
  deferred?: string | null
  unbilled?: string | null
}

export interface RevenueWaterfallWire {
  totals?: WaterfallCellWire[] | null
  items?: Array<{
    customer_id?: string | null
    contract_id?: string | null
    pob_id?: string | null
    cells?: WaterfallCellWire[] | null
  }> | null
  pagination?: { total?: number } | null
}

export interface RevenueWaterfallRequest {
  period_start: string
  period_end: string
  currency: string
  group_by: 'customer_id' | 'contract_id' | 'pob_id'
  contract_ids?: string[]
  customer_ids?: string[]
  details?: boolean
  limit?: number
  offset?: number
}

interface Auth {
  serverURL: string
  token: string
  environmentId: string
}

const post = async (auth: Auth, path: string, body: unknown) =>
  request(auth.serverURL, path, { method: 'POST', ...auth, body })

/** `POST /contracts/search` by subscription: the revenue contract behind it, if any. */
export async function searchRevenueContracts(
  auth: Auth,
  subscriptionIds: string[],
): Promise<RevenueContractWire[]> {
  const body = (await post(auth, '/contracts/search', {
    subscription_ids: subscriptionIds,
    limit: subscriptionIds.length,
  })) as { items?: RevenueContractWire[] | null } | null
  return body?.items ?? []
}

/** `POST /performance_obligations/search`: a contract's POBs. */
export async function fetchPerformanceObligations(
  auth: Auth,
  contractId: string,
): Promise<PerformanceObligationWire[]> {
  const body = (await post(auth, '/performance_obligations/search', {
    contract_ids: [contractId],
    limit: 100,
  })) as { items?: PerformanceObligationWire[] | null } | null
  return body?.items ?? []
}

/** `POST /revenue_reports/waterfall`: revenue per group × month, with month-end balances when `details`. */
export async function fetchRevenueWaterfall(
  auth: Auth,
  body: RevenueWaterfallRequest,
): Promise<RevenueWaterfallWire> {
  return ((await post(auth, '/revenue_reports/waterfall', body)) ?? {}) as RevenueWaterfallWire
}

export interface JournalEntryWire {
  id?: string
  event_type?: string
  source_entity_type?: string
  source_entity_id?: string
  business_date?: string
  customer_id?: string
  contract_id?: string
  currency?: string
  reversal_of?: string | null
  lines?: Array<{
    id?: string
    account?: string
    direction?: string
    amount?: string
    pob_id?: string | null
  }> | null
}

/** `POST /journal_entries/search`: one page of a contract's entries, oldest first. */
export async function searchJournalEntries(
  auth: Auth,
  contractId: string,
  page: { limit: number; offset: number },
): Promise<{ items: JournalEntryWire[]; total: number }> {
  const body = (await post(auth, '/journal_entries/search', {
    contract_ids: [contractId],
    sort: [{ field: 'business_date', direction: 'asc' }],
    ...page,
  })) as { items?: JournalEntryWire[] | null; pagination?: { total?: number } } | null
  return { items: body?.items ?? [], total: body?.pagination?.total ?? 0 }
}
