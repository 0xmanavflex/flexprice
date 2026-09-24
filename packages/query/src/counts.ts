import { useQueries } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

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
const COUNTERS = {
  features: (client: Flexprice) => client.features.queryFeature({ limit: 1 } as never),
  plans: (client: Flexprice) => client.plans.queryPlan({ limit: 1 } as never),
  customers: (client: Flexprice) => client.customers.queryCustomer({ limit: 1 } as never),
  subscriptions: (client: Flexprice) =>
    client.subscriptions.querySubscription({ limit: 1 } as never),
  invoices: (client: Flexprice) => client.invoices.queryInvoice({ limit: 1 } as never),
} as const

export type CountableId = keyof typeof COUNTERS

async function fetchCount(client: Flexprice, id: CountableId): Promise<number> {
  const response = (await call(() => COUNTERS[id](client))) as {
    pagination?: { total?: number }
  }
  return response.pagination?.total ?? 0
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
      queryFn: () => fetchCount(client, id),
      staleTime: 5 * 60_000,
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
