import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type AddContractCharge,
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  type CancelSubscription,
  type CreateSubscription,
  type CreditGrant,
  type EditContractCharge,
  type EndContractCharge,
  type Money,
  type Subscription,
  type SubscriptionDetail,
  type SubscriptionEntitlement,
  type SubscriptionLine,
  type SubscriptionLineSource,
  type SubscriptionQuery,
  type SubscriptionSchedule,
  SubscriptionScheduleType,
  SubscriptionSortField,
  SubscriptionStatus,
  type SubscriptionUsage,
  moneyOr,
} from '@fp/domain'
import { type CreditGrantWire, toCreditGrant, toCreditGrantTerms } from './creditGrants'
import { type InvoiceWire, toInvoice } from './invoices'
import { queryKeys } from './keys'
import { toOverrideLineItem } from './priceOverrides'
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
  currentPeriodStart?: Date | undefined
  currentPeriodEnd?: Date | undefined
  startDate?: Date | undefined
  createdAt?: Date | undefined
  billingPeriodCount?: number | undefined
  cancelAt?: Date | undefined
  cancelAtPeriodEnd?: boolean | undefined
  cancelledAt?: Date | undefined
  endDate?: Date | undefined
  trialEnd?: Date | undefined
  paymentTerms?: string | undefined
  collectionMethod?: string | undefined
  metadata?: Record<string, string> | undefined
  trialStart?: Date | undefined
  timezone?: string | undefined
  lookupKey?: string | undefined
  commitmentAmount?: string | undefined
  latestInvoice?: { id?: string | undefined; invoiceNumber?: string | undefined } | undefined
}

const SUBSCRIPTION_STATUSES = new Set<string>(Object.values(SubscriptionStatus))

/** The API serialises an unset Go time as `0001-01-01T00:00:00Z`; that means "no date", not "ended long ago". */
function realDate(value: Date | undefined | null): Date | null {
  return value && value.getUTCFullYear() > 1 ? value : null
}

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
    currentPeriodStart: wire.currentPeriodStart ?? null,
    currentPeriodEnd: wire.currentPeriodEnd ?? null,
    startDate: realDate(wire.startDate),
    createdAt: wire.createdAt ?? null,
  }
}

export function toSubscriptionDetail(wire: SubscriptionWire): SubscriptionDetail {
  return {
    ...toSubscription(wire),
    billingPeriod: (wire.billingPeriod as BillingPeriod | undefined) ?? null,
    billingPeriodCount: wire.billingPeriodCount ?? 1,
    cancelAt: realDate(wire.cancelAt),
    cancelAtPeriodEnd: wire.cancelAtPeriodEnd ?? false,
    cancelledAt: realDate(wire.cancelledAt),
    endDate: realDate(wire.endDate),
    trialEnd: realDate(wire.trialEnd),
    paymentTerms: wire.paymentTerms ?? '',
    collectionMethod: wire.collectionMethod ?? '',
    metadata: wire.metadata ?? {},
    trialStart: realDate(wire.trialStart),
    timezone: wire.timezone ?? '',
    lookupKey: wire.lookupKey ?? '',
    commitmentAmount:
      wire.commitmentAmount && Number(wire.commitmentAmount) > 0
        ? moneyOr(wire.commitmentAmount, wire.currency)
        : null,
    latestInvoice: wire.latestInvoice?.id
      ? {
          id: wire.latestInvoice.id,
          number: wire.latestInvoice.invoiceNumber || wire.latestInvoice.id,
        }
      : null,
  }
}

export interface SubscriptionLineWire {
  id?: string | undefined
  displayName?: string | undefined
  planDisplayName?: string | undefined
  meterDisplayName?: string | undefined
  priceType?: string | undefined
  entityType?: string | undefined
  priceId?: string | undefined
  quantity?: string | undefined
  billingPeriod?: string | undefined
  currency?: string | undefined
  price?: { amount?: string | undefined; currency?: string | undefined } | undefined
  startDate?: Date | undefined
  endDate?: Date | undefined
}

const LINE_SOURCE: Record<string, SubscriptionLineSource> = {
  plan: 'plan',
  addon: 'addon',
  subscription: 'contract',
}

export function toSubscriptionLine(wire: SubscriptionLineWire, index = 0): SubscriptionLine {
  return {
    id: wire.id ?? `line_${index}`,
    name: wire.displayName || wire.planDisplayName || wire.meterDisplayName || 'Charge',
    kind: wire.priceType === 'USAGE' ? 'usage' : 'fixed',
    quantity: wire.quantity ?? '',
    billingPeriodLabel: BILLING_PERIOD_LABEL[(wire.billingPeriod ?? '') as BillingPeriod] ?? '—',
    amount: moneyOr(wire.price?.amount, wire.price?.currency || wire.currency),
    startDate: realDate(wire.startDate),
    endDate: realDate(wire.endDate),
    source: LINE_SOURCE[wire.entityType ?? ''] ?? 'plan',
    priceId: wire.priceId ?? '',
  }
}

export interface SubscriptionFeatureWire {
  feature?: { id?: string | undefined; name?: string | undefined } | undefined
  entitlement?:
    | {
        isEnabled?: boolean | undefined
        isSoftLimit?: boolean | undefined
        usageLimit?: number | undefined
        usageResetPeriod?: string | undefined
      }
    | undefined
}

export function toSubscriptionEntitlement(wire: SubscriptionFeatureWire): SubscriptionEntitlement {
  const period = wire.entitlement?.usageResetPeriod ?? ''
  return {
    featureId: wire.feature?.id ?? '',
    name: wire.feature?.name || wire.feature?.id || 'Feature',
    enabled: wire.entitlement?.isEnabled ?? false,
    usageLimit: wire.entitlement?.usageLimit ?? null,
    softLimit: wire.entitlement?.isSoftLimit ?? false,
    resetPeriodLabel:
      period && period !== 'NEVER' ? (BILLING_PERIOD_LABEL[period as BillingPeriod] ?? period) : '',
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

/**
 * A subscription draft, as a `CreateSubscriptionRequest`.
 *
 * Empty lists and blank optionals are left out rather than sent empty: an
 * `overrideLineItems: []` is noise on the wire and, on some deployments, a
 * validation error. Credit grants are scoped by the request itself, so each one
 * carries `scope: 'SUBSCRIPTION'` and no target id.
 */
export function toCreateSubscriptionRequest(draft: CreateSubscription): Record<string, unknown> {
  return {
    customerId: draft.customerId,
    planId: draft.planId,
    currency: draft.currency.toLowerCase(),
    billingPeriod: draft.billingPeriod,
    billingPeriodCount: draft.billingPeriodCount,
    ...(draft.startDate ? { startDate: new Date(`${draft.startDate}T00:00:00Z`) } : {}),
    ...(draft.trialPeriodDays ? { trialPeriodDays: draft.trialPeriodDays } : {}),
    ...(draft.priceOverrides.length > 0
      ? { overrideLineItems: draft.priceOverrides.map(toOverrideLineItem) }
      : {}),
    ...(draft.entitlementOverrides.length > 0
      ? {
          overrideEntitlements: draft.entitlementOverrides.map((override) => ({
            entitlementId: override.entitlementId,
            ...(override.usageLimit !== undefined ? { usageLimit: override.usageLimit } : {}),
            ...(override.isEnabled !== undefined ? { isEnabled: override.isEnabled } : {}),
          })),
        }
      : {}),
    ...(draft.creditGrants.length > 0
      ? {
          creditGrants: draft.creditGrants.map((grant) => ({
            name: grant.name,
            credits: grant.credits,
            cadence: grant.cadence,
            scope: 'SUBSCRIPTION',
            ...toCreditGrantTerms(grant),
          })),
        }
      : {}),
  }
}

/** Start a subscription — `POST /subscriptions`. Call `mutateAsync(draft)`. */
export function useCreateSubscription() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateSubscription) =>
      call(() =>
        client.subscriptions.createSubscription(toCreateSubscriptionRequest(draft) as never),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
    },
  })
}

/**
 * One subscription, with its customer and plan resolved.
 *
 * Read through search by id rather than `GET /subscriptions/{id}`, because only
 * the search accepts `expand: 'customer,plan'` — the single read returns the
 * customer as a bare id, which would put a ULID in the page header.
 */
export function useSubscription(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.detail(id),
    queryFn: async () => {
      const response = await call(() =>
        client.subscriptions.querySubscription({
          subscriptionIds: [id],
          expand: 'customer,plan',
          limit: 1,
          offset: 0,
        } as never),
      )
      const [item] = response.items ?? []
      return item ? toSubscriptionDetail(item as SubscriptionWire) : null
    },
    enabled: id.length > 0,
  })
}

/**
 * The priced lines and the credit grants share one read, `GET /subscriptions/{id}`,
 * so both hooks use one query key and each selects its own part.
 */
function useSubscriptionFull<T>(
  id: string,
  select: (response: { lineItems?: unknown; creditGrants?: unknown }) => T,
) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.lines(id),
    queryFn: () => call(() => client.subscriptions.getSubscription(id)),
    select,
    enabled: id.length > 0,
  })
}

/** The priced lines — `GET /subscriptions/{id}`, the only read that carries them. */
export function useSubscriptionLines(id: string) {
  return useSubscriptionFull(id, (response) =>
    ((response.lineItems ?? []) as SubscriptionLineWire[]).map(toSubscriptionLine),
  )
}

/** The credit grants this contract was given, from the same read as the lines. */
export function useSubscriptionCreditGrants(id: string) {
  return useSubscriptionFull(id, (response): CreditGrant[] =>
    ((response.creditGrants ?? []) as CreditGrantWire[]).map(toCreditGrant),
  )
}

/** What the subscription includes — `GET /subscriptions/{id}/entitlements`. */
export function useSubscriptionEntitlements(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.entitlements(id),
    queryFn: async () => {
      const response = await call(() => client.subscriptions.getSubscriptionEntitlements(id))
      return ((response.features ?? []) as SubscriptionFeatureWire[]).map(toSubscriptionEntitlement)
    },
    enabled: id.length > 0,
  })
}

export function toCancelSubscriptionRequest(draft: CancelSubscription): Record<string, unknown> {
  return {
    cancellationType: draft.cancellationType,
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
  }
}

const invalidateSubscription = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
}

/** End a subscription now or at the end of the period — `POST /subscriptions/{id}/cancel`. */
export function useCancelSubscription() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: CancelSubscription }) =>
      call(() =>
        client.subscriptions.cancelSubscription(id, toCancelSubscriptionRequest(draft) as never),
      ),
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** Start a draft subscription — `POST /subscriptions/{id}/activate`. */
export function useActivateSubscription() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, startDate }: { id: string; startDate: Date }) =>
      call(() => client.subscriptions.activateSubscription(id, { startDate })),
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** A date input's `YYYY-MM-DD` as the instant the API takes; empty means "now" and is left out. */
const effectiveFrom = (day: string) => (day ? `${day}T00:00:00Z` : undefined)

/** A new fixed recurring charge on one contract, priced inline — `POST /subscriptions/{id}/lineitems`. */
export function toCreateLineItemRequest(
  draft: AddContractCharge,
  billingPeriod: BillingPeriod,
): Record<string, unknown> {
  return {
    displayName: draft.name.trim(),
    quantity: Number(draft.quantity) || 1,
    ...(draft.startDate ? { startDate: new Date(`${draft.startDate}T00:00:00Z`) } : {}),
    price: {
      type: 'FIXED',
      billingModel: 'FLAT_FEE',
      billingPeriod,
      invoiceCadence: 'ADVANCE',
      priceUnitType: 'FIAT',
      amount: draft.amount.trim(),
      displayName: draft.name.trim(),
    },
  }
}

export function toUpdateLineItemRequest(draft: EditContractCharge): Record<string, unknown> {
  const from = effectiveFrom(draft.effectiveFrom)
  return { amount: draft.amount.trim(), ...(from ? { effectiveFrom: from } : {}) }
}

export function toDeleteLineItemRequest(draft: EndContractCharge): Record<string, unknown> {
  const from = effectiveFrom(draft.effectiveFrom)
  return from ? { effectiveFrom: from } : {}
}

/** Add a charge to one contract — only this contract changes. */
export function useCreateSubscriptionLineItem() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      billingPeriod,
      draft,
    }: {
      id: string
      billingPeriod: BillingPeriod
      draft: AddContractCharge
    }) =>
      call(() =>
        client.subscriptions.createSubscriptionLineItem(
          id,
          toCreateLineItemRequest(draft, billingPeriod) as never,
        ),
      ),
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** Change a charge's price on one contract — `PUT /subscriptions/lineitems/{lineItemId}`. */
export function useUpdateSubscriptionLineItem() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ lineItemId, draft }: { lineItemId: string; draft: EditContractCharge }) =>
      call(() =>
        client.subscriptions.updateSubscriptionLineItem(
          lineItemId,
          toUpdateLineItemRequest(draft) as never,
        ),
      ),
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** End a charge on one contract — `DELETE /subscriptions/lineitems/{lineItemId}`. */
export function useDeleteSubscriptionLineItem() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ lineItemId, draft }: { lineItemId: string; draft: EndContractCharge }) =>
      call(() =>
        client.subscriptions.deleteSubscriptionLineItem(
          lineItemId,
          toDeleteLineItemRequest(draft) as never,
        ),
      ),
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** A number from the usage endpoint as exact money, without exponent notation. */
function moneyFromNumber(amount: number | undefined, currency: string | undefined): Money {
  const text = Number.isFinite(amount) ? (amount as number).toFixed(8).replace(/\.?0+$/, '') : '0'
  return moneyOr(text === '' || text === '-' ? '0' : text, currency)
}

export interface SubscriptionUsageWire {
  amount?: number | undefined
  currency?: string | undefined
  startTime?: Date | undefined
  endTime?: Date | undefined
  commitmentAmount?: number | undefined
  commitmentUtilized?: number | undefined
  overageAmount?: number | undefined
  hasOverage?: boolean | undefined
  charges?:
    | Array<{
        amount?: number | undefined
        currency?: string | undefined
        isOverage?: boolean | undefined
        meterDisplayName?: string | undefined
        meterId?: string | undefined
        quantity?: number | undefined
        subscriptionLineItemId?: string | undefined
      }>
    | undefined
}

export function toSubscriptionUsage(wire: SubscriptionUsageWire): SubscriptionUsage {
  const currency = wire.currency
  const optional = (value: number | undefined) =>
    value && value > 0 ? moneyFromNumber(value, currency) : null
  return {
    periodStart: wire.startTime ?? null,
    periodEnd: wire.endTime ?? null,
    total: moneyFromNumber(wire.amount, currency),
    commitment: optional(wire.commitmentAmount),
    commitmentUtilized: wire.commitmentAmount
      ? moneyFromNumber(wire.commitmentUtilized, currency)
      : null,
    overage: optional(wire.overageAmount),
    hasOverage: wire.hasOverage ?? false,
    charges: (wire.charges ?? []).map((charge, index) => ({
      id: charge.subscriptionLineItemId || charge.meterId || `charge_${index}`,
      name: charge.meterDisplayName || 'Usage',
      quantity: charge.quantity ?? 0,
      amount: moneyFromNumber(charge.amount, charge.currency || currency),
      isOverage: charge.isOverage ?? false,
    })),
  }
}

/** This period's consumption — `POST /subscriptions/usage`. */
export function useSubscriptionUsage(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.usage(id),
    queryFn: async () => {
      const response = await call(() =>
        client.subscriptions.getSubscriptionUsage({ subscriptionId: id } as never),
      )
      return toSubscriptionUsage(response as SubscriptionUsageWire)
    },
    enabled: id.length > 0,
  })
}

export interface SubscriptionScheduleWire {
  id?: string | undefined
  scheduleType?: string | undefined
  scheduledAt?: Date | undefined
  status?: string | undefined
  canBeCancelled?: boolean | undefined
  daysUntilExecution?: number | undefined
}

/** Only changes still waiting to run are shown; executed or cancelled ones are history. */
export function toPendingSchedules(wires: SubscriptionScheduleWire[]): SubscriptionSchedule[] {
  const types = new Set<string>(Object.values(SubscriptionScheduleType))
  return wires
    .filter(
      (wire) => (wire.status ?? 'pending') === 'pending' && types.has(wire.scheduleType ?? ''),
    )
    .map((wire) => ({
      id: wire.id ?? '',
      type: wire.scheduleType as SubscriptionScheduleType,
      scheduledAt: wire.scheduledAt ?? null,
      daysUntilExecution: wire.daysUntilExecution ?? null,
      canBeCancelled: wire.canBeCancelled ?? false,
    }))
}

/** Changes queued for a future date — `GET /subscriptions/{id}/schedules`. */
export function useSubscriptionSchedules(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.schedules(id),
    queryFn: async () => {
      const response = await call(() => client.subscriptions.listSubscriptionSchedules(id))
      return toPendingSchedules((response.schedules ?? []) as SubscriptionScheduleWire[])
    },
    enabled: id.length > 0,
  })
}

/** The invoices this contract produced, newest first — the invoice search filtered by `subscription_id`. */
export function useSubscriptionInvoices(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.invoices(id),
    queryFn: async () => {
      const response = await call(() =>
        client.invoices.queryInvoice({
          subscriptionId: id,
          skipLineItems: true,
          limit: 50,
          offset: 0,
          sort: [{ field: 'created_at', direction: 'desc' }],
        } as never),
      )
      return (response.items ?? []).map((item) => toInvoice(item as InvoiceWire))
    },
    enabled: id.length > 0,
  })
}
