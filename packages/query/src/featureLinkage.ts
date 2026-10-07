import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { call } from '@fp/api'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * How each product is wired into the catalogue: the plans that grant it, how
 * many entitlements that makes, and how many subscriptions sit on those plans.
 *
 * None of it lives on the feature itself, so it is read for the rows on screen
 * and no more:
 *
 *   - one `POST /entitlements/search` filtered to the visible `featureIds` —
 *     each result names its plan (`entityId`) and its feature, which is the
 *     whole plans-and-entitlements picture;
 *   - one `limit: 1` subscription count per distinct plan found, read for its
 *     `pagination.total` (the subscription filter takes a single `planId`, so a
 *     feature's figure is the sum across its plans).
 *
 * A count that could not be read is `undefined`, not zero — "we could not find
 * out" and "there are none" must not render the same.
 */
export interface FeatureLinkage {
  /** Distinct plans that grant the feature. */
  planIds: string[]
  /** Entitlements granting the feature, on plans. */
  entitlements: number
  /** Subscriptions on those plans; undefined until every plan's count is known. */
  subscriptions: number | undefined
}

interface EntitlementRow {
  featureId?: string
  entityType?: string
  entityId?: string
}

export function useFeatureLinkage(featureIds: readonly string[]): {
  byFeature: ReadonlyMap<string, FeatureLinkage>
  isPending: boolean
} {
  const client = useFlexprice()
  const ids = useMemo(() => [...featureIds], [featureIds])

  const entitlements = useQuery({
    queryKey: queryKeys.entitlements.list({ entityType: 'PLAN', featureIds: ids }),
    queryFn: async () => {
      const response = await call(() =>
        client.entitlements.queryEntitlement({
          entityType: 'PLAN',
          featureIds: ids,
          limit: 1000,
          offset: 0,
        } as never),
      )
      return (response.items ?? []) as EntitlementRow[]
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  })

  // The search honours `featureIds`, but a looser backend must not be able to
  // attribute someone else's entitlement to a row on screen.
  const wanted = useMemo(() => new Set(ids), [ids])
  const rows = useMemo(
    () => (entitlements.data ?? []).filter((row) => row.featureId && wanted.has(row.featureId)),
    [entitlements.data, wanted],
  )
  const planIds = useMemo(
    () => [...new Set(rows.map((row) => row.entityId).filter((id): id is string => !!id))],
    [rows],
  )

  const counts = useQueries({
    queries: planIds.map((planId) => ({
      queryKey: [...queryKeys.counts.of('subscriptions'), 'plan', planId] as const,
      queryFn: async () => {
        const response = (await call(() =>
          client.subscriptions.querySubscription({ planId, limit: 1 } as never),
        )) as { pagination?: { total?: number } }
        return response.pagination?.total ?? 0
      },
      staleTime: 5 * 60_000,
      retry: false,
    })),
  })

  const byFeature = useMemo(() => {
    const subscriptionsByPlan = new Map<string, number | undefined>(
      planIds.map((planId, index) => [planId, counts[index]?.data]),
    )
    const out = new Map<string, FeatureLinkage>()
    for (const featureId of ids) {
      const own = rows.filter((row) => row.featureId === featureId)
      const plans = [...new Set(own.map((row) => row.entityId).filter((id): id is string => !!id))]
      const known = plans.map((planId) => subscriptionsByPlan.get(planId))
      out.set(featureId, {
        planIds: plans,
        entitlements: own.length,
        subscriptions: known.every((value) => value !== undefined)
          ? known.reduce<number>((sum, value) => sum + (value ?? 0), 0)
          : undefined,
      })
    }
    return out
  }, [ids, rows, planIds, counts])

  return { byFeature, isPending: entitlements.isPending && ids.length > 0 }
}
