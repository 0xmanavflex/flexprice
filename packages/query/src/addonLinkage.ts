import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { call } from '@fp/api'
import { EntitlementEntityType } from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * How many entitlements each add-on grants.
 *
 * One `POST /entitlements/search` over the add-ons on screen, the same shape
 * `usePlanLinkage` uses for plans.
 *
 * **Contracts are not here.** The redesign asks for a Contracts count beside
 * Charges and Entitlements, and the API cannot answer it: `addon_id` and
 * `addon_ids` are both accepted by `POST /subscriptions/search` and both
 * ignored: every add-on comes back with the environment's whole
 * subscription count. Checked against the live API, and there is no
 * `/addons/:id/subscriptions` either. Counting client-side would mean
 * fetching every subscription and reading its add-ons, which is unbounded.
 * So the column is left out rather than rendered wrong or blank; it needs a
 * backend filter first.
 */
export interface AddonLinkage {
  /** Undefined when the read failed, which is not zero. */
  entitlements: number | undefined
}

interface EntitlementRow {
  entityId?: string
  entityType?: string
}

const BULK_LIMIT = 1000

export function useAddonLinkage(addonIds: readonly string[]): {
  byAddon: ReadonlyMap<string, AddonLinkage>
  isPending: boolean
} {
  const client = useFlexprice()
  // Sorted, so paging back to a set already read hits the same cache entry.
  const ids = useMemo(() => [...new Set(addonIds)].sort(), [addonIds])

  const entitlements = useQuery({
    queryKey: queryKeys.entitlements.list({ entityType: 'ADDON', entityIds: ids }),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.entitlements.queryEntitlement(
            {
              entityType: EntitlementEntityType.Addon,
              entityIds: [...ids],
              limit: BULK_LIMIT,
              offset: 0,
            },
            options,
          ),
        signal,
      )
      return (response.items ?? []) as EntitlementRow[]
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  })

  const byAddon = useMemo(() => {
    // The search honours its filter, but a looser backend must not be able to
    // attribute another add-on's entitlement to a row on screen.
    const wanted = new Set(ids)
    const counts = new Map<string, number>()
    for (const row of entitlements.data ?? []) {
      const addonId = row.entityId
      if (!addonId || !wanted.has(addonId)) continue
      counts.set(addonId, (counts.get(addonId) ?? 0) + 1)
    }
    return new Map(
      ids.map((addonId) => [
        addonId,
        { entitlements: entitlements.isSuccess ? (counts.get(addonId) ?? 0) : undefined },
      ]),
    )
  }, [ids, entitlements.data, entitlements.isSuccess])

  return { byAddon, isPending: ids.length > 0 && entitlements.isPending }
}
