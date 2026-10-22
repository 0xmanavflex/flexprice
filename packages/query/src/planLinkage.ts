import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, call, listCreditGrants } from '@fp/api'
import { EntitlementEntityType } from '@fp/domain'
import { COUNT_CONCURRENCY, mapBounded } from './featureLinkage'
import { queryKeys } from './keys'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { LIVE_SUBSCRIPTION_STATUSES } from './subscriptionStatuses'

/**
 * What a plan contains, beyond the charges the row already carries.
 *
 * The plan itself answers none of this, so it is read for the rows on screen
 * and no more. Three reads, chosen by what each route can actually filter —
 * every one of these was checked against the live API rather than inferred
 * from the SDK's types, which describe less than the routes accept:
 *
 *   - one `POST /entitlements/search` over the visible plan ids
 *     (`entityType: PLAN`, `entityIds`), each result naming its plan;
 *   - one `GET /creditgrants?plan_ids=…` over the same ids. The SDK has no
 *     list method, so this goes through `@fp/api` (`creditGrants.ts`) — worth
 *     it, because the alternative is one request per row;
 *   - one `limit: 1` subscription count **per plan**, read for its
 *     `pagination.total`. `POST /subscriptions/search` filters on a single
 *     `planId`; its `planIds` is accepted and ignored, which would make every
 *     row show the environment's whole subscription count. So these cannot be
 *     batched: they run as one query working through the plans
 *     {@link COUNT_CONCURRENCY} at a time, under the same per-plan cache keys
 *     the features grid uses, so a plan counted for one grid is not counted
 *     again for the other.
 *
 * A count that could not be read is `undefined`, not zero — "we could not find
 * out" and "there are none" must not render the same.
 */
export interface PlanLinkage {
  /** Entitlements the plan grants. */
  entitlements: number | undefined
  /** Credit grants attached to the plan. */
  creditGrants: number | undefined
  /** Contracts (subscriptions) sitting on the plan. */
  contracts: number | undefined
}

interface EntitlementRow {
  entityId?: string
  entityType?: string
}

interface CreditGrantRow {
  plan_id?: string | null
  scope?: string | null
}

/** How many grants and entitlements one page of plans could reasonably have. */
const BULK_LIMIT = 1000

export function usePlanLinkage(planIds: readonly string[]): {
  byPlan: ReadonlyMap<string, PlanLinkage>
  isPending: boolean
} {
  const client = useFlexprice()
  const queryClient = useQueryClient()
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()

  // Sorted so that paging back to a set already read hits the same cache entry.
  const ids = useMemo(() => [...new Set(planIds)].sort(), [planIds])

  const entitlements = useQuery({
    queryKey: queryKeys.entitlements.list({ entityType: 'PLAN', entityIds: ids }),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.entitlements.queryEntitlement(
            {
              entityType: EntitlementEntityType.Plan,
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

  const creditGrants = useQuery({
    queryKey: queryKeys.creditGrants.list({ scope: 'plans', planIds: ids }),
    queryFn: async () => {
      const [token, environmentId] = await Promise.all([auth.getToken(), auth.getEnvironmentId()])
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to view credit grants.')
      const body = await listCreditGrants(serverURL, token, environmentId ?? '', {
        limit: BULK_LIMIT,
        offset: 0,
        planIds: [...ids],
      })
      return ((body as { items?: CreditGrantRow[] | null } | null)?.items ?? []) as CreditGrantRow[]
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  })

  const contracts = useQuery({
    queryKey: [...queryKeys.counts.of('subscriptions'), 'plans', ids] as const,
    queryFn: async ({ signal }) => {
      const totals = await mapBounded(
        ids,
        COUNT_CONCURRENCY,
        async (planId) => {
          try {
            return await queryClient.fetchQuery({
              // The same key the features grid counts under: one plan, one count.
              queryKey: [...queryKeys.counts.of('subscriptions'), 'plan', planId] as const,
              queryFn: async () => {
                const response = (await call(
                  (options) =>
                    client.subscriptions.querySubscription(
                      { planId, subscriptionStatus: LIVE_SUBSCRIPTION_STATUSES, limit: 1 },
                      options,
                    ),
                  signal,
                )) as { pagination?: { total?: number } }
                return response.pagination?.total ?? 0
              },
              staleTime: 5 * 60_000,
            })
          } catch {
            // Unknown, not zero.
            return undefined
          }
        },
        signal,
      )
      return new Map(ids.map((planId, index) => [planId, totals[index]] as const))
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
    retry: false,
    // Counts are looked up by plan id, so a previous page's map is safe to keep
    // on screen: a plan it lacks reads as unknown, never as zero.
    placeholderData: (previous) => previous,
  })

  const byPlan = useMemo(() => {
    // The searches honour their filters, but a looser backend must not be able
    // to attribute another plan's entitlement or grant to a row on screen.
    const wanted = new Set(ids)
    const entitlementsByPlan = new Map<string, number>()
    for (const row of entitlements.data ?? []) {
      const planId = row.entityId
      if (!planId || !wanted.has(planId)) continue
      entitlementsByPlan.set(planId, (entitlementsByPlan.get(planId) ?? 0) + 1)
    }
    const grantsByPlan = new Map<string, number>()
    for (const row of creditGrants.data ?? []) {
      const planId = row.plan_id
      if (!planId || !wanted.has(planId)) continue
      grantsByPlan.set(planId, (grantsByPlan.get(planId) ?? 0) + 1)
    }

    const out = new Map<string, PlanLinkage>()
    for (const planId of ids) {
      out.set(planId, {
        // A read that failed leaves the figure unknown; one that succeeded and
        // listed nothing for this plan means zero.
        entitlements: entitlements.isSuccess ? (entitlementsByPlan.get(planId) ?? 0) : undefined,
        creditGrants: creditGrants.isSuccess ? (grantsByPlan.get(planId) ?? 0) : undefined,
        contracts: contracts.data?.get(planId),
      })
    }
    return out
  }, [
    ids,
    entitlements.data,
    entitlements.isSuccess,
    creditGrants.data,
    creditGrants.isSuccess,
    contracts.data,
  ])

  const isPending =
    ids.length > 0 &&
    (entitlements.isPending || creditGrants.isPending || (contracts.isPending && !contracts.data))

  return { byPlan, isPending }
}
