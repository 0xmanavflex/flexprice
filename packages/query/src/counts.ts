import { useQueries, useQuery } from '@tanstack/react-query'
import { type CallOptions, type Flexprice, call } from '@fp/api'
import { type InvoiceStatus } from '@fp/domain'
import { isServerFilterable, toInvoiceFilter } from './invoices'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { ALL_SUBSCRIPTION_STATUSES } from './subscriptionStatuses'

/**
 * How many of each thing exist, for the navigation.
 *
 * The counts answer "is there anything here?" before a click, which is how an
 * empty catalogue becomes obvious rather than a surprise after navigating.
 *
 * Three things keep this from being expensive:
 *
 *   - `limit: 1`. Every list endpoint returns `pagination.total` regardless of
 *     how many rows come back, so a count costs one row, not a page.
 *   - only the **active section** is counted. Nobody needs to know the invoice
 *     count while looking at the catalogue, and counting all six sections on
 *     every navigation would be a dozen requests to render a sidebar.
 *   - a long `staleTime`. A count that is a minute out of date is still a true
 *     answer to "is there anything here", and refetching it on every route
 *     change would cost more than it tells anyone.
 */
/**
 * How to count each entity, and — by being the only list — what can be counted.
 *
 * One map rather than a list of ids beside a switch: the two drift, and the
 * half that is only a type quietly stops matching the half that runs.
 *
 * Typed loosely because each SDK resource has its own filter shape and this
 * only ever reads `pagination.total`.
 */
export type CountableId = 'features' | 'plans' | 'customers' | 'subscriptions' | 'invoices'

/**
 * Every counter is declared as returning `Promise<unknown>` on purpose.
 *
 * Left to infer, the map's five entries keep five *different* response types,
 * so `COUNTERS[id]` — where `id` is the union — is a union of function
 * signatures, and TypeScript will not call one of those: it has no single
 * signature to check the call against, and picks the first, which then fails
 * against the rest ("`ListInvoicesResponse` is not assignable to
 * `ListSubscriptionsResponse`"). Widening the return here is honest rather
 * than lossy, because `fetchCount` reads exactly one field off it and that
 * field is on all five.
 */
const COUNTERS: Record<CountableId, (client: Flexprice, options: CallOptions) => Promise<unknown>> =
  {
    features: (client, options) => client.features.queryFeature({ limit: 1 }, options),
    plans: (client, options) => client.plans.queryPlan({ limit: 1 }, options),
    customers: (client, options) => client.customers.queryCustomer({ limit: 1 }, options),
    subscriptions: (client, options) =>
      client.subscriptions.querySubscription(
        { limit: 1, subscriptionStatus: ALL_SUBSCRIPTION_STATUSES },
        options,
      ),
    invoices: (client, options) => client.invoices.queryInvoice({ limit: 1 }, options),
  }

async function fetchCount(
  client: Flexprice,
  id: CountableId,
  signal?: AbortSignal,
): Promise<number> {
  const response = (await call((options) => COUNTERS[id](client, options), signal)) as {
    pagination?: { total?: number }
  }
  return response.pagination?.total ?? 0
}

const COUNT_STALE_MS = 5 * 60_000

/**
 * One count, under the same cache entry {@link useNavCounts} fills.
 *
 * This is the cheap way to ask "how many?": a `limit: 1` request whose answer
 * is `pagination.total`. A screen that needs only a total (a stat tile, a
 * "12 customers" caption) must use this instead of fetching a page of rows and
 * reading its `total` — that is a hundred rows moved to display one number.
 *
 * The key is shared, so the sidebar's count and a page's count are one request
 * and one answer. Absent (`undefined`) while unknown or failed, never zero.
 */
export function useCount(id: CountableId, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.counts.of(id),
    queryFn: ({ signal }) => fetchCount(client, id, signal),
    enabled: options.enabled ?? true,
    staleTime: COUNT_STALE_MS,
    retry: false,
  })
}

/**
 * How many invoices carry the given statuses, exactly, for one row of
 * response.
 *
 * Only statuses the API can filter on are accepted — a derived status
 * (overdue, paid) is computed on the client from a due date and a balance, and
 * asking the server for it would silently return the wrong number. Passing one
 * disables the query rather than answering with a lie; read it off the rows
 * already loaded.
 */
export function useInvoiceCount(
  statuses: readonly InvoiceStatus[],
  options: { enabled?: boolean } = {},
) {
  const client = useFlexprice()
  const serverSide = statuses.length > 0 && statuses.every(isServerFilterable)
  const sorted = [...statuses].sort()

  return useQuery({
    queryKey: [...queryKeys.counts.of('invoices'), 'status', sorted] as const,
    queryFn: async ({ signal }) => {
      const filter = toInvoiceFilter({
        page: 1,
        pageSize: 1,
        sortBy: 'issuedAt',
        sortDirection: 'desc',
        search: '',
        statuses: sorted,
      } as never)
      const response = (await call(
        (callOptions) => client.invoices.queryInvoice(filter as never, callOptions),
        signal,
      )) as { pagination?: { total?: number } }
      return response.pagination?.total ?? 0
    },
    enabled: (options.enabled ?? true) && serverSide,
    staleTime: COUNT_STALE_MS,
    retry: false,
  })
}

/**
 * Counts for the ids given. Pass only what the active section needs.
 *
 * A failed count is reported as absent rather than zero — "we could not find
 * out" and "there are none" are different, and rendering a confident `0` for
 * the first is a lie the sidebar has no business telling.
 */
export function useNavCounts(ids: readonly CountableId[]): Partial<Record<string, number>> {
  const client = useFlexprice()

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.counts.of(id),
      queryFn: ({ signal }) => fetchCount(client, id, signal),
      staleTime: COUNT_STALE_MS,
      // A sidebar count is not worth a retry storm; the list itself will
      // surface a real outage the moment someone navigates.
      retry: false,
    })),
  })

  const counts: Partial<Record<string, number>> = {}
  results.forEach((result, index) => {
    const id = ids[index]
    if (id !== undefined && result.data !== undefined) counts[id] = result.data
  })
  return counts
}
