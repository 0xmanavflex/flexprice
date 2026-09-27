import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type CreatePlan,
  type Plan,
  type PlanHeadline,
  type PlanQuery,
  PlanSortField,
  PlanStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Plans: the translation between product vocabulary and the API.
 *
 * Reached through `POST /plans/search`, the same documented search endpoint the
 * counts use. `expand: 'prices'` is asked for so a row can say how many charges
 * a plan carries — the number that distinguishes a plan that bills from a plan
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

export function toPlan(wire: PlanWire): Plan {
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
    chargeCount: Array.isArray(wire.prices) ? wire.prices.length : 0,
    headline: toHeadline(wire.prices),
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
    sort: [{ field: SORT_FIELD[query.sortBy], direction: query.sortDirection }],
    expand: 'prices',
    ...(query.search ? { nameContains: query.search } : {}),
  }
}

export interface PlanPage {
  plans: Plan[]
  total: number
}

export async function fetchPlans(client: Flexprice, query: PlanQuery): Promise<PlanPage> {
  const response = await call(() => client.plans.queryPlan(toPlanFilter(query) as never))
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

export function usePlans(query: PlanQuery) {
  const client = useFlexprice()

  // `view` is a layout, not a filter: it must not miss the cache on a toggle.
  const { view: _view, ...key } = query

  return useQuery({
    queryKey: queryKeys.plans.list({ ...key, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchPlans(client, query),
    placeholderData: (previous) => previous,
  })
}

/**
 * The plan details draft, mapped to the wire.
 *
 * A plan's lookup key is optional and editable — unlike an add-on's — so it is
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
  }
}

export function useCreatePlan() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
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
