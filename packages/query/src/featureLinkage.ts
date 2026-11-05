import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { call } from '@fp/api'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { LIVE_SUBSCRIPTION_STATUSES } from './subscriptionStatuses'

/**
 * How each product is wired into the catalogue: the plans that grant or price
 * it, how many entitlements that makes, and how many subscriptions sit on
 * those plans.
 *
 * None of it lives on the feature itself, so it is read for the rows on screen
 * and no more:
 *
 *   - one `POST /entitlements/search` filtered to the visible `featureIds`:
 *     each result names its plan (`entityId`) and its feature;
 *   - one `POST /prices/search` filtered to the visible metered products'
 *     `meterIds`: a metered product is very often *priced* on a plan without
 *     being *granted* by one, and a Plans column that only read entitlements
 *     showed those products as linked to nothing;
 *   - one `POST /plans/search` for the plan ids found, so the column shows
 *     names rather than ULIDs (a page of plans read elsewhere cannot promise
 *     to contain them);
 *   - one `limit: 1` subscription count per distinct plan found, read for its
 *     `pagination.total` (the subscription filter takes a single `planId`, so a
 *     feature's figure is the sum across its plans). These cannot be batched
 *     into one request, so they run as ONE query that works through the plans
 *     {@link COUNT_CONCURRENCY} at a time, each under its own cache entry. A
 *     page of products linked to thirty plans is thirty requests either way;
 *     what changes is that they no longer all leave the browser at once, one
 *     failing count does not fail the rest, and a plan counted a minute ago is
 *     not counted again.
 *
 * A count that could not be read is `undefined`, not zero: "we could not find
 * out" and "there are none" must not render the same.
 */
export interface FeatureLinkage {
  /** Distinct plans that grant or price the feature. */
  planIds: string[]
  /** The same plans, named where the name could be read. */
  plans: { id: string; name: string }[]
  /** Entitlements granting the feature, on plans. */
  entitlements: number
  /** Subscriptions on those plans; undefined until every plan's count is known. */
  subscriptions: number | undefined
}

/** A product on screen: its id, and the meter it bills against when metered. */
export interface LinkedFeature {
  id: string
  meterId?: string | null | undefined
}

interface EntitlementRow {
  featureId?: string
  entityType?: string
  entityId?: string
}

interface PriceRow {
  meterId?: string
  meter?: { id?: string }
  entityType?: string
  entityId?: string
  plan?: { id?: string; name?: string }
}

interface PlanRow {
  id?: string
  name?: string
}

/** How many per-plan counts are in flight at once. */
export const COUNT_CONCURRENCY = 4

/**
 * Runs `work` over `items`, at most `limit` at a time, results in input order.
 * Stops starting new work once `signal` aborts.
 */
export async function mapBounded<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array<R | undefined>(items.length).fill(undefined)
  let next = 0
  const lane = async () => {
    while (next < items.length && !signal?.aborted) {
      const index = next++
      results[index] = await work(items[index] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return results
}

export function useFeatureLinkage(features: readonly LinkedFeature[]): {
  byFeature: ReadonlyMap<string, FeatureLinkage>
  isPending: boolean
} {
  const client = useFlexprice()
  const queryClient = useQueryClient()
  const ids = useMemo(() => features.map((feature) => feature.id), [features])
  const meterIds = useMemo(
    () => [
      ...new Set(
        features.map((feature) => feature.meterId).filter((id): id is string => Boolean(id)),
      ),
    ],
    [features],
  )

  const entitlements = useQuery({
    queryKey: queryKeys.entitlements.list({ entityType: 'PLAN', featureIds: ids }),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.entitlements.queryEntitlement(
            {
              entityType: 'PLAN',
              featureIds: ids,
              limit: 1000,
              offset: 0,
            } as never,
            options,
          ),
        signal,
      )
      return (response.items ?? []) as EntitlementRow[]
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  })

  const prices = useQuery({
    queryKey: queryKeys.prices.list({ entityType: 'PLAN', meterIds, scope: 'linkage' }),
    queryFn: async () => {
      const response = await call(() =>
        client.prices.queryPrice({
          entityType: 'PLAN',
          meterIds,
          expand: 'plan',
          limit: 1000,
          offset: 0,
        } as never),
      )
      return (response.items ?? []) as PriceRow[]
    },
    enabled: meterIds.length > 0,
    staleTime: 60_000,
  })

  // The searches honour their filters, but a looser backend must not be able
  // to attribute someone else's entitlement or price to a row on screen.
  const wanted = useMemo(() => new Set(ids), [ids])
  const rows = useMemo(
    () =>
      // The PLAN-scoped search also returns subscription and add-on rows; their
      // ids are not plans and must not feed plan names, counts or the total.
      (entitlements.data ?? []).filter(
        (row) =>
          row.featureId &&
          wanted.has(row.featureId) &&
          (row.entityType ?? 'PLAN') === 'PLAN' &&
          Boolean(row.entityId),
      ),
    [entitlements.data, wanted],
  )
  const wantedMeters = useMemo(() => new Set(meterIds), [meterIds])
  const priceRows = useMemo(
    () =>
      (prices.data ?? []).filter((row) => {
        const meter = row.meterId || row.meter?.id
        return (
          meter !== undefined &&
          wantedMeters.has(meter) &&
          (row.entityType ?? 'PLAN') === 'PLAN' &&
          Boolean(row.entityId)
        )
      }),
    [prices.data, wantedMeters],
  )

  const planIds = useMemo(
    () => [
      ...new Set(
        [...rows.map((row) => row.entityId), ...priceRows.map((row) => row.entityId)].filter(
          (id): id is string => !!id,
        ),
      ),
    ],
    [rows, priceRows],
  )

  // Names the price search already carried (`expand: 'plan'`); the rest are read.
  const expandedNames = useMemo(() => {
    const out = new Map<string, string>()
    for (const row of priceRows) {
      if (row.entityId && row.plan?.name) out.set(row.entityId, row.plan.name)
    }
    return out
  }, [priceRows])
  const unnamed = useMemo(
    () => planIds.filter((id) => !expandedNames.has(id)),
    [planIds, expandedNames],
  )

  const plans = useQuery({
    queryKey: queryKeys.plans.list({ planIds: unnamed, scope: 'linkage' }),
    queryFn: async () => {
      const response = await call(() =>
        client.plans.queryPlan({ planIds: unnamed, limit: unnamed.length, offset: 0 } as never),
      )
      return (response.items ?? []) as PlanRow[]
    },
    enabled: unnamed.length > 0,
    staleTime: 5 * 60_000,
  })

  const sortedPlanIds = useMemo(() => [...planIds].sort(), [planIds])
  const counts = useQuery({
    queryKey: [...queryKeys.counts.of('subscriptions'), 'plans', sortedPlanIds] as const,
    queryFn: async ({ signal }) => {
      const totals = await mapBounded(
        sortedPlanIds,
        COUNT_CONCURRENCY,
        async (planId) => {
          try {
            return await queryClient.fetchQuery({
              queryKey: [...queryKeys.counts.of('subscriptions'), 'plan', planId] as const,
              queryFn: async () => {
                const response = (await call(
                  (options) =>
                    client.subscriptions.querySubscription(
                      { planId, subscriptionStatus: LIVE_SUBSCRIPTION_STATUSES, limit: 1 } as never,
                      options,
                    ),
                  signal,
                )) as { pagination?: { total?: number } }
                return response.pagination?.total ?? 0
              },
              staleTime: 5 * 60_000,
            })
          } catch {
            // Unknown, not zero: this plan's figure stays undefined and the
            // feature's total with it, rather than quietly omitting the plan.
            return undefined
          }
        },
        signal,
      )
      return new Map(sortedPlanIds.map((planId, index) => [planId, totals[index]] as const))
    },
    enabled: sortedPlanIds.length > 0,
    staleTime: 60_000,
    retry: false,
    // Counts are looked up by plan id, so a previous plan set's map is safe to
    // keep on screen: a plan it lacks reads as unknown, never as zero.
    placeholderData: (previous) => previous,
  })

  const byFeature = useMemo(() => {
    const names = new Map(expandedNames)
    for (const plan of plans.data ?? []) {
      if (plan.id && plan.name) names.set(plan.id, plan.name)
    }
    const subscriptionsByPlan: ReadonlyMap<string, number | undefined> =
      counts.data ?? new Map<string, number | undefined>()
    const out = new Map<string, FeatureLinkage>()
    for (const feature of features) {
      const own = rows.filter((row) => row.featureId === feature.id)
      const priced = feature.meterId
        ? priceRows.filter((row) => (row.meterId || row.meter?.id) === feature.meterId)
        : []
      const linked = [
        ...new Set(
          [...own.map((row) => row.entityId), ...priced.map((row) => row.entityId)].filter(
            (id): id is string => !!id,
          ),
        ),
      ]
      const known = linked.map((planId) => subscriptionsByPlan.get(planId))
      out.set(feature.id, {
        planIds: linked,
        plans: linked.map((id) => ({ id, name: names.get(id) ?? id })),
        entitlements: own.length,
        subscriptions: known.every((value) => value !== undefined)
          ? known.reduce<number>((sum, value) => sum + (value ?? 0), 0)
          : undefined,
      })
    }
    return out
  }, [features, rows, priceRows, counts.data, expandedNames, plans.data])

  const isPending =
    (entitlements.isPending && ids.length > 0) ||
    (prices.isPending && meterIds.length > 0) ||
    (plans.isPending && unnamed.length > 0)

  return { byFeature, isPending }
}
