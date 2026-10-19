import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  ErrorKind,
  type Flexprice,
  type FlexpriceModels,
  call,
  updateSubscriptionMetadata,
} from '@fp/api'
import {
  type AddContractAddon,
  type AddContractCharge,
  type AddContractCoupon,
  BILLING_PERIOD_LABEL,
  BillingModel,
  type BillingPeriod,
  BucketSize as BucketSizes,
  type BucketSize,
  CommitmentKind,
  type CancelSubscription,
  type CreateSubscription,
  type SubscriptionPhase,
  phaseStarts,
  type ChangeLineQuantity,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreateTaxAssociation,
  type CreditGrant,
  CreditGrantScope,
  type EditContractCharge,
  type EndContractCharge,
  EntitlementEntityType,
  type InvoicePreview,
  CouponType,
  type LineCommitment,
  type LinePricing,
  type LineChangePreview,
  type Money,
  type Subscription,
  type SubscriptionAddon,
  type SubscriptionCoupon,
  type SubscriptionDetail,
  type SubscriptionEntitlement,
  type SubscriptionLine,
  type SubscriptionLineSource,
  type SubscriptionQuery,
  type SubscriptionSchedule,
  type SubscriptionTax,
  SubscriptionScheduleType,
  SubscriptionSortField,
  SubscriptionStatus,
  type SubscriptionUsage,
  type Tier,
  type UsageTerms,
  PriceType,
  TierMode,
  TaxBehavior,
  formatMoney,
  money,
  moneyOr,
  SUBSCRIPTION_FILTERS,
} from '@fp/domain'
import {
  type CreditGrantWire,
  toCreditGrant,
  toCreditGrantRequest,
  toCreditGrantTerms,
} from './creditGrants'
import { toEntitlementRequest } from './entitlements'
import { type InvoiceDetailWire, type InvoiceWire, toInvoice, toInvoiceDetail } from './invoices'
import { queryKeys } from './keys'
import { toFilterConditions } from './search'
import { type ChargeWire, toCharge, toChargeRequest, toTier } from './prices'
import { toCreateTaxAssociationRequest } from './taxAssociations'
import { toOverrideLineItem } from './priceOverrides'
import { useFlexprice, useFlexpriceAuth, useFlexpriceServerURL } from './provider'
import { sortWithTieBreak } from './listSort'

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
          number: wire.latestInvoice.invoiceNumber?.trim() || '',
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
  meterId?: string | undefined
  /**
   * The whole price, as the API embeds it on the line.
   *
   * Typed as `ChargeWire` so `toCharge` can read it directly: a contract's
   * charge *is* a price, and reconstructing one from the handful of fields the
   * edit form happens to keep would be a second, lossier mapping of the same
   * record. The extra keys are the custom-unit ones `toLinePricing` reads and
   * `ChargeWire` has no use for.
   */
  price?:
    | (ChargeWire & {
        priceUnit?: string | undefined
        priceUnitAmount?: string | undefined
        priceUnitTiers?: TierWire[] | undefined
        parentPriceId?: string | undefined
      })
    | undefined
  invoiceCadence?: string | undefined
  commitmentType?: string | undefined
  commitmentAmount?: string | undefined
  commitmentQuantity?: string | undefined
  commitmentWindowed?: boolean | undefined
  commitmentOverageFactor?: string | undefined
  commitmentTrueUpEnabled?: boolean | undefined
  commitmentDuration?: string | undefined
  commitmentTimeBuckets?:
    | Array<{
        id?: string | undefined
        commitmentValue?: string | undefined
        start?: { hour?: number | undefined; minute?: number | undefined } | undefined
        end?: { hour?: number | undefined; minute?: number | undefined } | undefined
        overageFactor?: number | undefined
        trueUpEnabled?: boolean | undefined
        priceId?: string | undefined
      }>
    | undefined
  startDate?: Date | undefined
  endDate?: Date | undefined
}

type TierWire = { upTo?: number | null; unitAmount?: string; flatAmount?: string }

const LINE_SOURCE: Record<string, SubscriptionLineSource> = {
  plan: 'plan',
  addon: 'addon',
  subscription: 'contract',
}

const BILLING_MODELS = new Set<string>(Object.values(BillingModel))

function toLineCommitment(wire: SubscriptionLineWire): LineCommitment | null {
  const kind =
    wire.commitmentType === CommitmentKind.Quantity
      ? CommitmentKind.Quantity
      : wire.commitmentType === CommitmentKind.Amount
        ? CommitmentKind.Amount
        : null
  const value = kind === CommitmentKind.Quantity ? wire.commitmentQuantity : wire.commitmentAmount
  if (!kind || !value || Number(value) <= 0) return null
  const windows = (wire.commitmentTimeBuckets ?? []).flatMap((bucket, index) => {
    const bucketValue = bucket.commitmentValue?.trim()
    if (!bucketValue) return []
    return [
      {
        id: bucket.id || `window_${index}`,
        start: clock(bucket.start),
        end: clock(bucket.end),
        value: bucketValue,
        overageFactor: String(bucket.overageFactor ?? wire.commitmentOverageFactor ?? '1'),
        trueUp: bucket.trueUpEnabled ?? wire.commitmentTrueUpEnabled ?? false,
        ...(bucket.priceId ? { priceId: bucket.priceId } : {}),
      },
    ]
  })
  const duration =
    wire.commitmentDuration && wire.commitmentDuration in BILLING_PERIOD_LABEL
      ? (wire.commitmentDuration as BillingPeriod)
      : null
  return {
    kind,
    value,
    windowed: wire.commitmentWindowed ?? false,
    overageFactor: wire.commitmentOverageFactor || '1',
    trueUp: wire.commitmentTrueUpEnabled ?? false,
    ...(duration ? { duration } : {}),
    ...(windows.length ? { windows } : {}),
  }
}

const clock = (bucket?: { hour?: number | undefined; minute?: number | undefined }) =>
  `${String(bucket?.hour ?? 0).padStart(2, '0')}:${String(bucket?.minute ?? 0).padStart(2, '0')}`

const LINE_BUCKETS = new Set<string>(Object.values(BucketSizes))

/**
 * The window a line's usage is summed in, as the form offers it.
 *
 * A bucket as long as the billing period is the whole period, so a monthly
 * charge whose price reports MONTH reads as "Whole billing period" — the form
 * must not open on Month as though someone had chosen it. Unknown values read
 * as unset rather than as a value the select cannot show.
 */
export function toLineBucket(
  value: string | undefined,
  period: string | undefined,
): BucketSize | '' {
  if (!value || !LINE_BUCKETS.has(value)) return ''
  if (
    (value === BucketSizes.Month && period === 'MONTHLY') ||
    (value === BucketSizes.Week && period === 'WEEKLY')
  ) {
    return ''
  }
  return value as BucketSize
}

/** The price of a line as the edit form needs it, in the unit it is written in. */
function toLinePricing(wire: SubscriptionLineWire): LinePricing | null {
  const price = wire.price
  if (!price || !BILLING_MODELS.has(price.billingModel ?? '')) return null
  const custom = price.priceUnitType === 'CUSTOM'
  const tiers = (custom ? price.priceUnitTiers : price.tiers) ?? []
  return {
    billingModel: price.billingModel as BillingModel,
    tierMode: price.tierMode === TierMode.Slab ? TierMode.Slab : TierMode.Volume,
    tiers: tiers.map(toTier),
    divideBy:
      typeof price.transformQuantity?.divideBy === 'number'
        ? price.transformQuantity.divideBy
        : null,
    priceUnit: custom ? (price.priceUnit ?? '') : '',
    meterId: wire.meterId || price.meterId || '',
    billingPeriod:
      wire.billingPeriod && wire.billingPeriod in BILLING_PERIOD_LABEL
        ? (wire.billingPeriod as BillingPeriod)
        : null,
    currency: (price.currency || wire.currency || '').toUpperCase(),
    terms: {
      bucketSize: toLineBucket(price.bucketSize, wire.billingPeriod ?? price.billingPeriod),
      commitment: toLineCommitment(wire),
    },
  }
}

export function toSubscriptionLine(wire: SubscriptionLineWire, index = 0): SubscriptionLine {
  const name = wire.displayName || wire.planDisplayName || wire.meterDisplayName || 'Charge'
  return {
    id: wire.id ?? `line_${index}`,
    name,
    kind: wire.priceType === 'USAGE' ? 'usage' : 'fixed',
    quantity: wire.quantity ?? '',
    billingPeriodLabel: BILLING_PERIOD_LABEL[(wire.billingPeriod ?? '') as BillingPeriod] ?? '—',
    amount: moneyOr(wire.price?.amount, wire.price?.currency || wire.currency),
    startDate: realDate(wire.startDate),
    endDate: realDate(wire.endDate),
    source: LINE_SOURCE[wire.entityType ?? ''] ?? 'plan',
    priceId: wire.priceId ?? '',
    amountEditable:
      wire.priceType !== 'USAGE' &&
      wire.price?.billingModel === 'FLAT_FEE' &&
      wire.price?.priceUnitType !== 'CUSTOM',
    pricing: toLinePricing(wire),
    /*
     * The price itself, for the shared charges table.
     *
     * The line's own fields answer the edit form's questions; this answers the
     * table's — model, tiers, cadence, the amount already formatted. Both come
     * from the same embedded record, so neither has to guess at the other's.
     * Null when the API sent no price, which is a line that bills nothing.
     */
    charge: wire.price
      ? toCharge({
          ...wire.price,
          id: wire.priceId ?? wire.price.id,
          /*
           * The line's name, not the price's.
           *
           * A price on a plan is often unnamed — what a contract calls the
           * charge comes from `plan_display_name` or the meter, both of which
           * are on the line and neither of which is on the price. Reusing the
           * name the line already worked out keeps one answer to "what is this
           * charge called" instead of two that disagree.
           */
          displayName: name,
        })
      : null,
    /*
     * `parent_price_id` is set when a subscription overrides a plan price, so
     * its presence *is* the "Price changed" flag. What it was changed *from*
     * needs the parent price fetched, which the page does not do yet — so the
     * flag can say that it changed and the sheet cannot yet say from what.
     */
    overridesPriceId: wire.price?.parentPriceId ?? '',
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
  [SubscriptionSortField.UpdatedAt]: 'updated_at',
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
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    expand: 'customer,plan',
    ...((query.filters?.length ?? 0) > 0
      ? { filters: toFilterConditions(query.filters ?? [], SUBSCRIPTION_FILTERS) }
      : {}),
  }
}

export interface SubscriptionPage {
  subscriptions: Subscription[]
  total: number
}

export async function fetchSubscriptions(
  client: Flexprice,
  query: SubscriptionQuery,
  signal?: AbortSignal,
): Promise<SubscriptionPage> {
  const response = await call(
    (options) =>
      client.subscriptions.querySubscription(toSubscriptionFilter(query) as never, options),
    signal,
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
    queryFn: ({ signal }) => fetchSubscriptions(client, query, signal),
    placeholderData: (previous) => previous,
  })
}

/** Pages read per count query: 500 contracts each, so 5 000 before giving up. */
const COUNT_PAGE = 500
const COUNT_PAGES = 10

/**
 * How many contracts each of these customers has — for the Contracts column on
 * the customer list, whose search endpoint carries no subscription count.
 *
 * One `POST /subscriptions/search` narrowed by `customer_ids`, paged until the
 * total is read, then counted per customer. A customer with none is a 0, not a
 * missing value. If the set is larger than the page cap the query fails rather
 * than returning an undercount, and the column shows an em dash.
 */
export function useCustomerContractCounts(customerIds: readonly string[]) {
  const client = useFlexprice()
  const ids = [...new Set(customerIds)].sort()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ countFor: ids }),
    queryFn: async ({ signal }) => {
      const counts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]))
      for (let page = 0; page < COUNT_PAGES; page += 1) {
        const response = await call(
          (options) =>
            client.subscriptions.querySubscription(
              { customerIds: ids, limit: COUNT_PAGE, offset: page * COUNT_PAGE } as never,
              options,
            ),
          signal,
        )
        const items = (response.items ?? []) as SubscriptionWire[]
        for (const item of items) {
          if (item.customerId && item.customerId in counts) counts[item.customerId]! += 1
        }
        const total = response.pagination?.total ?? 0
        if (items.length < COUNT_PAGE || (page + 1) * COUNT_PAGE >= total) return counts
      }
      throw new Error('Too many contracts to count')
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
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
/** A `YYYY-MM-DD` day as midnight UTC. */
const utcDay = (day: string) => new Date(`${day}T00:00:00Z`)

/**
 * A phase's charge overrides as `override_line_items`: each repricing, with
 * the charge's quantity folded in when one was set, and a quantity on its own
 * for a charge only re-counted (the API takes a `price_id` and `quantity`).
 */
function overrideLines(phase: SubscriptionPhase): Record<string, unknown>[] {
  const quantity = new Map(phase.quantities.map((q) => [q.priceId, q.quantity]))
  const repriced = phase.priceOverrides.map((override) => ({
    ...toOverrideLineItem(override),
    ...(quantity.has(override.priceId) ? { quantity: quantity.get(override.priceId) } : {}),
  }))
  const priced = new Set(phase.priceOverrides.map((o) => o.priceId))
  const counted = phase.quantities
    .filter((q) => !priced.has(q.priceId))
    .map((q) => ({ priceId: q.priceId, quantity: q.quantity }))
  return [...repriced, ...counted]
}

/** A phase's discounts as the API's two coupon fields: whole-phase ids, and ids per charge. */
function couponFields(phase: SubscriptionPhase): Record<string, unknown> {
  const whole = phase.discounts.filter((d) => !d.priceId).map((d) => d.couponId)
  const perCharge: Record<string, string[]> = {}
  for (const discount of phase.discounts) {
    if (!discount.priceId) continue
    perCharge[discount.priceId] = [...(perCharge[discount.priceId] ?? []), discount.couponId]
  }
  return {
    ...(whole.length > 0 ? { coupons: whole } : {}),
    ...(Object.keys(perCharge).length > 0 ? { lineItemCoupons: perCharge } : {}),
  }
}

/**
 * `POST /subscriptions`, as V1 builds it.
 *
 * One phase is the plain contract: its overrides, discounts and per-charge
 * commitments go at the top level. Several phases are sent as `phases`, each
 * starting where the one before ends; the first phase's overrides and
 * discounts are repeated at the top level (the API attaches the plan's charges
 * from them), the contract ends where the last phase does, and per-charge
 * commitments are not sent — the API takes them on the contract, not a phase.
 */
export function toCreateSubscriptionRequest(draft: CreateSubscription): Record<string, unknown> {
  const [first] = draft.phases
  const last = draft.phases[draft.phases.length - 1]
  const phased = draft.phases.length > 1
  const starts = phaseStarts(draft)
  const contractStart = draft.startDate ? utcDay(draft.startDate) : undefined

  return {
    customerId: draft.customerId,
    planId: draft.planId,
    currency: draft.currency.toLowerCase(),
    billingPeriod: draft.billingPeriod,
    billingPeriodCount: draft.billingPeriodCount,
    ...(contractStart ? { startDate: contractStart } : {}),
    ...(last?.endDate ? { endDate: utcDay(last.endDate) } : {}),
    ...(draft.trialPeriodDays ? { trialPeriodDays: draft.trialPeriodDays } : {}),
    ...(draft.includePriceIds ? { includePriceIds: draft.includePriceIds } : {}),
    ...(first && overrideLines(first).length > 0
      ? { overrideLineItems: overrideLines(first) }
      : {}),
    ...(first ? couponFields(first) : {}),
    // Charges for this contract alone: on the contract when it has one phase,
    // on each phase otherwise (the API starts them with their phase).
    ...(!phased && first && first.extraCharges.length > 0
      ? { lineItems: first.extraCharges.map(toCreateLineItemRequest) }
      : {}),
    ...(phased
      ? {
          phases: draft.phases.map((phase, index) => ({
            // The first phase starts with the contract, which is "now" when no date was set.
            startDate: starts[index] ? utcDay(starts[index]) : (contractStart ?? new Date()),
            ...(phase.endDate ? { endDate: utcDay(phase.endDate) } : {}),
            ...(overrideLines(phase).length > 0 ? { overrideLineItems: overrideLines(phase) } : {}),
            ...couponFields(phase),
            ...(phase.extraCharges.length > 0
              ? { lineItems: phase.extraCharges.map(toCreateLineItemRequest) }
              : {}),
          })),
        }
      : draft.chargeCommitments.length > 0
        ? {
            lineItemCommitments: Object.fromEntries(
              draft.chargeCommitments.map((commitment) => [
                commitment.priceId,
                {
                  commitmentType: commitment.type,
                  ...(commitment.type === 'amount'
                    ? { commitmentAmount: Number(commitment.value) }
                    : { commitmentQuantity: Number(commitment.value) }),
                  ...(commitment.overageFactor
                    ? { overageFactor: Number(commitment.overageFactor) }
                    : {}),
                  enableTrueUp: commitment.trueUp,
                },
              ]),
            ),
          }
        : {}),
    ...(draft.commitmentAmount
      ? {
          commitmentAmount: draft.commitmentAmount,
          ...(draft.commitmentDuration ? { commitmentDuration: draft.commitmentDuration } : {}),
          ...(draft.overageFactor ? { overageFactor: draft.overageFactor } : {}),
          enableTrueUp: draft.enableTrueUp,
        }
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
    // The API uses this list *instead of* the plan's grants, so it is sent only
    // when the grants were changed — an empty list then removes them all.
    ...(draft.creditGrantsChanged
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
    ...(draft.taxes.length > 0
      ? {
          taxRateOverrides: draft.taxes.map((tax) => ({
            taxRateCode: tax.taxRateCode,
            currency: draft.currency.toLowerCase(),
            taxBehavior: tax.taxBehavior,
            priority: tax.priority,
            autoApply: tax.autoApply,
          })),
        }
      : {}),
    ...(draft.addons.length > 0
      ? { addons: draft.addons.map((addon) => ({ addonId: addon.addonId })) }
      : {}),
    billingCycle: draft.billingCycle,
    ...(draft.billingAnchor ? { billingAnchor: utcDay(draft.billingAnchor) } : {}),
    ...(draft.paymentTerms ? { paymentTerms: draft.paymentTerms } : {}),
    prorationBehavior: draft.prorate ? 'create_prorations' : 'none',
    ...(draft.autoInvoiceThreshold ? { autoInvoiceThreshold: draft.autoInvoiceThreshold } : {}),
    ...(draft.draft ? { subscriptionStatus: 'draft' } : {}),
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
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.subscriptions.querySubscription(
            {
              subscriptionIds: [id],
              expand: 'customer,plan',
              limit: 1,
              offset: 0,
            } as never,
            options,
          ),
        signal,
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
    queryFn: ({ signal }) =>
      call((options) => client.subscriptions.getSubscription(id, options), signal),
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
    ...(draft.cancellationType === 'scheduled_date' && draft.cancelAt
      ? { cancelAt: new Date(`${draft.cancelAt}T00:00:00Z`) }
      : {}),
    ...(draft.prorate !== undefined
      ? { prorationBehavior: draft.prorate ? 'create_prorations' : 'none' }
      : {}),
    ...(draft.cancellationType === 'immediate' && draft.generateInvoice !== undefined
      ? { cancelImmediatelyInvoicePolicy: draft.generateInvoice ? 'generate_invoice' : 'skip' }
      : {}),
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

/**
 * Replace a subscription's metadata — `PUT /subscriptions/{id}` with
 * `{metadata}`, sent around the SDK because its request model strips the field.
 * Rejects when the API answers without having stored it; see `@fp/api`.
 */
export function useUpdateSubscriptionMetadata(environmentId: string | null) {
  const serverURL = useFlexpriceServerURL()
  const auth = useFlexpriceAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, metadata }: { id: string; metadata: Record<string, string> }) => {
      if (!environmentId) {
        throw new ApiError(ErrorKind.Forbidden, 'Choose an environment first.')
      }
      const token = await auth.getToken()
      if (!token) throw new ApiError(ErrorKind.Unauthorized, 'Sign in to save metadata.')
      return updateSubscriptionMetadata(serverURL, token, environmentId, id, metadata)
    },
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** A date input's `YYYY-MM-DD` as the instant the API takes; empty means "now" and is left out. */
const effectiveFrom = (day: string) => (day ? `${day}T00:00:00Z` : undefined)

/** Commitment fields shared by the add and edit requests; the API takes the numbers as numbers. */
function commitmentFields(terms: UsageTerms): Record<string, unknown> {
  const commitment = terms.commitment
  if (!commitment) return {}
  return {
    commitmentType: commitment.kind,
    ...(commitment.kind === CommitmentKind.Quantity
      ? { commitmentQuantity: Number(commitment.value) }
      : { commitmentAmount: Number(commitment.value) }),
    commitmentWindowed: commitment.windowed,
    commitmentOverageFactor: Number(commitment.overageFactor),
    commitmentTrueUpEnabled: commitment.trueUp,
  }
}

/**
 * A new charge on one contract, priced inline — `POST /subscriptions/{id}/lineitems`.
 *
 * The price is the same request the plan page sends, minus what the contract
 * decides (its currency and the entity it prices). A metered charge carries no
 * quantity, and a fixed one no bucket or commitment.
 */
export function toCreateLineItemRequest(draft: AddContractCharge): Record<string, unknown> {
  const { charge } = draft
  const usage = charge.type === PriceType.Usage
  const {
    entityType: _entityType,
    entityId: _entityId,
    currency: _currency,
    ...price
  } = toChargeRequest(charge, 'PLAN', '')
  return {
    ...(charge.displayName ? { displayName: charge.displayName } : {}),
    ...(usage ? {} : { quantity: Number(draft.quantity) || 1 }),
    ...(draft.startDate ? { startDate: new Date(`${draft.startDate}T00:00:00Z`) } : {}),
    ...(usage ? {} : { prorationBehavior: draft.proration }),
    price: {
      ...price,
      ...(usage && draft.terms.bucketSize ? { bucketSize: draft.terms.bucketSize } : {}),
    },
    ...(usage ? commitmentFields(draft.terms) : {}),
  }
}

/** A metered charge's new price and terms — `PUT /subscriptions/lineitems/{lineItemId}`. */
export function toUpdateLineItemRequest(draft: EditContractCharge): Record<string, unknown> {
  const { price } = draft
  const custom = draft.priceUnit !== ''
  const from = effectiveFrom(draft.effectiveFrom)
  const tiersOf = (tiers: Tier[]) =>
    tiers.map((tier) => ({
      upTo: tier.upTo,
      unitAmount: tier.unitAmount,
      flatAmount: tier.flatAmount ?? '0',
    }))
  const amountField = (amount: string) => (custom ? { priceUnitAmount: amount } : { amount })

  let priced: Record<string, unknown>
  switch (price.billingModel) {
    case BillingModel.FlatFee:
      priced = amountField(price.amount)
      break
    case BillingModel.Package:
      priced = { ...amountField(price.amount), transformQuantity: { divideBy: price.divideBy } }
      break
    case BillingModel.Tiered:
      priced = {
        tierMode: price.tierMode,
        ...(custom ? { priceUnitTiers: tiersOf(price.tiers) } : { tiers: tiersOf(price.tiers) }),
      }
      break
  }
  return {
    billingModel: price.billingModel,
    ...priced,
    ...(draft.terms.bucketSize ? { bucketSize: draft.terms.bucketSize } : {}),
    ...commitmentFields(draft.terms),
    ...(from ? { effectiveFrom: from } : {}),
  }
}

export function toDeleteLineItemRequest(draft: EndContractCharge): Record<string, unknown> {
  const from = effectiveFrom(draft.effectiveFrom)
  return from ? { effectiveFrom: from } : {}
}

/**
 * The `line_item_change` modify request for one charge. Only what changed is
 * sent: the API rejects a request that changes nothing, and a repriced line
 * starts a new price, so an untouched price must not be resent.
 */
export function toLineItemChangeRequest(
  line: Pick<SubscriptionLine, 'id' | 'quantity' | 'amount' | 'amountEditable'>,
  draft: ChangeLineQuantity,
): Record<string, unknown> {
  const quantity = draft.quantity.trim()
  const amount = draft.amount.trim()
  // The SDK serialises this field from a Date, unlike the line-item PUT/DELETE, which take a string.
  const from = draft.effectiveDate ? new Date(`${draft.effectiveDate}T00:00:00Z`) : undefined
  return {
    type: 'line_item_change',
    lineItemChangeParams: {
      lineItems: [
        {
          id: line.id,
          ...(quantity !== '' && Number(quantity) !== Number(line.quantity) ? { quantity } : {}),
          ...(line.amountEditable && amount !== '' && Number(amount) !== Number(line.amount.amount)
            ? { amount }
            : {}),
          ...(from ? { effectiveDate: from } : {}),
        },
      ],
    },
  }
}

interface ModifyResponseWire {
  changedResources?:
    | {
        lineItems?:
          | {
              id?: string | undefined
              changeAction?: string | undefined
              quantity?: string | undefined
              startDate?: Date | undefined
              endDate?: Date | undefined
            }[]
          | undefined
        invoices?:
          | {
              action?: string | undefined
              status?: string | undefined
              invoice?:
                { amountDue?: string | undefined; currency?: string | undefined } | undefined
            }[]
          | undefined
      }
    | undefined
}

export function toLineChangePreview(wire: ModifyResponseWire): LineChangePreview {
  const changed = wire.changedResources
  return {
    lines: (changed?.lineItems ?? []).map((item) => ({
      id: item.id ?? '',
      action: item.changeAction ?? '',
      quantity: item.quantity ?? '',
      startDate: realDate(item.startDate),
      endDate: realDate(item.endDate),
    })),
    invoices: (changed?.invoices ?? []).map((item) => ({
      action: item.action ?? '',
      status: item.status ?? '',
      amountDue: item.invoice?.amountDue
        ? moneyOr(item.invoice.amountDue, item.invoice.currency)
        : null,
    })),
  }
}

/** Preview a quantity or price change — `POST /subscriptions/{id}/modify/preview`. Saves nothing. */
export function usePreviewLineChange() {
  const client = useFlexprice()
  return useMutation({
    mutationFn: ({
      subscriptionId,
      line,
      draft,
    }: {
      subscriptionId: string
      line: SubscriptionLine
      draft: ChangeLineQuantity
    }) =>
      call(() =>
        client.subscriptions.previewSubscriptionModify(
          subscriptionId,
          toLineItemChangeRequest(line, draft) as never,
        ),
      ).then((response) => toLineChangePreview(response as ModifyResponseWire)),
  })
}

/** Apply a quantity or price change — `POST /subscriptions/{id}/modify/execute`. */
export function useExecuteLineChange() {
  const client = useFlexprice()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      subscriptionId,
      line,
      draft,
    }: {
      subscriptionId: string
      line: SubscriptionLine
      draft: ChangeLineQuantity
    }) =>
      call(() =>
        client.subscriptions.executeSubscriptionModify(
          subscriptionId,
          toLineItemChangeRequest(line, draft) as never,
        ),
      ),
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** Add a charge to one contract — only this contract changes. */
export function useCreateSubscriptionLineItem() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: AddContractCharge }) =>
      call(() =>
        client.subscriptions.createSubscriptionLineItem(
          id,
          toCreateLineItemRequest(draft) as never,
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

/** The wire fields of an invoice preview beyond what `toInvoiceDetail` reads. */
interface InvoicePreviewWire extends InvoiceDetailWire {
  totalDiscount?: string | undefined
  periodStart?: Date | undefined
  periodEnd?: Date | undefined
}

export function toInvoicePreview(wire: InvoicePreviewWire): InvoicePreview {
  const detail = toInvoiceDetail(wire)
  const currency = detail.currency
  const amount = (value: string | undefined) => money(value ?? '0', currency)
  return {
    periodStart: wire.periodStart ?? null,
    periodEnd: wire.periodEnd ?? null,
    lines: detail.lines.map((line) => ({
      id: line.id,
      name: line.description,
      detail: line.detail,
      quantity: line.quantity,
      amount: money(line.amount, currency),
      kind: line.priceType,
    })),
    subtotal: money(detail.subtotal, currency),
    discount: amount(wire.totalDiscount),
    tax: money(detail.tax, currency),
    prepaidCredits: money(detail.prepaidCredits, currency),
    amountDue: detail.amountDue,
  }
}

/**
 * The invoice this contract will raise at the end of the period —
 * `POST /invoices/preview`. Nothing is created; the API computes the lines and
 * the totals. Callers disable it for contracts that are not billing (cancelled
 * or still on trial), where the call has nothing to preview.
 */
export function useSubscriptionInvoicePreview(
  id: string,
  options: { hideZeroCharges: boolean; enabled?: boolean },
) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.preview(id, options.hideZeroCharges),
    queryFn: async ({ signal }) =>
      toInvoicePreview(
        (await call(
          (requestOptions) =>
            client.invoices.getInvoicePreview(
              { subscriptionId: id, hideZeroChargesLineItems: options.hideZeroCharges },
              requestOptions,
            ),
          signal,
        )) as InvoicePreviewWire,
      ),
    enabled: (options.enabled ?? true) && id.length > 0,
    retry: false,
  })
}

interface AddonAssociationWire {
  id?: string | undefined
  addonId?: string | undefined
  addonStatus?: string | undefined
  startDate?: Date | undefined
  endDate?: Date | undefined
  addon?: { name?: string | undefined } | undefined
}

export function toSubscriptionAddon(wire: AddonAssociationWire): SubscriptionAddon {
  return {
    id: wire.id ?? wire.addonId ?? '',
    name: wire.addon?.name || wire.addonId || 'Add-on',
    active: (wire.addonStatus ?? 'active').toLowerCase() === 'active',
    startDate: realDate(wire.startDate),
    endDate: realDate(wire.endDate),
  }
}

/** The add-ons attached to this contract — `GET /subscriptions/{id}/addons/associations`. */
export function useSubscriptionAddons(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.addons(id),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) => client.subscriptions.getSubscriptionAddonAssociations(id, options),
        signal,
      )
      return ((response.items ?? []) as AddonAssociationWire[]).map(toSubscriptionAddon)
    },
    enabled: id.length > 0,
  })
}

interface SubscriptionCouponWire {
  subscriptionLineItemId?: string | undefined
  status?: string | undefined
  id?: string | undefined
  couponId?: string | undefined
  startDate?: Date | undefined
  endDate?: Date | undefined
  coupon?:
    | {
        name?: string | undefined
        couponCode?: string | undefined
        type?: string | undefined
        amountOff?: string | undefined
        percentageOff?: string | undefined
        currency?: string | undefined
      }
    | undefined
}

export function toSubscriptionCoupon(
  wire: SubscriptionCouponWire,
  now = new Date(),
): SubscriptionCoupon {
  const coupon = wire.coupon
  const percentage = coupon?.type === CouponType.Percentage
  const off = percentage || !coupon?.amountOff ? null : moneyOr(coupon.amountOff, coupon.currency)
  const endDate = realDate(wire.endDate)
  return {
    id: wire.id ?? wire.couponId ?? '',
    lineItemId: wire.subscriptionLineItemId,
    name: coupon?.name || wire.couponId || 'Coupon',
    code: coupon?.couponCode ?? '',
    discount: percentage
      ? `${coupon?.percentageOff ?? '0'}% off`
      : off
        ? `${formatMoney(off)} off`
        : '',
    active:
      wire.status !== 'archived' &&
      (!realDate(wire.startDate) || realDate(wire.startDate)! <= now) &&
      (endDate === null || endDate > now),
    startDate: realDate(wire.startDate),
    endDate,
  }
}

/** The coupons applied to this contract — `GET /coupons/associations` filtered by subscription. */
export function useSubscriptionCoupons(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.coupons(id),
    queryFn: async ({ signal }) => {
      const coupons: SubscriptionCoupon[] = []
      for (let offset = 0; ; offset += 100) {
        const response = await call(
          (options) =>
            client.couponAssociations.listCouponAssociations(
              { subscriptionIds: [id], expand: 'coupon', limit: 100, offset },
              options,
            ),
          signal,
        )
        const items = response.items ?? []
        coupons.push(...items.map((item) => toSubscriptionCoupon(item)))
        if (items.length < 100 || offset + items.length >= (response.pagination?.total ?? Infinity))
          break
      }
      return coupons
    },
    enabled: id.length > 0,
  })
}

interface SubscriptionTaxWire {
  id?: string | undefined
  taxRateId?: string | undefined
  taxBehavior?: string | undefined
  priority?: number | undefined
  taxRate?:
    | { name?: string | undefined; code?: string | undefined; percentageValue?: string | undefined }
    | undefined
}

export function toSubscriptionTax(wire: SubscriptionTaxWire): SubscriptionTax {
  return {
    id: wire.id ?? wire.taxRateId ?? '',
    name: wire.taxRate?.name || wire.taxRateId || 'Tax rate',
    code: wire.taxRate?.code ?? '',
    percentage: wire.taxRate?.percentageValue ?? '',
    inclusive: wire.taxBehavior === TaxBehavior.Inclusive,
    priority: wire.priority ?? 0,
  }
}

/** The tax rates applied to this contract — `GET /taxes/associations` for the subscription. */
export function useSubscriptionTaxes(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.taxes(id),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.taxAssociations.listTaxAssociations(
            'subscription',
            id,
            undefined,
            undefined,
            options,
          ),
        signal,
      )
      return ((response.items ?? []) as SubscriptionTaxWire[]).map(toSubscriptionTax)
    },
    enabled: id.length > 0,
  })
}

/**
 * What adding something to one contract can change on its page: the detail, its
 * entitlements, grants, add-ons, coupons, taxes and the invoice preview all sit
 * under the subscriptions family. Tax associations are shared with the customer
 * page, so they refresh too.
 */
const invalidateContract = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.taxAssociations.all() })
}

/** Give this contract an entitlement its plan does not carry — `POST /entitlements`. */
export function useCreateSubscriptionEntitlement(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateEntitlement) =>
      call(() =>
        client.entitlements.createEntitlement(
          toEntitlementRequest(
            draft,
            EntitlementEntityType.Subscription,
            subscriptionId,
          ) as FlexpriceModels.CreateEntitlementRequest,
        ),
      ),
    onSuccess: () => invalidateContract(queryClient),
  })
}

/** Grant this contract credits of its own — `POST /creditgrants`, scoped to the subscription. */
export function useCreateSubscriptionCreditGrant(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateCreditGrant) =>
      call(() =>
        client.creditGrants.createCreditGrant(
          toCreditGrantRequest(
            draft,
            CreditGrantScope.Subscription,
            subscriptionId,
          ) as FlexpriceModels.CreateCreditGrantRequest,
        ),
      ),
    onSuccess: () => {
      invalidateContract(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.creditGrants.all() })
    },
  })
}

export function toAddAddonRequest(
  subscriptionId: string,
  draft: AddContractAddon,
): FlexpriceModels.AddAddonRequest {
  return { subscriptionId, addonId: draft.addonId }
}

/** A coupon applied to one contract, or to one of its charges, as a `coupon` modification. */
export function toAddCouponRequest(
  subscriptionId: string,
  draft: AddContractCoupon,
): FlexpriceModels.ExecuteSubscriptionModifyRequest {
  const couponCode = draft.couponCode.trim()
  return {
    type: 'coupon',
    couponParams: draft.lineItemId
      ? { action: 'add', couponCode, subscriptionLineItemId: draft.lineItemId }
      : { action: 'add', couponCode, subscriptionId },
  }
}

/** Take one coupon association off — `action: remove` on the same modify call. */
export function toRemoveCouponRequest(
  associationId: string,
): FlexpriceModels.ExecuteSubscriptionModifyRequest {
  return {
    type: 'coupon',
    couponParams: { action: 'remove', couponAssociationId: associationId },
  }
}

/** Attach an add-on to this contract — `POST /subscriptions/addon`. */
export function useAddSubscriptionAddon(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: AddContractAddon) =>
      call(() =>
        client.subscriptions.addSubscriptionAddon(toAddAddonRequest(subscriptionId, draft)),
      ),
    onSuccess: () => invalidateContract(queryClient),
  })
}

/**
 * Apply a coupon to this contract by its code —
 * `POST /subscriptions/{id}/modify/execute` with a `coupon` modification.
 */
export function useAddSubscriptionCoupon(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draft: AddContractCoupon) => {
      const added = await call(() =>
        client.subscriptions.executeSubscriptionModify(
          subscriptionId,
          toAddCouponRequest(subscriptionId, draft),
        ),
      )
      for (const associationId of draft.replaceAssociationIds ?? []) {
        await call(() =>
          client.subscriptions.executeSubscriptionModify(
            subscriptionId,
            toRemoveCouponRequest(associationId),
          ),
        )
      }
      return added
    },
    onSuccess: () => invalidateContract(queryClient),
  })
}

/** Apply a tax rate to this contract — `POST /taxes/associations`, entity type `subscription`. */
export function useCreateSubscriptionTax(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateTaxAssociation) =>
      call(() =>
        client.taxAssociations.createTaxAssociation(
          toCreateTaxAssociationRequest(
            subscriptionId,
            draft,
            'subscription',
          ) as FlexpriceModels.CreateTaxAssociationRequest,
        ),
      ),
    onSuccess: () => invalidateContract(queryClient),
  })
}

/** Take an add-on off a contract — `DELETE /subscriptions/addon` by its association id, at period end. */
export function useRemoveSubscriptionAddon() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (associationId: string) =>
      call(() =>
        client.subscriptions.removeSubscriptionAddon({ addonAssociationId: associationId }),
      ),
    onSuccess: () => invalidateContract(queryClient),
  })
}

/** Stop applying a tax rate to a contract — `DELETE /taxes/associations/{id}`. */
export function useRemoveSubscriptionTax() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (associationId: string) =>
      call(() => client.taxAssociations.deleteTaxAssociation(associationId)),
    onSuccess: () => invalidateContract(queryClient),
  })
}

/** End a contract's credit grant now — `DELETE /creditgrants/{id}` with today as the end date. */
export function useCancelSubscriptionCreditGrant() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (grantId: string) =>
      call(() => client.creditGrants.deleteCreditGrant(grantId, { effectiveDate: new Date() })),
    onSuccess: () => invalidateContract(queryClient),
  })
}
