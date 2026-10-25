import { useQueries } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * The counts a catalogue list shows above itself: total, and the split by
 * status.
 *
 * Each is one `limit: 1` request read for its `pagination.total`, the same trick
 * the sidebar counts use: every list endpoint reports the total regardless of
 * how many rows come back, so a count costs one row, not a page. The status
 * split is the server's, sent as the filter's `status` field: not derived from
 * the page on screen, which only ever holds twenty-five rows.
 *
 * Typed loosely per entity because each SDK resource has its own filter shape
 * and this only ever reads `pagination.total`.
 */
export type CatalogEntity = 'plans' | 'features' | 'addons' | 'coupons' | 'priceUnits'

const COUNTERS: Record<CatalogEntity, (client: Flexprice, status?: string) => Promise<unknown>> = {
  plans: (client, status) =>
    client.plans.queryPlan({ limit: 1, ...(status ? { status } : {}) } as never),
  features: (client, status) =>
    client.features.queryFeature({ limit: 1, ...(status ? { status } : {}) } as never),
  addons: (client, status) =>
    client.addons.queryAddon({ limit: 1, ...(status ? { status } : {}) } as never),
  coupons: (client, status) =>
    client.coupons.queryCoupon({ limit: 1, ...(status ? { status } : {}) } as never),
  priceUnits: (client, status) =>
    client.priceUnits.queryPriceUnit({ limit: 1, ...(status ? { status } : {}) } as never),
}

async function fetchCount(
  client: Flexprice,
  entity: CatalogEntity,
  status?: string,
): Promise<number> {
  const response = (await call(() => COUNTERS[entity](client, status))) as {
    pagination?: { total?: number }
  }
  return response.pagination?.total ?? 0
}

export interface CatalogStats {
  /** Undefined until known: distinct from a real zero, so the strip shows a
   *  dash rather than a confident "0" it has not confirmed. */
  total: number | undefined
  published: number | undefined
  archived: number | undefined
  isPending: boolean
}

export function useCatalogStats(entity: CatalogEntity): CatalogStats {
  const client = useFlexprice()

  const results = useQueries({
    queries: [
      { status: undefined, key: 'total' },
      { status: 'published', key: 'published' },
      { status: 'archived', key: 'archived' },
    ].map(({ status, key }) => ({
      queryKey: [...queryKeys.counts.of(entity), key] as const,
      queryFn: () => fetchCount(client, entity, status),
      staleTime: 60_000,
      // A summary count is not worth a retry storm; the list itself surfaces a
      // real outage the moment someone looks at it.
      retry: false,
    })),
  })

  return {
    total: results[0]?.data,
    published: results[1]?.data,
    archived: results[2]?.data,
    isPending: results.some((r) => r.isPending),
  }
}
