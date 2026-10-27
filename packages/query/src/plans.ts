import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type CreatePlan,
  type Plan,
  type PlanHeadline,
  type PlanQuery,
  PlanSortField,
  PlanStatus,
  PLAN_FILTERS,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { nameContainsFilter, toFilterConditions } from './search'
import { sortWithTieBreak } from './listSort'
import { ALL_SUBSCRIPTION_STATUSES } from './subscriptionStatuses'

/**
 * Plans: the translation between product vocabulary and the API.
 *
 * Reached through `POST /plans/search`, the same documented search endpoint the
 * counts use. `expand: 'prices'` is asked for so a row can say how many charges
 * a plan carries: the number that distinguishes a plan that bills from a plan
 * that is only a name so far. Without it the API returns `prices` only as ids
 * or not at all, and the "Charges" column would read 0 for everything.
 */

/** The wire shape this reads, after the SDK camelCases the response. */
export interface PlanWire {
  id?: string | undefined
  name?: string | undefined
  lookupKey?: string | undefined
  description?: string | undefined
  status?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  prices?: unknown[] | undefined
  metadata?: Record<string, string> | null | undefined
}

const PLAN_STATUSES = new Set<string>(Object.values(PlanStatus))

/**
 * One headline price from a plan's charges, for the pricing-card view.
 *
 * A pricing card shows a single number, so this picks one: the recurring fixed
 * base a customer thinks of as "the price", falling back to the first charge
 * when a plan is purely usage-priced. `displayAmount` is the string the API
 * formatted; a plan that prices nothing has no headline at all.
 */
function toHeadline(prices: unknown[] | undefined): PlanHeadline | null {
  if (!Array.isArray(prices) || prices.length === 0) return null
  const list = prices as Array<Record<string, unknown>>
  const base =
    list.find((p) => p['type'] === 'FIXED' && p['billingCadence'] === 'RECURRING') ?? list[0]
  if (!base) return null
  const amount = typeof base['displayAmount'] === 'string' ? base['displayAmount'] : null
  if (!amount) return null
  const period = typeof base['billingPeriod'] === 'string' ? (base['billingPeriod'] as string) : ''
  return { amount, period }
}

/**
 * What a plan's usage charges meter, as a customer reads them: the charge's
 * display name, else its meter's name (`expand: 'meters'`), without repeats.
 */
function usageNames(prices: Array<Record<string, unknown>>): string[] {
  const names = prices
    .filter((price) => price['type'] === 'USAGE')
    .map((price) => {
      const display = typeof price['displayName'] === 'string' ? price['displayName'].trim() : ''
      const meter = price['meter'] as Record<string, unknown> | undefined
      const meterName = typeof meter?.['name'] === 'string' ? meter['name'].trim() : ''
      return display || meterName
    })
    .filter(Boolean)
  return [...new Set(names)]
}

export function toPlan(wire: PlanWire): Plan {
  const prices: Array<Record<string, unknown>> = Array.isArray(wire.prices)
    ? (wire.prices as Array<Record<string, unknown>>)
    : []
  const status = PLAN_STATUSES.has(wire.status ?? '')
    ? (wire.status as PlanStatus)
    : // An unknown status is the API ahead of this client. Treating it as
      // published is wrong but harmless; dropping the row would hide it.
      PlanStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Untitled plan',
    lookupKey: wire.lookupKey ?? '',
    description: wire.description ?? '',
    status,
    chargeCount: prices.length,
    // `type` is `FIXED` or `USAGE` on the wire. Anything else is counted as a
    // charge but as neither kind, so a future price type shows the plan as
    // having charges rather than silently inflating one of the two figures.
    fixedChargeCount: prices.filter((price) => price['type'] === 'FIXED').length,
    usageChargeCount: prices.filter((price) => price['type'] === 'USAGE').length,
    headline: toHeadline(wire.prices),
    usageNames: usageNames(prices),
    metadata: wire.metadata ?? {},
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

/** Product sort names to the wire's. The only place the two are related. */
const SORT_FIELD: Record<PlanSortField, string> = {
  [PlanSortField.Name]: 'name',
  [PlanSortField.CreatedAt]: 'created_at',
  [PlanSortField.UpdatedAt]: 'updated_at',
}

/** Domain query out, `PlanFilter` in. Page numbers are 1-based; offsets are not. */
export function toPlanFilter(query: PlanQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    // Meters too, so a usage-only plan can name what it meters.
    expand: 'prices,meters',
    ...(query.search || (query.filters?.length ?? 0) > 0
      ? {
          filters: [
            ...(query.search ? nameContainsFilter(query.search) : []),
            ...toFilterConditions(query.filters ?? [], PLAN_FILTERS),
          ],
        }
      : {}),
  }
}

export interface PlanPage {
  plans: Plan[]
  total: number
}

export async function fetchPlans(
  client: Flexprice,
  query: PlanQuery,
  signal?: AbortSignal,
): Promise<PlanPage> {
  const response = await call(
    (options) => client.plans.queryPlan(toPlanFilter(query) as never, options),
    signal,
  )
  const plans = (response.items ?? []).map((item) => toPlan(item as PlanWire))

  return {
    // Status is not a server-side filter on PlanFilter, so it is applied here.
    // Stated rather than hidden: it narrows the current page, not the whole set.
    plans:
      query.statuses.length > 0
        ? plans.filter((plan) => query.statuses.includes(plan.status))
        : plans,
    total: response.pagination?.total ?? 0,
  }
}

export function usePlans(query: PlanQuery, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  // `view` is a layout, not a filter: it must not miss the cache on a toggle.
  const { view: _view, ...key } = query

  return useQuery({
    queryKey: queryKeys.plans.list({ ...key, statuses: [...query.statuses].sort() }),
    queryFn: ({ signal }) => fetchPlans(client, query, signal),
    enabled: options.enabled ?? true,
    placeholderData: (previous) => previous,
  })
}

/**
 * The plan details draft, mapped to the wire.
 *
 * A plan's lookup key is optional and editable: unlike an add-on's: so it is
 * sent whenever present in either direction. Empty optional fields are dropped
 * on create (absent and `""` are different to the API) but sent as `""` on
 * update, so clearing the text on an edit actually clears it.
 */
export function toCreatePlanRequest(draft: CreatePlan): Record<string, unknown> {
  return {
    name: draft.name,
    ...(draft.lookupKey ? { lookupKey: draft.lookupKey } : {}),
    ...(draft.description ? { description: draft.description } : {}),
  }
}

export function toUpdatePlanRequest(draft: CreatePlan): Record<string, unknown> {
  return {
    name: draft.name,
    lookupKey: draft.lookupKey ?? '',
    description: draft.description ?? '',
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
  }
}

export function useCreatePlan() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Plan created', error: 'Could not create the plan.' } },
    mutationFn: (draft: CreatePlan) =>
      call(() => client.plans.createPlan(toCreatePlanRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
    },
  })
}

export function useUpdatePlan() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: CreatePlan }) =>
      call(() => client.plans.updatePlan(id, toUpdatePlanRequest(draft) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
    },
  })
}

/**
 * One plan, for its detail page.
 *
 * `expand: 'prices'` so the header can say how many charges the plan carries
 * before the Overview tab's own price query resolves. Reached by id through
 * `GET /plans/{id}`, distinct from the list's search.
 */
export function usePlan(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.plans.detail(id),
    queryFn: async ({ signal }) => {
      const wire = await call((options) => client.plans.getPlan(id, options), signal)
      return toPlan(wire as PlanWire)
    },
    enabled: id.length > 0,
  })
}

/**
 * Archive a plan.
 *
 * A soft delete: `DELETE /plans/{id}` retires the plan without erasing the
 * history that referenced it. The list and the plan's own detail are stale
 * afterwards, so both are invalidated.
 */
export function useArchivePlan() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => call(() => client.plans.deletePlan(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
    },
  })
}

/** Duplicate a plan, charges and all, under a new name. */
export function useClonePlan() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      name,
      lookupKey,
      description,
      metadata,
    }: {
      id: string
      name: string
      lookupKey?: string
      description?: string
      metadata?: Record<string, string>
    }) =>
      call(() =>
        client.plans.clonePlan(id, {
          name,
          ...(lookupKey ? { lookupKey } : {}),
          ...(description ? { description } : {}),
          ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
        } as never),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
    },
  })
}

/**
 * Push a plan's charge changes onto its live subscriptions.
 *
 * A plan's prices and its subscriptions can drift once a charge is edited; this
 * runs the backend workflow that reconciles them. It returns a workflow handle,
 * not a finished result: the sync completes asynchronously.
 */
export function useSyncPlanPrices() {
  const client = useFlexprice()

  return useMutation({
    mutationFn: (id: string) => call(() => client.plans.syncPlanPrices(id)),
  })
}

/**
 * One row of the plan's subscriber list, for the detail page's metric rail.
 *
 * Deliberately a light mapping, not a full `Subscription` domain model: the rail
 * leads with how many customers are actually on the plan: the one number that
 * says whether it is in use: so it needs only an id, a status to count the
 * active ones, and the currency they bill in. A subscriptions *section* would
 * want the whole record; a metric does not.
 */
export interface PlanSubscriptionRow {
  id: string
  /** `active`, `cancelled`, …: whatever the API sent, so the page can count it. */
  status: string
  currency: string
}

/**
 * The subscriptions currently on a plan.
 *
 * Reached through `POST /subscriptions/search` scoped to this plan; scoping is
 * what makes the rail count *this* plan's subscribers rather than the whole
 * book. A generous `limit` because the rail tallies them: a plan's subscriber
 * list is a page, not a stream: and the status field is read under a few
 * spellings, since the capture and the SDK camelCasing disagree on it.
 *
 * The scope key is `planId`, **camelCase**. The SDK parses this body through a
 * generated zod schema that strips undeclared keys, and `SubscriptionFilter`
 * declares `planId` (remapped to `plan_id` on the wire). A literal `plan_id`
 * here is silently dropped: verified live, the request left as `{limit: 100}`
 * and the rail counted every subscription in the tenant. The MSW handler
 * accepts both spellings, so no test could catch it.
 */
export function usePlanSubscriptions(planId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ planId }),
    queryFn: async () => {
      const response = (await call(() =>
        client.subscriptions.querySubscription({
          planId,
          subscriptionStatus: ALL_SUBSCRIPTION_STATUSES,
          limit: 100,
        } as never),
      )) as { items?: unknown[] }

      return (response.items ?? []).map((item): PlanSubscriptionRow => {
        const row = item as Record<string, unknown>
        const read = (...keys: string[]): string => {
          for (const key of keys) {
            const value = row[key]
            if (typeof value === 'string') return value
          }
          return ''
        }
        return {
          id: read('id'),
          status: read('subscriptionStatus', 'subscription_status', 'status'),
          currency: read('currency'),
        }
      })
    },
    // A plan with no id yet (a create in flight) has no subscriptions to fetch.
    enabled: planId.length > 0,
  })
}
