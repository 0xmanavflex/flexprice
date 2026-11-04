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
  allowancePeriod,
  BILLING_PERIOD_LABEL,
  BillingModel,
  BillingPeriod,
  BucketSize as BucketSizes,
  type BucketSize,
  CommitmentKind,
  FilterOp,
  type Charge,
  type CancelSubscription,
  type PauseSubscription,
  type ResumeSubscription,
  type ChargeCommitment,
  type PriceOverride,
  CommitmentType,
  type CommitmentPriceBase,
  type CommitmentWindow,
  type CreateSubscription,
  WindowBillingModel,
  type SubscriptionPhase,
  phaseStarts,
  contractDateToInstant,
  type ChangeLineQuantity,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreateTaxAssociation,
  type CreditGrant,
  CreditGrantCadence,
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
  type ContractCommitment,
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
  perUnit,
  moneyOr,
  SUBSCRIPTION_FILTERS,
  INHERITANCE_WITH_BILLING_CUSTOMER,
  INHERITANCE_WITH_THRESHOLD,
  InheritanceBlock,
} from '@fp/domain'
import {
  type CreditGrantWire,
  toCreditGrant,
  toCreditGrantRequest,
  toCreditGrantTerms,
} from './creditGrants'
import { toEntitlementRequest } from './entitlements'
import { type InvoiceDetailWire, type InvoiceWire, toInvoice, toInvoiceDetail } from './invoices'
import { ALL_SUBSCRIPTION_STATUSES, LIVE_SUBSCRIPTION_STATUSES } from './subscriptionStatuses'
import { queryKeys } from './keys'
import { nameContainsFilter, toFilterConditions } from './search'
import {
  type ChargeWire,
  type TierWire,
  tierPackageFields,
  toCharge,
  toChargeRequest,
  toTier,
} from './prices'
import {
  toCreateTaxAssociationRequest,
  useRemoveTaxAssociationRequest,
  withTaxRates,
} from './taxAssociations'
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
  customer?:
    | { name?: string | undefined; email?: string | undefined; externalId?: string | undefined }
    | undefined
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
  commitmentDuration?: string | undefined
  overageFactor?: string | undefined
  enableTrueUp?: boolean | undefined
  /** Set on a contract inherited from, or grouped under, another contract. */
  parentSubscriptionId?: string | undefined
  subscriptionType?: string | undefined
  invoicingCustomerId?: string | undefined
  latestInvoice?: { id?: string | undefined; invoiceNumber?: string | undefined } | undefined
}

const SUBSCRIPTION_STATUSES = new Set<string>(Object.values(SubscriptionStatus))

/** The API serialises an unset Go time as `0001-01-01T00:00:00Z`; that means "no date", not "ended long ago". */
function realDate(value: Date | undefined | null): Date | null {
  return value && value.getUTCFullYear() > 1 ? value : null
}

/** The contract's customer as a person reads it: name, then email, then their own id. */
function customerNameOf(wire: SubscriptionWire): string {
  return wire.customer?.name || wire.customer?.email || wire.customer?.externalId || ''
}

/**
 * Fills in the customer of each contract the search returned without one.
 *
 * `expand: 'customer'` resolves every row's customer in one lookup, and a row
 * whose customer that lookup missed comes back with no `customer` at all: the
 * row then showed a raw `cust_…` id among names. The rows that need it get
 * their customers in one `POST /customers/search` by id; anything that still
 * cannot be named keeps the id, so no row is ever blank.
 */
export async function withCustomerNames(
  client: Flexprice,
  wires: readonly SubscriptionWire[],
  signal?: AbortSignal,
): Promise<SubscriptionWire[]> {
  const missing = [
    ...new Set(
      wires
        .filter((wire) => wire.customerId && !customerNameOf(wire))
        .map((wire) => wire.customerId as string),
    ),
  ]
  if (missing.length === 0) return [...wires]
  let found: Map<string, NonNullable<SubscriptionWire['customer']>>
  try {
    const response = await call(
      (options) =>
        client.customers.queryCustomer(
          { customerIds: missing, limit: missing.length, offset: 0 },
          options,
        ),
      signal,
    )
    found = new Map(
      (response.items ?? []).flatMap((item) =>
        item.id
          ? [
              [
                item.id,
                {
                  name: item.name,
                  email: item.email,
                  externalId: item.externalId,
                },
              ] as const,
            ]
          : [],
      ),
    )
  } catch {
    // The names are a nicety: the list still loads, with the ids it had.
    return [...wires]
  }
  return wires.map((wire) => {
    const customer = wire.customerId ? found.get(wire.customerId) : undefined
    return customer && !customerNameOf(wire) ? { ...wire, customer } : wire
  })
}

export function toSubscription(wire: SubscriptionWire): Subscription {
  // Known statuses pass through, `draft` included; any value this build has not
  // learned collapses to Incomplete, the state a subscription sits in before
  // it is running.
  const status = SUBSCRIPTION_STATUSES.has(wire.subscriptionStatus ?? '')
    ? (wire.subscriptionStatus as SubscriptionStatus)
    : SubscriptionStatus.Incomplete

  return {
    id: wire.id ?? '',
    customerId: wire.customerId ?? '',
    // Resolved here so no cell has to fall back, and no grid joins data.
    customerName: customerNameOf(wire) || wire.customerId || 'Unknown',
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

/**
 * The contract-level commitment, or null when there is none. The API measures
 * it over the billing period (every N of them) unless `commitmentDuration`
 * names a different period, in which case it is one of that period.
 */
function toContractCommitment(wire: SubscriptionWire): ContractCommitment | null {
  if (!wire.commitmentAmount || !(Number(wire.commitmentAmount) > 0)) return null
  const billingPeriod = wire.billingPeriod as BillingPeriod | undefined
  const duration =
    wire.commitmentDuration && wire.commitmentDuration in BILLING_PERIOD_LABEL
      ? (wire.commitmentDuration as BillingPeriod)
      : null
  const ownPeriod = duration !== null && duration !== billingPeriod
  const overageFactor = Number(wire.overageFactor)
  return {
    amount: moneyOr(wire.commitmentAmount, wire.currency),
    period: ownPeriod ? duration : (billingPeriod ?? BillingPeriod.Monthly),
    periodCount: ownPeriod ? 1 : (wire.billingPeriodCount ?? 1),
    overageFactor: Number.isFinite(overageFactor) && overageFactor >= 1 ? overageFactor : 1,
    trueUp: wire.enableTrueUp ?? false,
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
    commitment: toContractCommitment(wire),
    latestInvoice: wire.latestInvoice?.id
      ? {
          id: wire.latestInvoice.id,
          number: wire.latestInvoice.invoiceNumber?.trim() || '',
        }
      : null,
    subscriptionType: (wire.subscriptionType ?? '').toLowerCase(),
    parentSubscriptionId: wire.parentSubscriptionId || null,
    invoicingCustomerId:
      wire.invoicingCustomerId && wire.invoicingCustomerId !== wire.customerId
        ? wire.invoicingCustomerId
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
  predecessorLineItemId?: string | undefined
  successorLineItemId?: string | undefined
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
 * charge whose price reports MONTH reads as "Whole billing period": the form
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
    ...(custom && price.priceUnitAmount ? { priceUnitAmount: price.priceUnitAmount } : {}),
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

/**
 * A contract charge is in effect for as long as its line is, not its price.
 *
 * The embedded price carries the plan price's own window: a plan price that
 * was replaced on the plan has an end date even while this contract's line
 * still bills it. Read off the price, that end date made a live charge look
 * ended, so it was left out of the charge count and could not be edited. The
 * line's dates are the contract's answer, so the charge takes them.
 */
function lineDated(wire: SubscriptionLineWire, charge: Charge): Charge {
  return {
    ...charge,
    startDate: realDate(wire.startDate) ?? charge.startDate,
    endDate: realDate(wire.endDate),
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
     * table's: model, tiers, cadence, the amount already formatted. Both come
     * from the same embedded record, so neither has to guess at the other's.
     * Null when the API sent no price, which is a line that bills nothing.
     */
    charge: wire.price
      ? lineDated(
          wire,
          toCharge({
            ...wire.price,
            id: wire.priceId ?? wire.price.id,
            /*
             * The line's name, not the price's.
             *
             * A price on a plan is often unnamed: what a contract calls the
             * charge comes from `plan_display_name` or the meter, both of which
             * are on the line and neither of which is on the price. Reusing the
             * name the line already worked out keeps one answer to "what is this
             * charge called" instead of two that disagree.
             */
            displayName: name,
          }),
        )
      : null,
    /*
     * `parent_price_id` is set when a subscription overrides a plan price, so
     * its presence *is* the "Price changed" flag. What it was changed *from*
     * needs the parent price fetched, which the page does not do yet: so the
     * flag can say that it changed and the sheet cannot yet say from what.
     */
    overridesPriceId: wire.price?.parentPriceId ?? '',
    ...(wire.predecessorLineItemId ? { predecessorLineItemId: wire.predecessorLineItemId } : {}),
    ...(wire.successorLineItemId ? { successorLineItemId: wire.successorLineItemId } : {}),
  }
}

export interface SubscriptionFeatureWire {
  feature?:
    { id?: string | undefined; name?: string | undefined; type?: string | undefined } | undefined
  entitlement?:
    | {
        isEnabled?: boolean | undefined
        isSoftLimit?: boolean | undefined
        usageLimit?: number | undefined
        usageResetPeriod?: string | undefined
        grantDurationUnit?: string | undefined
        grantDurationValue?: number | undefined
        staticValues?: string[] | undefined
        configValues?: Array<Record<string, unknown>> | undefined
      }
    | undefined
  sources?:
    | Array<{ staticValue?: string | undefined; configValue?: Record<string, unknown> | undefined }>
    | undefined
}

export function toSubscriptionEntitlement(wire: SubscriptionFeatureWire): SubscriptionEntitlement {
  // The SDK camel-cases a body it accepts. A 200 the schema rejects is still
  // the wire shape (`is_enabled`, `usage_limit`), and that body is what the
  // section has to show.
  const entitlement = wire.entitlement as
    (NonNullable<SubscriptionFeatureWire['entitlement']> & Record<string, unknown>) | undefined
  const period = stringValue(entitlement?.usageResetPeriod ?? entitlement?.usage_reset_period)
  const limit = entitlement?.usageLimit ?? entitlement?.usage_limit
  const duration = entitlement?.grantDurationValue ?? entitlement?.grant_duration_value
  const featureType = stringValue(wire.feature?.type)
  return {
    featureId: wire.feature?.id ?? '',
    name: wire.feature?.name || wire.feature?.id || 'Feature',
    enabled: booleanValue(entitlement?.isEnabled ?? entitlement?.is_enabled),
    usageLimit: typeof limit === 'number' ? limit : null,
    softLimit: booleanValue(entitlement?.isSoftLimit ?? entitlement?.is_soft_limit),
    resetPeriodLabel:
      period && period !== 'NEVER' ? (BILLING_PERIOD_LABEL[period as BillingPeriod] ?? period) : '',
    // The feature's type and value come from the entitlement itself, so a
    // contract with no usage reported (draft, paused) still reads a boolean
    // as on, a static one as its value and a config one as its JSON.
    featureType,
    staticValue:
      featureType === 'config' ? configText(wire, entitlement) : staticText(wire, entitlement),
    period:
      allowancePeriod({
        usageResetPeriod: period,
        grantDurationUnit: stringValue(
          entitlement?.grantDurationUnit ?? entitlement?.grant_duration_unit,
        ),
        grantDurationValue: typeof duration === 'number' ? duration : null,
      }) ?? '',
  }
}

type EntitlementWire = NonNullable<SubscriptionFeatureWire['entitlement']> & Record<string, unknown>

function staticText(wire: SubscriptionFeatureWire, entitlement: EntitlementWire | undefined) {
  const values = entitlement?.staticValues ?? entitlement?.static_values
  const fromEntitlement = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string' && value !== '')
    : []
  if (fromEntitlement.length > 0) return fromEntitlement.join(', ')
  const source = wire.sources?.[0] as Record<string, unknown> | undefined
  return stringValue(source?.['staticValue'] ?? source?.['static_value'])
}

function configText(wire: SubscriptionFeatureWire, entitlement: EntitlementWire | undefined) {
  const source = wire.sources?.[0] as Record<string, unknown> | undefined
  const values = entitlement?.configValues ?? entitlement?.config_values
  const config =
    source?.['configValue'] ??
    source?.['config_value'] ??
    (Array.isArray(values) ? (values[0] as unknown) : undefined)
  return config && typeof config === 'object' && Object.keys(config).length > 0
    ? JSON.stringify(config)
    : ''
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function booleanValue(value: unknown): boolean {
  return value === true
}

/**
 * Entitlements from a request the server accepted and the SDK then rejected.
 *
 * HTTP 200 with a body the generated schema will not parse becomes an
 * `ApiError`, and the contract section renders that as "could not be loaded"
 * even though `features` is sitting in the response. Read that body instead.
 * A real failure (4xx/5xx, or a body with no `features`) stays an error.
 */
export function subscriptionEntitlementsFromRejection(
  error: unknown,
): SubscriptionEntitlement[] | undefined {
  if (!(error instanceof ApiError) || error.cause == null || typeof error.cause !== 'object') {
    return undefined
  }
  const cause = error.cause as { rawValue?: unknown; body?: unknown; statusCode?: unknown }
  const status = typeof cause.statusCode === 'number' ? cause.statusCode : error.status
  if (status !== undefined && (status < 200 || status >= 300)) return undefined
  const body = cause.rawValue ?? parsedBody(cause.body)
  if (!body || typeof body !== 'object' || !('features' in body)) return undefined
  const features = (body as { features: unknown }).features
  if (!Array.isArray(features)) return undefined
  return (features as SubscriptionFeatureWire[]).map(toSubscriptionEntitlement)
}

function parsedBody(body: unknown): unknown {
  if (typeof body !== 'string' || body.trim() === '') return undefined
  try {
    return JSON.parse(body) as unknown
  } catch {
    return undefined
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
 * falls all the way through to `customerId`: the Customer column renders a raw
 * `cust_01M3H…` ULID for every subscription. Verified live: the same request
 * with `expand: 'customer'` resolves the name to "Test".
 *
 * The value is singular. `expand: 'customers'` is accepted and silently does
 * nothing, which is the failure this comment exists to prevent. `plan` is named
 * explicitly rather than relied on as a default.
 */
export function toSubscriptionFilter(
  query: SubscriptionQuery,
  /** The customers the search matched; see {@link fetchSubscriptions}. */
  customerIds?: readonly string[],
): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: sortWithTieBreak(SORT_FIELD[query.sortBy], query.sortDirection),
    expand: 'customer,plan',
    // Status always goes to the server: it returns only active subscriptions
    // when none is named, so a trialing contract never reached the list.
    // No status chosen means every contract.
    subscriptionStatus: query.statuses.length > 0 ? [...query.statuses] : ALL_SUBSCRIPTION_STATUSES,
    ...((query.filters?.length ?? 0) > 0
      ? { filters: toFilterConditions(query.filters ?? [], SUBSCRIPTION_FILTERS) }
      : {}),
    ...(customerIds ? { customerIds: [...customerIds] } : {}),
  }
}

/** One page of a name search, while collecting every customer or plan it matches. */
const SEARCH_PAGE = 200
/** Contracts read per page when a search matches both customers and plans. */
const SEARCH_CONTRACT_PAGE = 500

export interface SubscriptionPage {
  subscriptions: Subscription[]
  total: number
}

/** Every id a paged name search returns, page by page until the total is reached. */
async function allMatchingIds(
  page: (offset: number) => Promise<{
    items?: Array<{ id?: string | undefined }> | undefined
    pagination?: { total?: number | undefined } | undefined
  }>,
): Promise<string[]> {
  const ids: string[] = []
  for (let offset = 0; ; offset += SEARCH_PAGE) {
    const response = await page(offset)
    const items = response.items ?? []
    for (const item of items) if (item.id) ids.push(item.id)
    const total = response.pagination?.total ?? 0
    if (items.length < SEARCH_PAGE || offset + SEARCH_PAGE >= total) return ids
  }
}

/** A wire's value for the chosen sort, for ordering a merged search. */
function sortValue(wire: SubscriptionWire, field: SubscriptionQuery['sortBy']): number {
  const raw = (wire as Record<string, unknown>)[field]
  return raw instanceof Date ? raw.getTime() : raw ? new Date(String(raw)).getTime() || 0 : 0
}

export async function fetchSubscriptions(
  client: Flexprice,
  query: SubscriptionQuery,
  signal?: AbortSignal,
): Promise<SubscriptionPage> {
  /*
   * The search matches a customer's name or a plan's name, asked of the
   * server. The contract search has no name field, but it narrows by
   * `customer_ids` and by a `plan_id` filter: so every customer and plan whose
   * name matches is collected first (all pages), and the contracts are
   * narrowed to them, which keeps paging and the total true. A term nothing
   * matches is an empty page. When both customers and plans match, the two
   * narrowings cannot be OR-ed in one request, so both are read in full,
   * merged without duplicates, ordered by the chosen sort and paged here.
   */
  const term = query.search.trim()
  let request: Record<string, unknown> = toSubscriptionFilter(query)
  if (term) {
    const [customerIds, planIds] = await Promise.all([
      allMatchingIds((offset) =>
        call(
          (options) =>
            client.customers.queryCustomer(
              { filters: nameContainsFilter(term), limit: SEARCH_PAGE, offset } as never,
              options,
            ),
          signal,
        ),
      ),
      allMatchingIds((offset) =>
        call(
          (options) =>
            client.plans.queryPlan(
              { filters: nameContainsFilter(term), limit: SEARCH_PAGE, offset } as never,
              options,
            ),
          signal,
        ),
      ),
    ])
    if (customerIds.length === 0 && planIds.length === 0) return { subscriptions: [], total: 0 }
    const byPlan: SubscriptionQuery = {
      ...query,
      filters: [...(query.filters ?? []), { field: 'plan_id', op: FilterOp.In, value: planIds }],
    }
    if (planIds.length === 0) request = toSubscriptionFilter(query, customerIds)
    else if (customerIds.length === 0) request = toSubscriptionFilter(byPlan)
    else return mergedSearch(client, query, customerIds, byPlan, signal)
  }
  const response = await call(
    (options) => client.subscriptions.querySubscription(request as never, options),
    signal,
  )
  const wires = await withCustomerNames(
    client,
    (response.items ?? []) as SubscriptionWire[],
    signal,
  )
  const subscriptions = wires.map(toSubscription)

  // Status is re-checked here, which keeps the page's filter exact while the
  // server narrows the fetch.
  const filtered = subscriptions.filter(
    (subscription) => query.statuses.length === 0 || query.statuses.includes(subscription.status),
  )

  return {
    subscriptions: filtered,
    total: response.pagination?.total ?? 0,
  }
}

/** A search that matched customers and plans: both narrowings read in full, merged and paged. */
async function mergedSearch(
  client: Flexprice,
  query: SubscriptionQuery,
  customerIds: readonly string[],
  byPlan: SubscriptionQuery,
  signal?: AbortSignal,
): Promise<SubscriptionPage> {
  const scan = async (filter: (page: SubscriptionQuery) => Record<string, unknown>) => {
    const wires: SubscriptionWire[] = []
    for (let page = 1; ; page++) {
      const response = await call(
        (options) =>
          client.subscriptions.querySubscription(
            filter({ ...query, page, pageSize: SEARCH_CONTRACT_PAGE }) as never,
            options,
          ),
        signal,
      )
      const items = (response.items ?? []) as SubscriptionWire[]
      wires.push(...items)
      const total = response.pagination?.total ?? 0
      if (items.length < SEARCH_CONTRACT_PAGE || page * SEARCH_CONTRACT_PAGE >= total) return wires
    }
  }
  const [byCustomer, byPlanName] = await Promise.all([
    scan((page) => toSubscriptionFilter(page, customerIds)),
    scan((page) => toSubscriptionFilter({ ...byPlan, page: page.page, pageSize: page.pageSize })),
  ])
  const seen = new Set<string>()
  const direction = query.sortDirection === 'asc' ? 1 : -1
  const merged = [...byCustomer, ...byPlanName]
    .filter((wire) => {
      const id = wire.id ?? ''
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .sort((a, b) => direction * (sortValue(a, query.sortBy) - sortValue(b, query.sortBy)))
  const start = (query.page - 1) * query.pageSize
  const page = await withCustomerNames(client, merged.slice(start, start + query.pageSize), signal)
  return { subscriptions: page.map(toSubscription), total: merged.length }
}

/**
 * The page's entire interface to subscriptions.
 *
 * Takes domain vocabulary, returns domain models: the same controlled shape as
 * `useCoupons`, so the page can keep its query in the URL rather than in
 * component state.
 */
/**
 * The contracts that hang from this one (`parent_subscription_id`), as V1
 * lists them on a parent: their customer, plan and status. A contract with no
 * children reads an empty list.
 */
export function useInheritedContracts(parentId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ parentId }),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.subscriptions.querySubscription(
            {
              filters: [
                {
                  field: 'parent_subscription_id',
                  operator: 'eq',
                  dataType: 'string',
                  value: { string: parentId },
                },
              ],
              expand: 'plan,customer',
              limit: 100,
              offset: 0,
            },
            options,
          ),
        signal,
      )
      const wires = await withCustomerNames(
        client,
        (response.items ?? []) as SubscriptionWire[],
        signal,
      )
      return wires.map(toSubscription)
    },
    enabled: parentId.length > 0,
  })
}

export function useSubscriptions(query: SubscriptionQuery, options: { enabled?: boolean } = {}) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: ({ signal }) => fetchSubscriptions(client, query, signal),
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  })
}

/** Pages read per count query: 500 contracts each, so 5 000 before giving up. */
const COUNT_PAGE = 500
const COUNT_PAGES = 10

/**
 * How many contracts each of these customers has: for the Contracts column on
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
              {
                customerIds: ids,
                subscriptionStatus: LIVE_SUBSCRIPTION_STATUSES,
                limit: COUNT_PAGE,
                offset: page * COUNT_PAGE,
              } as never,
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

/** A contract a new one can be created under, as the parent picker lists it. */
export interface ParentContractCandidate {
  id: string
  customerId: string
  customerName: string
  planName: string
}

/**
 * The contracts that can be a parent: running ones (active or trialing) that
 * do not sit under a parent themselves, since a child cannot have children.
 */
export function toParentContractCandidates(
  contracts: readonly SubscriptionWire[],
): ParentContractCandidate[] {
  return contracts
    .filter((contract) => contract.id && !contract.parentSubscriptionId)
    .map((contract) => {
      const row = toSubscription(contract)
      return {
        id: row.id,
        customerId: row.customerId,
        customerName: row.customerName,
        planName: row.planName,
      }
    })
}

/**
 * Contracts a new contract can sit under (`inheritance.parent_subscription_id`):
 * the first page of running contracts, with their customer and plan named.
 */
export function useParentContractCandidates(enabled = true) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ parentCandidates: true }),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.subscriptions.querySubscription(
            {
              subscriptionStatus: ['active', 'trialing'],
              expand: 'customer,plan',
              limit: 100,
              offset: 0,
            },
            options,
          ),
        signal,
      )
      return toParentContractCandidates(
        await withCustomerNames(client, (response.items ?? []) as SubscriptionWire[], signal),
      )
    },
    enabled,
    staleTime: 30_000,
  })
}

/** The contract states the API counts when it checks who may inherit. */
const HIERARCHY_WIRE_STATUSES: FlexpriceModels.SubscriptionStatus[] = [
  'active',
  'trialing',
  'draft',
]
const HIERARCHY_STATUSES = new Set<string>(HIERARCHY_WIRE_STATUSES)

/**
 * Which of these customers cannot inherit a contract from `parentCustomerId`,
 * applying the rule the API checks on create: a child may hold no contract of
 * its own, and may already inherit only from the paying customer's contracts.
 *
 * `contracts` are every contract of the paying customer and the candidates.
 * Cancelled and paused contracts do not count, as the API does not count them.
 */
export function toInheritanceBlocks(
  parentCustomerId: string,
  contracts: readonly SubscriptionWire[],
): Record<string, InheritanceBlock> {
  const live = contracts.filter((c) => HIERARCHY_STATUSES.has(c.subscriptionStatus ?? ''))
  const parentContracts = new Set(
    live.filter((c) => c.customerId === parentCustomerId).map((c) => c.id),
  )
  const blocks: Record<string, InheritanceBlock> = {}
  for (const contract of live) {
    const customerId = contract.customerId
    if (!customerId || customerId === parentCustomerId) continue
    if (!contract.parentSubscriptionId) {
      // Its own contract outranks any other reason: it is the one to end first.
      blocks[customerId] = InheritanceBlock.OwnContract
    } else if (
      !parentContracts.has(contract.parentSubscriptionId) &&
      blocks[customerId] !== InheritanceBlock.OwnContract
    ) {
      blocks[customerId] = InheritanceBlock.OtherParent
    }
  }
  return blocks
}

/**
 * Why each of these customers cannot inherit a contract from `parentCustomerId`
 *: one `POST /subscriptions/search` narrowed by `customer_ids`, paged like the
 * contract counts. A customer missing from the result can inherit.
 */
export function useInheritanceBlocks(parentCustomerId: string, customerIds: readonly string[]) {
  const client = useFlexprice()
  const ids = [...new Set(customerIds.filter((id) => id && id !== parentCustomerId))].sort()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ inheritanceFor: parentCustomerId, ids }),
    queryFn: async ({ signal }) => {
      const contracts: SubscriptionWire[] = []
      for (let page = 0; page < COUNT_PAGES; page += 1) {
        const response = await call(
          (options) =>
            client.subscriptions.querySubscription(
              {
                customerIds: [parentCustomerId, ...ids],
                // The states the API checks; left out, only active came back.
                subscriptionStatus: HIERARCHY_WIRE_STATUSES,
                limit: COUNT_PAGE,
                offset: page * COUNT_PAGE,
              },
              options,
            ),
          signal,
        )
        const items = (response.items ?? []) as SubscriptionWire[]
        contracts.push(...items)
        const total = response.pagination?.total ?? 0
        if (items.length < COUNT_PAGE || (page + 1) * COUNT_PAGE >= total) break
      }
      return toInheritanceBlocks(parentCustomerId, contracts)
    },
    enabled: Boolean(parentCustomerId) && ids.length > 0,
    staleTime: 30_000,
  })
}

/**
 * A plain sentence for the customer-hierarchy refusals of `POST /subscriptions`.
 *
 * The API answers with its hint: "The child customer cannot have standalone
 * or parent subscriptions": which names neither the customer nor the fix.
 * `nameOf` turns the external id the API reports into the customer's name.
 * Any other error is null, so the caller keeps its own message.
 */
export function explainContractHierarchyError(
  error: unknown,
  nameOf: (externalId: string) => string = (externalId) => externalId,
): string | null {
  if (!(error instanceof ApiError) || !error.fromServer) return null
  const said = error.message.toLowerCase()
  const externalId = error.details?.['external_id']
  const who = externalId ? nameOf(externalId) : 'One of the inherited customers'

  if (said.includes('cannot have standalone or parent subscriptions')) {
    return `${who} has a contract of its own, so it cannot inherit this one. End that contract first, or remove ${externalId ? 'the customer' : 'it'} from Inherited customers.`
  }
  if (said.includes('can only be inherited under one parent')) {
    return `${who} already inherits another customer's contract. A customer can inherit only one.`
  }
  if (said.includes('cannot appear in external_customer_ids_to_inherit_subscription')) {
    return "The contract's own customer cannot also be one of its inherited customers."
  }
  if (said.includes('receives a subscription through hierarchy')) {
    return "This customer inherits another customer's contract, so it cannot have a contract of its own."
  }
  if (said.includes('external_customer_ids_to_inherit_subscription, not both')) {
    return INHERITANCE_WITH_BILLING_CUSTOMER
  }
  if (said.includes('remove auto_invoice_threshold')) {
    return INHERITANCE_WITH_THRESHOLD
  }
  return null
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
/** A contract date (a day, or an instant picked with a time) as the API takes it. */
const utcDay = (day: string) => contractDateToInstant(day)

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

/**
 * A charge's bucket size, set with its commitment, folded into the override
 * lines: onto the charge's own override when it has one, else a line of its own.
 *
 * The API takes one `bucket_size` per charge. A bucket the price override chose
 * itself wins: the form keeps the two in step when either dialog saves, and
 * this keeps an explicit choice from being overwritten if they ever differ.
 */
function withBuckets(
  lines: Record<string, unknown>[],
  commitments: readonly ChargeCommitment[],
): Record<string, unknown>[] {
  const buckets = new Map(
    commitments.filter((c) => c.bucketSize).map((c) => [c.priceId, c.bucketSize]),
  )
  if (buckets.size === 0) return lines
  const merged = lines.map((line) => {
    const bucket = buckets.get(line.priceId as string)
    return bucket && !line.bucketSize ? { ...line, bucketSize: bucket } : line
  })
  const covered = new Set(lines.map((line) => line.priceId))
  for (const [priceId, bucketSize] of buckets)
    if (!covered.has(priceId)) merged.push({ priceId, bucketSize })
  return merged
}

/** `HH:MM` as the API's `{ hour, minute }`. */
function toBucket(time: string): { hour: number; minute: number } {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return { hour, minute }
}

/** A window's own price: the plan charge it reprices, at the window's rate. */
function windowPrice(window: CommitmentWindow, base: CommitmentPriceBase): Record<string, unknown> {
  return {
    type: PriceType.Usage,
    priceUnitType: 'FIAT',
    entityId: base.entityId,
    entityType: base.entityType,
    meterId: base.meterId,
    currency: base.currency.toLowerCase(),
    billingPeriod: base.billingPeriod,
    billingPeriodCount: base.billingPeriodCount,
    invoiceCadence: base.invoiceCadence,
    billingModel: window.billingModel,
    amount: window.price,
    ...(window.billingModel === WindowBillingModel.Package
      ? { transformQuantity: { divideBy: Number(window.packageSize), round: 'up' } }
      : {}),
  }
}

/** One charge's commitment as `line_item_commitments` takes it. */
function toLineItemCommitment(commitment: ChargeCommitment): Record<string, unknown> {
  const windowed = commitment.windowed && Boolean(commitment.bucketSize)
  const base = commitment.priceBase
  return {
    commitmentType: commitment.type,
    ...(commitment.type === CommitmentType.Amount
      ? { commitmentAmount: Number(commitment.value) }
      : { commitmentQuantity: Number(commitment.value) }),
    ...(commitment.duration ? { commitmentDuration: commitment.duration } : {}),
    ...(commitment.overageFactor ? { overageFactor: Number(commitment.overageFactor) } : {}),
    enableTrueUp: commitment.trueUp,
    ...(windowed ? { isWindowCommitment: true } : {}),
    ...(windowed && base && commitment.windows.length > 0
      ? {
          commitmentTimeBuckets: commitment.windows.map((window) => ({
            start: toBucket(window.start),
            end: toBucket(window.end),
            commitmentType: window.type,
            commitmentValue: window.value,
            ...(window.overageFactor ? { overageFactor: window.overageFactor } : {}),
            trueUpEnabled: window.trueUp,
            price: windowPrice(window, base),
          })),
        }
      : {}),
  }
}

/**
 * An add-on's own pricing as the attach takes it: new prices as
 * `override_line_items` and commitments as `line_item_commitments`, both keyed
 * by the add-on's price. A bucket size chosen with a commitment rides on that
 * price's override line, as for a plan charge.
 */
function addonPricing(addon: {
  priceOverrides?: PriceOverride[] | undefined
  commitments?: ChargeCommitment[] | undefined
}): {
  lineItemCommitments?: Record<string, Record<string, unknown>>
  overrideLineItems?: FlexpriceModels.OverrideLineItemRequest[]
} {
  const commitments = addon.commitments ?? []
  const lines = withBuckets(
    (addon.priceOverrides ?? []).map(
      (override) => toOverrideLineItem(override) as unknown as Record<string, unknown>,
    ),
    commitments,
  )
  return {
    ...(commitments.length > 0
      ? {
          lineItemCommitments: Object.fromEntries(
            commitments.map((commitment) => [commitment.priceId, toLineItemCommitment(commitment)]),
          ),
        }
      : {}),
    ...(lines.length > 0
      ? { overrideLineItems: lines as FlexpriceModels.OverrideLineItemRequest[] }
      : {}),
  }
}

/**
 * One entitlement override as `override_entitlements` takes it. A metered
 * grant goes as the grant patch, as an entitlement's own grant is sent: an
 * unlimited allowance as `grant_unlimited` on a billing-period window, a
 * window's length and start only when it is hourly, daily or weekly.
 */
function toOverrideEntitlement(
  override: CreateSubscription['entitlementOverrides'][number],
): Record<string, unknown> {
  const grant = override.grant
  const unlimited = grant?.quota === null
  const unit = grant ? (unlimited ? 'subscription_period' : grant.unit) : undefined
  return {
    entitlementId: override.entitlementId,
    ...(override.usageLimit !== undefined ? { usageLimit: override.usageLimit } : {}),
    ...(override.isEnabled !== undefined ? { isEnabled: override.isEnabled } : {}),
    ...(override.staticValue !== undefined ? { staticValue: override.staticValue } : {}),
    ...(grant
      ? {
          grantMeasure: grant.measure,
          ...(unlimited ? { grantUnlimited: true } : { grantQuota: grant.quota }),
          grantDurationUnit: unit,
          ...(unit !== 'subscription_period'
            ? { grantDurationValue: grant.every ?? 1, grantAllocationBehavior: grant.allocation }
            : {}),
          aggregationMode: grant.aggregation,
        }
      : {}),
  }
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
 * commitments are not sent: the API takes them on the contract, not a phase.
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
    // This contract's own rate to the invoicing customer's billing currency; only rates set.
    ...(draft.fxRates.some((fx) => fx.rate)
      ? {
          fxRates: draft.fxRates
            .filter((fx) => fx.rate)
            .map((fx) => ({
              rate: fx.rate,
              ...(fx.startDate ? { startDate: contractDateToInstant(fx.startDate) } : {}),
              ...(fx.endDate ? { endDate: contractDateToInstant(fx.endDate) } : {}),
            })),
        }
      : {}),
    ...(draft.includePriceIds ? { includePriceIds: draft.includePriceIds } : {}),
    ...(first && withBuckets(overrideLines(first), phased ? [] : draft.chargeCommitments).length > 0
      ? {
          overrideLineItems: withBuckets(
            overrideLines(first),
            phased ? [] : draft.chargeCommitments,
          ),
        }
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
                toLineItemCommitment(commitment),
              ]),
            ),
          }
        : {}),
    ...(draft.commitmentAmount
      ? {
          commitmentAmount: draft.commitmentAmount,
          ...(draft.commitmentDuration ? { commitmentDuration: draft.commitmentDuration } : {}),
          ...(draft.overageFactor ? { overageFactor: draft.overageFactor } : {}),
          // True-up needs a commitment to bill against; a zero amount is none.
          enableTrueUp: draft.enableTrueUp && Number(draft.commitmentAmount) > 0,
        }
      : {}),
    ...(draft.entitlementOverrides.length > 0
      ? {
          overrideEntitlements: draft.entitlementOverrides.map(toOverrideEntitlement),
        }
      : {}),
    // The API uses this list *instead of* the plan's grants, so it is sent only
    // when the grants were changed: an empty list then removes them all.
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
      ? {
          addons: draft.addons.map((addon) => ({
            addonId: addon.addonId,
            ...addonPricing(addon),
            ...(addon.startDate ? { startDate: utcDay(addon.startDate) } : {}),
          })),
        }
      : {}),
    billingCycle: draft.billingCycle,
    ...(draft.billingAnchor ? { billingAnchor: utcDay(draft.billingAnchor) } : {}),
    ...(draft.paymentTerms ? { paymentTerms: draft.paymentTerms } : {}),
    prorationBehavior: draft.prorate ? 'create_prorations' : 'none',
    ...(draft.autoInvoiceThreshold ? { autoInvoiceThreshold: draft.autoInvoiceThreshold } : {}),
    ...(draft.draft ? { subscriptionStatus: 'draft' } : {}),
    // Who pays: invoices routed to another customer, and the customers that
    // inherit this contract. Both are by external id, as the API takes them.
    ...(draft.invoicingCustomerExternalId ||
    draft.inheritedCustomerExternalIds.length > 0 ||
    draft.parentSubscriptionId
      ? {
          inheritance: {
            // Under a parent contract (the customer hierarchy): by contract id.
            ...(draft.parentSubscriptionId
              ? { parentSubscriptionId: draft.parentSubscriptionId }
              : {}),
            ...(draft.invoicingCustomerExternalId
              ? { invoicingCustomerExternalId: draft.invoicingCustomerExternalId }
              : {}),
            ...(draft.inheritedCustomerExternalIds.length > 0
              ? { externalCustomerIdsToInheritSubscription: draft.inheritedCustomerExternalIds }
              : {}),
          },
        }
      : {}),
  }
}

/** Start a subscription: `POST /subscriptions`. Call `mutateAsync(draft)`. */
export function useCreateSubscription() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    meta: { notify: { success: 'Contract created', error: 'Could not create the contract.' } },
    mutationFn: (draft: CreateSubscription) =>
      call(() =>
        client.subscriptions.createSubscription(toCreateSubscriptionRequest(draft) as never),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.counts.all() })
      // A contract that starts now bills its in-advance charges at once, so the
      // customer's invoice list has a new row the cached page does not.
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
    },
  })
}

/**
 * One subscription, with its customer and plan resolved.
 *
 * Read through search by id rather than `GET /subscriptions/{id}`, because only
 * the search accepts `expand: 'customer,plan'`: the single read returns the
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
              // Without it the search answers active only, and a trialing
              // contract's own page read "not found".
              subscriptionStatus: ALL_SUBSCRIPTION_STATUSES,
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

/** The priced lines: `GET /subscriptions/{id}`, the only read that carries them. */
export function useSubscriptionLines(id: string) {
  return useSubscriptionFull(id, (response) =>
    ((response.lineItems ?? []) as SubscriptionLineWire[]).map(toSubscriptionLine),
  )
}

/**
 * Every line the contract has had, ended ones included:
 * `POST /subscriptions/lineitems/search` with `active_filter: false`.
 *
 * `GET /subscriptions/{id}` returns only the lines billing now, so a charge
 * whose price was changed loses its earlier version from that read: the API
 * ended the old line and started a new one, it did not delete it. This read
 * keeps both, with their prices (expired ones too), so the page can show the
 * old price as an inactive version of the charge instead of as gone.
 */
export function useSubscriptionLineHistory(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.lineHistory(id),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) =>
          client.subscriptions.querySubscriptionLineItems(
            {
              subscriptionIds: [id],
              activeFilter: false,
              expand: 'prices',
              limit: 500,
              offset: 0,
            },
            options,
          ),
        signal,
      )
      return ((response.items ?? []) as SubscriptionLineWire[]).map(toSubscriptionLine)
    },
    enabled: id.length > 0,
  })
}

/**
 * Every version of one contract charge, oldest first:
 * `GET /subscriptions/lineitems/{id}/history`.
 *
 * The API walks the line's predecessor and successor pointers, so any
 * version's ID returns the same timeline. Versions cancelled before they
 * started are left out. Read when a charge's sheet opens (`lineId` empty
 * until then), not for every row.
 */
export function useSubscriptionLineVersions(lineId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.lineVersions(lineId),
    queryFn: async ({ signal }) => {
      const response = await call(
        (options) => client.subscriptions.getSubscriptionLineItemHistory(lineId, options),
        signal,
      )
      return ((response.items ?? []) as SubscriptionLineWire[]).map(toSubscriptionLine)
    },
    enabled: lineId.length > 0,
  })
}

/** The credit grants this contract was given, from the same read as the lines. */
export function useSubscriptionCreditGrants(id: string) {
  return useSubscriptionFull(id, (response): CreditGrant[] =>
    ((response.creditGrants ?? []) as CreditGrantWire[]).map(toCreditGrant),
  )
}

/** What the subscription includes: `GET /subscriptions/{id}/entitlements`. */
export function useSubscriptionEntitlements(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.entitlements(id),
    queryFn: async () => {
      try {
        const response = await call(() => client.subscriptions.getSubscriptionEntitlements(id))
        return ((response.features ?? []) as SubscriptionFeatureWire[]).map(
          toSubscriptionEntitlement,
        )
      } catch (error) {
        const recovered = subscriptionEntitlementsFromRejection(error)
        if (recovered) return recovered
        throw error
      }
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

/** End a subscription now or at the end of the period: `POST /subscriptions/{id}/cancel`. */
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

/** Stop billing a running contract until it is resumed: `POST /subscriptions/{id}/pause`. */
export function usePauseSubscription() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: PauseSubscription }) =>
      call(() =>
        client.subscriptions.pauseSubscription(id, {
          prorationBehavior: draft.prorate ? 'create_prorations' : 'none',
          ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
        }),
      ),
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** Start billing a paused contract again: `POST /subscriptions/{id}/resume`. */
export function useResumeSubscription() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: ResumeSubscription }) =>
      call(() =>
        client.subscriptions.resumeSubscription(id, {
          prorationBehavior: draft.prorate ? 'create_prorations' : 'none',
        }),
      ),
    onSuccess: () => invalidateSubscription(queryClient),
  })
}

/** Start a draft subscription: `POST /subscriptions/{id}/activate`. */
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
 * Replace a subscription's metadata: `PUT /subscriptions/{id}` with
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
function commitmentFields(
  terms: UsageTerms,
  { update = false }: { update?: boolean } = {},
): Record<string, unknown> {
  const commitment = terms.commitment
  if (!commitment) return {}
  return {
    commitmentType: commitment.kind,
    ...(commitment.kind === CommitmentKind.Quantity
      ? { commitmentQuantity: Number(commitment.value) }
      : { commitmentAmount: Number(commitment.value) }),
    // Per bucket only when there are buckets: the API rejects a windowed
    // commitment on a charge summed over the whole period.
    commitmentWindowed: commitment.windowed && terms.bucketSize !== '',
    // On an update an omitted period keeps the stored one; an empty string is
    // how the API is told to go back to the billing period.
    ...(commitment.duration
      ? { commitmentDuration: commitment.duration }
      : update
        ? { commitmentDuration: '' }
        : {}),
    commitmentOverageFactor: Number(commitment.overageFactor),
    commitmentTrueUpEnabled: commitment.trueUp,
  }
}

/**
 * A new charge on one contract, priced inline: `POST /subscriptions/{id}/lineitems`.
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
    // A day starts at midnight UTC; an exact instant (a contract that starts
    // later that day) is sent as it is.
    ...(draft.startDate
      ? {
          startDate: new Date(
            draft.startDate.includes('T') ? draft.startDate : `${draft.startDate}T00:00:00Z`,
          ),
        }
      : {}),
    ...(usage ? {} : { prorationBehavior: draft.proration }),
    price: {
      ...price,
      ...(usage && draft.terms.bucketSize ? { bucketSize: draft.terms.bucketSize } : {}),
    },
    ...(usage ? commitmentFields(draft.terms) : {}),
  }
}

/** A metered charge's new price and terms: `PUT /subscriptions/lineitems/{lineItemId}`. */
export function toUpdateLineItemRequest(draft: EditContractCharge): Record<string, unknown> {
  const { price } = draft
  const custom = draft.priceUnit !== ''
  const from = effectiveFrom(draft.effectiveFrom)
  const tiersOf = (tiers: Tier[]) =>
    tiers.map((tier) => ({
      ...(tier.upTo == null ? {} : { upTo: tier.upTo }),
      unitAmount: tier.unitAmount,
      flatAmount: tier.flatAmount ?? '0',
      ...tierPackageFields(tier),
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
    ...commitmentFields(draft.terms, { update: true }),
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

/** Preview a quantity or price change: `POST /subscriptions/{id}/modify/preview`. Saves nothing. */
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

/** Apply a quantity or price change: `POST /subscriptions/{id}/modify/execute`. */
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

/** Add a charge to one contract: only this contract changes. */
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

/** Change a charge's price on one contract: `PUT /subscriptions/lineitems/{lineItemId}`. */
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

/** End a charge on one contract: `DELETE /subscriptions/lineitems/{lineItemId}`. */
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

/** This period's consumption: `POST /subscriptions/usage`. */
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

/** Changes queued for a future date: `GET /subscriptions/{id}/schedules`. */
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

/** The invoices this contract produced, newest first: the invoice search filtered by `subscription_id`. */
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
      priceId: line.priceId ?? '',
      name: line.description,
      detail: line.detail,
      quantity: line.quantity,
      unitPrice: perUnit(money(line.amount, currency), line.quantity),
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
 * The invoice this contract will raise at the end of the period:
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

/** The add-ons attached to this contract: `GET /subscriptions/{id}/addons/associations`. */
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

/** The coupons applied to this contract: `GET /coupons/associations` filtered by subscription. */
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

/** The tax rates applied to this contract: `GET /taxes/associations` for the subscription. */
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
      const wires = await withTaxRates((response.items ?? []) as SubscriptionTaxWire[], (rateId) =>
        call((options) => client.taxRates.getTaxRate(rateId, options), signal),
      )
      return wires.map(toSubscriptionTax)
    },
    enabled: id.length > 0,
  })
}

/**
 * What adding something to one contract can change on its page: the detail, its
 * entitlements, grants, add-ons, coupons, taxes and the invoice preview all sit
 * under the subscriptions family. Tax associations are shared with the customer
 * page, so they refresh too, and so does entitlement usage, which is read
 * through the customer (`GET /customers/usage`): a new entitlement would
 * otherwise show no usage until something else refetched it.
 */
const invalidateContract = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.taxAssociations.all() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.customers.usageAll() })
}

/** Give this contract an entitlement its plan does not carry: `POST /entitlements`. */
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

/**
 * When a grant added to a running contract starts. The API requires a
 * `start_date` for subscription-scoped grants and the dialog has no date, so
 * it is set as V1 sets it: a recurring grant starts at the end of the current
 * period, so it refreshes on the contract's own cycle; a one-time grant is
 * issued now.
 */
export function subscriptionGrantStart(
  draft: Pick<CreateCreditGrant, 'cadence'>,
  currentPeriodEnd: Date | null | undefined,
  now: Date = new Date(),
): Date {
  return draft.cadence === CreditGrantCadence.Recurring && currentPeriodEnd ? currentPeriodEnd : now
}

/** Grant this contract credits of its own: `POST /creditgrants`, scoped to the subscription. */
export function useCreateSubscriptionCreditGrant(
  subscriptionId: string,
  currentPeriodEnd?: Date | null,
) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: CreateCreditGrant) =>
      call(() =>
        client.creditGrants.createCreditGrant({
          ...toCreditGrantRequest(draft, CreditGrantScope.Subscription, subscriptionId),
          startDate: subscriptionGrantStart(draft, currentPeriodEnd),
        } as FlexpriceModels.CreateCreditGrantRequest),
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
  return {
    subscriptionId,
    addonId: draft.addonId,
    ...addonPricing(draft),
    ...(draft.startDate ? { startDate: contractDateToInstant(draft.startDate) } : {}),
  }
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

/** Take one coupon association off: `action: remove` on the same modify call. */
export function toRemoveCouponRequest(
  associationId: string,
): FlexpriceModels.ExecuteSubscriptionModifyRequest {
  return {
    type: 'coupon',
    couponParams: { action: 'remove', couponAssociationId: associationId },
  }
}

/**
 * Several add-ons attached as one change, as V1's add-on dialog sends them:
 * `POST /subscriptions/{id}/modify/execute`, type `addon`, so the set settles
 * as one netted change rather than one proration per add-on.
 */
export function toAddAddonsRequest(
  subscriptionId: string,
  drafts: readonly AddContractAddon[],
): FlexpriceModels.ExecuteSubscriptionModifyRequest {
  return {
    type: 'addon',
    addonBulkParams: {
      adds: drafts.map((draft) => {
        const { subscriptionId: _, ...add } = toAddAddonRequest(subscriptionId, draft)
        return add
      }),
    },
  }
}

/**
 * Attach add-ons to this contract. One goes to `POST /subscriptions/addon`;
 * more go together as one `addon` modification.
 */
export function useAddSubscriptionAddon(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (drafts: readonly AddContractAddon[]) =>
      drafts.length === 1
        ? call(() =>
            client.subscriptions.addSubscriptionAddon(
              toAddAddonRequest(subscriptionId, drafts[0]!),
            ),
          )
        : call(() =>
            client.subscriptions.executeSubscriptionModify(
              subscriptionId,
              toAddAddonsRequest(subscriptionId, drafts),
            ),
          ),
    onSuccess: () => invalidateContract(queryClient),
  })
}

/**
 * Apply a coupon to this contract by its code:
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

/** Take one coupon off this contract or one of its charges, by its association id. */
export function useRemoveSubscriptionCoupon(subscriptionId: string) {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (associationId: string) =>
      call(() =>
        client.subscriptions.executeSubscriptionModify(
          subscriptionId,
          toRemoveCouponRequest(associationId),
        ),
      ),
    onSuccess: () => invalidateContract(queryClient),
  })
}

/** Apply a tax rate to this contract: `POST /taxes/associations`, entity type `subscription`. */
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

/** Take an add-on off a contract: `DELETE /subscriptions/addon` by its association id, at period end. */
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

/** Stop applying a tax rate to a contract: `DELETE /taxes/associations/{id}`. */
export function useRemoveSubscriptionTax() {
  const remove = useRemoveTaxAssociationRequest()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: remove,
    onSuccess: () => invalidateContract(queryClient),
  })
}

/** End a contract's credit grant now: `DELETE /creditgrants/{id}` with today as the end date. */
export function useCancelSubscriptionCreditGrant() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (grantId: string) =>
      call(() => client.creditGrants.deleteCreditGrant(grantId, { effectiveDate: new Date() })),
    onSuccess: () => invalidateContract(queryClient),
  })
}
