import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  type Subscription,
  type SubscriptionQuery,
  SubscriptionSortField,
  SubscriptionStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Subscriptions: the translation between product vocabulary and the API.
 *
 * Reached through `POST /subscriptions/search`
 * (`client.subscriptions.querySubscription`). The wire carries the customer and
 * plan as nested expansions and a `billingPeriod` in transport spelling; the
 * domain resolves the names and turns the period into a word here, so no screen
 * ever sees `HALF_YEARLY` or has to join a customer to a subscription itself.
 */

/**
 * The wire shape this reads, after the SDK camelCases the response.
 *
 * `currentPeriodEnd`, `startDate` and `createdAt` arrive as `Date` (the SDK
 * parses them), so they are not re-parsed here.
 */
export interface SubscriptionWire {
  id?: string | undefined
  customerId?: string | undefined
  customer?: { name?: string | undefined; email?: string | undefined } | undefined
  planId?: string | undefined
  plan?: { name?: string | undefined } | undefined
  subscriptionStatus?: string | undefined
  currency?: string | undefined
  billingPeriod?: string | undefined
  currentPeriodEnd?: Date | undefined
  startDate?: Date | undefined
  createdAt?: Date | undefined
}

const SUBSCRIPTION_STATUSES = new Set<string>(Object.values(SubscriptionStatus))

export function toSubscription(wire: SubscriptionWire): Subscription {
  // Known statuses pass through; everything else — the API's `draft`, and any
  // value this build has not learned — collapses to Incomplete, the state a
  // subscription sits in before it is running.
  const status = SUBSCRIPTION_STATUSES.has(wire.subscriptionStatus ?? '')
    ? (wire.subscriptionStatus as SubscriptionStatus)
    : SubscriptionStatus.Incomplete

  return {
    id: wire.id ?? '',
    customerId: wire.customerId ?? '',
    // Resolved here so no cell has to fall back, and no grid joins data.
    customerName: wire.customer?.name || wire.customer?.email || wire.customerId || 'Unknown',
    planId: wire.planId ?? '',
    planName: wire.plan?.name || wire.planId || '—',
    status,
    currency: (wire.currency ?? '').toUpperCase(),
    billingPeriodLabel: BILLING_PERIOD_LABEL[(wire.billingPeriod ?? '') as BillingPeriod] ?? '—',
    currentPeriodEnd: wire.currentPeriodEnd ?? null,
    startDate: wire.startDate ?? null,
    createdAt: wire.createdAt ?? null,
  }
}

const SORT_FIELD: Record<SubscriptionSortField, string> = {
  [SubscriptionSortField.StartDate]: 'start_date',
  [SubscriptionSortField.CreatedAt]: 'created_at',
}

/**
 * Domain query out, `SubscriptionFilter` in.
 *
 * `expand: 'customer,plan'` is load-bearing, not an optimisation. The live
 * search returns `plan` embedded by default but **not** `customer`, so without
 * the expand every row arrives with `customer` absent and `toSubscription`
 * falls all the way through to `customerId` — the Customer column renders a raw
 * `cust_01M3H…` ULID for every subscription. Verified live: the same request
 * with `expand: 'customer'` resolves the name to "Test".
 *
 * The value is singular. `expand: 'customers'` is accepted and silently does
 * nothing, which is the failure this comment exists to prevent. `plan` is named
 * explicitly rather than relied on as a default.
 */
export function toSubscriptionFilter(query: SubscriptionQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: [{ field: SORT_FIELD[query.sortBy], direction: query.sortDirection }],
    expand: 'customer,plan',
  }
}

export interface SubscriptionPage {
  subscriptions: Subscription[]
  total: number
}

export async function fetchSubscriptions(
  client: Flexprice,
  query: SubscriptionQuery,
): Promise<SubscriptionPage> {
  const response = await call(() =>
    client.subscriptions.querySubscription(toSubscriptionFilter(query) as never),
  )
  const subscriptions = (response.items ?? []).map((item) =>
    toSubscription(item as SubscriptionWire),
  )

  // Neither status nor search is a server-side filter here, so both are applied
  // on the page — the same split coupons and add-ons use.
  const term = query.search.trim().toLowerCase()
  const filtered = subscriptions.filter((subscription) => {
    const matchesStatus =
      query.statuses.length === 0 || query.statuses.includes(subscription.status)
    const matchesSearch =
      term.length === 0 ||
      subscription.customerName.toLowerCase().includes(term) ||
      subscription.planName.toLowerCase().includes(term)
    return matchesStatus && matchesSearch
  })

  return {
    subscriptions: filtered,
    total: response.pagination?.total ?? 0,
  }
}

/**
 * The page's entire interface to subscriptions.
 *
 * Takes domain vocabulary, returns domain models — the same controlled shape as
 * `useCoupons`, so the page can keep its query in the URL rather than in
 * component state.
 */
export function useSubscriptions(query: SubscriptionQuery) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchSubscriptions(client, query),
    placeholderData: (previous) => previous,
  })
}
