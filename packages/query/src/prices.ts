import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { call } from '@fp/api'
import {
  BillingModel,
  BillingPeriod,
  type Charge,
  type CreateCharge,
  InvoiceCadence,
  type PriceEntityType,
  PriceType,
  PriceWindowSize,
  type RoundType,
  type Tier,
  TierMode,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Charges: the translation between the product's "charge" and the API's price.
 *
 * A plan's money is not on the plan: it is a set of `Price` records tagged with
 * an `entity_type`, reached through `/prices/*`. This module is the one place
 * that knows a charge *is* a price: it reads them with `POST /prices/search`,
 * writes them with `POST /prices/bulk`, and maps the wire's price shape to and
 * from the domain `Charge` the editor and detail page speak.
 *
 * The SDK camelCases both directions, so this file reads and writes camelCase; a
 * `billing_model` never appears above the transport boundary.
 */

/** The wire shape this reads, after the SDK camelCases the response. */
export interface ChargeWire {
  /** The usage window the price is aggregated over, when it has one. */
  bucketSize?: string | undefined
  id?: string | undefined
  type?: string | undefined
  billingModel?: string | undefined
  amount?: string | undefined
  displayAmount?: string | undefined
  currency?: string | undefined
  billingPeriod?: string | undefined
  billingPeriodCount?: number | undefined
  invoiceCadence?: string | undefined
  billingCadence?: string | undefined
  tierMode?: string | undefined
  tiers?: Array<{ upTo?: number | null; unitAmount?: string; flatAmount?: string }> | undefined
  transformQuantity?: { divideBy?: number; round?: string } | undefined
  meterId?: string | undefined
  meter?: { id?: string; name?: string } | undefined
  entityType?: string | undefined
  entityId?: string | undefined
  lookupKey?: string | undefined
  description?: string | undefined
  displayName?: string | undefined
  trialPeriodDays?: number | undefined
  priceUnitType?: string | undefined
  priceUnitConfig?: { priceUnit?: string } | undefined
  startDate?: Date | undefined
  endDate?: Date | undefined
  sequence?: number | undefined
  parentPriceId?: string | undefined
  createdAt?: Date | undefined
}

const PRICE_TYPES = new Set<string>(Object.values(PriceType))
const BILLING_MODELS = new Set<string>(Object.values(BillingModel))
const BILLING_PERIODS = new Set<string>(Object.values(BillingPeriod))
const INVOICE_CADENCES = new Set<string>(Object.values(InvoiceCadence))
const TIER_MODES = new Set<string>(Object.values(TierMode))

/** One tier band, snake-safe: the SDK camelCases it, but guard the shape anyway. */
export function toTier(raw: {
  upTo?: number | null
  unitAmount?: string
  flatAmount?: string
}): Tier {
  return {
    upTo: typeof raw.upTo === 'number' ? raw.upTo : null,
    unitAmount: raw.unitAmount ?? '0',
    ...(raw.flatAmount != null ? { flatAmount: raw.flatAmount } : {}),
  }
}

/**
 * A price, as a domain `Charge`.
 *
 * Enums are validated against the values this client knows rather than trusted:
 * an unknown billing model is the API ahead of this build, and coercing it to a
 * flat fee is wrong but visible, where letting it through would render nothing.
 */
/** The window set on the price itself, ignoring anything the wire does not know. */
const PRICE_WINDOW_SIZES = new Set<string>(Object.values(PriceWindowSize))
function toBucketSize(value: unknown): PriceWindowSize | null {
  // A meter-level WEEK or MONTH can reach a price row; it is a real window but
  // not one this form offers, so it reads as "not set here" rather than being
  // coerced into a value the select cannot show.
  return typeof value === 'string' && PRICE_WINDOW_SIZES.has(value)
    ? (value as PriceWindowSize)
    : null
}

export function toCharge(wire: ChargeWire): Charge {
  const type = PRICE_TYPES.has(wire.type ?? '') ? (wire.type as PriceType) : PriceType.Fixed
  const billingModel = BILLING_MODELS.has(wire.billingModel ?? '')
    ? (wire.billingModel as BillingModel)
    : BillingModel.FlatFee
  const billingPeriod = BILLING_PERIODS.has(wire.billingPeriod ?? '')
    ? (wire.billingPeriod as BillingPeriod)
    : BillingPeriod.Monthly
  const invoiceCadence = INVOICE_CADENCES.has(wire.invoiceCadence ?? '')
    ? (wire.invoiceCadence as InvoiceCadence)
    : InvoiceCadence.Arrear
  const tierMode =
    billingModel === BillingModel.Tiered && TIER_MODES.has(wire.tierMode ?? '')
      ? (wire.tierMode as TierMode)
      : null

  const transform =
    wire.transformQuantity && typeof wire.transformQuantity.divideBy === 'number'
      ? {
          divideBy: wire.transformQuantity.divideBy,
          round: (wire.transformQuantity.round ?? null) as RoundType | null,
        }
      : null

  return {
    id: wire.id ?? '',
    type,
    billingModel,
    amount: wire.amount ?? '',
    displayAmount: wire.displayAmount ?? wire.amount ?? '',
    currency: wire.currency ?? '',
    billingPeriod,
    billingPeriodCount: wire.billingPeriodCount ?? 1,
    bucketSize: toBucketSize(wire.bucketSize),
    invoiceCadence,
    billingCadence: wire.billingCadence ?? 'RECURRING',
    tierMode,
    tiers: Array.isArray(wire.tiers) ? wire.tiers.map(toTier) : [],
    transformQuantity: transform,
    meterId: wire.meterId ?? null,
    meterName: wire.meter?.name ?? null,
    entityType: (wire.entityType ?? 'PLAN') as PriceEntityType,
    entityId: wire.entityId ?? '',
    lookupKey: wire.lookupKey ?? '',
    description: wire.description ?? '',
    displayName: wire.displayName ?? '',
    ...(wire.trialPeriodDays ? { trialPeriodDays: wire.trialPeriodDays } : {}),
    ...(wire.priceUnitType === 'CUSTOM' && wire.priceUnitConfig?.priceUnit
      ? { priceUnit: wire.priceUnitConfig.priceUnit }
      : {}),
    startDate: wire.startDate ?? null,
    endDate: wire.endDate ?? null,
    sequence: typeof wire.sequence === 'number' ? wire.sequence : null,
    ...(wire.parentPriceId ? { parentPriceId: wire.parentPriceId } : {}),
    createdAt: wire.createdAt ?? null,
  }
}

/**
 * A charge draft, as a `CreatePriceRequest` for the bulk endpoint.
 *
 * The inverse of `toCharge`: fills the fields the API requires (`priceUnitType`
 * defaults to FIAT: the currency case), and sends only what the chosen billing
 * model uses. A usage charge carries its meter; a tiered charge its bands, with
 * a missing flat amount defaulted to `"0"` the way the backend expects.
 */
export function toChargeRequest(
  draft: CreateCharge,
  entityType: PriceEntityType,
  entityId: string,
): Record<string, unknown> {
  const custom = draft.priceUnit ? draft.priceUnit : null
  const common: Record<string, unknown> = {
    type: draft.type,
    billingModel: draft.billingModel,
    currency: draft.currency,
    billingPeriod: draft.billingPeriod,
    billingPeriodCount: 1,
    invoiceCadence: draft.invoiceCadence,
    priceUnitType: custom ? 'CUSTOM' : 'FIAT',
    entityType,
    entityId,
    ...(draft.displayName ? { displayName: draft.displayName } : {}),
    ...(draft.type === PriceType.Usage && draft.meterId ? { meterId: draft.meterId } : {}),
    /*
     * The usage window, for metered charges only.
     *
     * Guarded on the type rather than sent whenever present: the API rejects
     * `bucket_size` on a fixed price outright, and a charge switched from usage
     * to fixed can still be holding the value the usage form put there.
     */
    ...(draft.type === PriceType.Usage && draft.bucketSize ? { bucketSize: draft.bucketSize } : {}),
    ...(draft.type === PriceType.Fixed && draft.trialPeriodDays
      ? { trialPeriodDays: draft.trialPeriodDays }
      : {}),
    ...(draft.type === PriceType.Fixed && draft.minQuantity !== undefined
      ? { minQuantity: draft.minQuantity }
      : {}),
    ...(draft.groupId ? { groupId: draft.groupId } : {}),
    ...(draft.startDate ? { startDate: new Date(`${draft.startDate}T00:00:00Z`) } : {}),
  }
  const tiersOf = (tiers: Tier[]) =>
    tiers.map((tier) => ({
      upTo: tier.upTo,
      unitAmount: tier.unitAmount,
      flatAmount: tier.flatAmount ?? '0',
    }))

  switch (draft.billingModel) {
    case BillingModel.FlatFee:
      return custom
        ? { ...common, priceUnitConfig: { priceUnit: custom, amount: draft.amount } }
        : { ...common, amount: draft.amount }
    case BillingModel.Package:
      return {
        ...common,
        ...(custom
          ? { priceUnitConfig: { priceUnit: custom, amount: draft.amount } }
          : { amount: draft.amount }),
        transformQuantity: { divideBy: draft.divideBy },
      }
    case BillingModel.Tiered:
      return {
        ...common,
        tierMode: draft.tierMode,
        ...(custom
          ? { priceUnitConfig: { priceUnit: custom, priceUnitTiers: tiersOf(draft.tiers) } }
          : { tiers: tiersOf(draft.tiers) }),
      }
  }
}

/**
 * Clears a usage window on the successor price.
 *
 * An absent `bucket_size` means "inherit", so removal needs a value of its own.
 * The API spells it `none`, lowercase, and it is not a `WindowSize`: hence the
 * literal here rather than a member of `PriceWindowSize`.
 */
const BUCKET_SIZE_NONE = 'none'

/**
 * A charge edit, as an `UpdatePriceRequest`.
 *
 * Only the price itself moves: the amount or bands, the model, the display name.
 * Currency, period, meter and cadence are fixed once a price exists, so they are
 * never sent. `effectiveFrom` is what makes the change a new *version*: the old
 * price keeps billing until that date rather than being rewritten in place.
 */
export function toUpdatePriceRequest(draft: CreateCharge): Record<string, unknown> {
  const custom = Boolean(draft.priceUnit)
  const common: Record<string, unknown> = {
    billingModel: draft.billingModel,
    ...(draft.displayName ? { displayName: draft.displayName } : {}),
    ...(draft.effectiveFrom ? { effectiveFrom: `${draft.effectiveFrom}T00:00:00Z` } : {}),
    /*
     * The usage window, stated rather than diffed.
     *
     * The API reads three cases off this field: absent means "keep whatever the
     * existing price had", the sentinel `'none'` clears it on the successor, and
     * a value replaces it. Absent is therefore not usable as "the user cleared
     * it": a window could never be removed. So a usage charge always says which
     * of the two it means, and a fixed charge says nothing because the API
     * refuses the field there at all.
     */
    ...(draft.type === PriceType.Usage ? { bucketSize: draft.bucketSize ?? BUCKET_SIZE_NONE } : {}),
  }
  const tiersOf = (tiers: Tier[]) =>
    tiers.map((tier) => ({
      upTo: tier.upTo,
      unitAmount: tier.unitAmount,
      flatAmount: tier.flatAmount ?? '0',
    }))

  switch (draft.billingModel) {
    case BillingModel.FlatFee:
      return {
        ...common,
        ...(custom ? { priceUnitAmount: draft.amount } : { amount: draft.amount }),
      }
    case BillingModel.Package:
      return {
        ...common,
        ...(custom ? { priceUnitAmount: draft.amount } : { amount: draft.amount }),
        transformQuantity: { divideBy: draft.divideBy },
      }
    case BillingModel.Tiered:
      return {
        ...common,
        tierMode: draft.tierMode,
        ...(custom ? { priceUnitTiers: tiersOf(draft.tiers) } : { tiers: tiersOf(draft.tiers) }),
      }
  }
}

/**
 * One entity's charges, through the one `queryPrice` call `usePrices` and
 * `usePriceHistory` share, so the filter's `as never` is written once rather
 * than once per caller (`scripts/check-sdk.mjs` counts them).
 */
async function fetchEntityCharges(
  client: ReturnType<typeof useFlexprice>,
  entityType: PriceEntityType,
  entityId: string,
  options: { limit: number; allowExpiredPrices?: boolean },
): Promise<Charge[]> {
  const response = await call(() =>
    client.prices.queryPrice({
      entityType,
      entityIds: [entityId],
      expand: 'meters',
      ...(options.allowExpiredPrices ? { allowExpiredPrices: true } : {}),
      limit: options.limit,
      offset: 0,
    } as never),
  )
  return (response.items ?? []).map((item) => toCharge(item as ChargeWire))
}

/**
 * The charges a plan (or add-on, or cost-sheet) carries.
 *
 * `expand: 'meters'` so a usage charge's row can name the feature it meters
 * without a second request. A generous `limit` because a plan's charges are a
 * handful, not a page: the detail page shows them all, not a slice.
 */
export function usePrices(entityType: PriceEntityType, entityId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.prices.list({ entityType, entityId }),
    queryFn: () => fetchEntityCharges(client, entityType, entityId, { limit: 100 }),
    // A plan with no id yet (a create in flight) has no charges to fetch.
    enabled: entityId.length > 0,
  })
}

/**
 * The charges of several entities in one search (`entity_ids`), grouped by
 * entity: the contract form's add-ons, so each can commit on its usage charges.
 */
const ENTITIES_PAGE = 200

export function useEntitiesCharges(entityType: PriceEntityType, entityIds: readonly string[]) {
  const client = useFlexprice()
  const ids = [...new Set(entityIds)].sort()

  return useQuery({
    queryKey: queryKeys.prices.list({ entityType, entityIds: ids }),
    queryFn: async () => {
      const byEntity = new Map<string, Charge[]>()
      // Page by page to the reported total, in a total order, so no price is missed.
      for (let offset = 0, seen = 0; ; offset += ENTITIES_PAGE) {
        const response = await call(() =>
          client.prices.queryPrice({
            entityType,
            entityIds: ids,
            expand: 'meters',
            // Ids are unique, so the order is total and pages never overlap.
            sort: 'id',
            order: 'asc',
            limit: ENTITIES_PAGE,
            offset,
          }),
        )
        const items = response.items ?? []
        seen += items.length
        for (const item of items) {
          const charge = toCharge(item as ChargeWire)
          byEntity.set(charge.entityId, [...(byEntity.get(charge.entityId) ?? []), charge])
        }
        if (items.length < ENTITIES_PAGE || seen >= (response.pagination?.total ?? 0)) break
      }
      return byEntity
    },
    enabled: ids.length > 0,
  })
}

/**
 * Every price an entity has had, ended ones included: `allow_expired_prices`.
 *
 * The plain list leaves out a price once it ends, so editing a charge made its
 * earlier price vanish: the API had ended it and created a new version, not
 * deleted it. The charges tables read this instead and fold each charge's
 * versions together (`chargeLineages`), so the old price shows as history.
 */
export function usePriceHistory(entityType: PriceEntityType, entityId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.prices.history({ entityType, entityId }),
    queryFn: () =>
      fetchEntityCharges(client, entityType, entityId, { limit: 500, allowExpiredPrices: true }),
    enabled: entityId.length > 0,
  })
}

/**
 * Save a plan's charges in one call.
 *
 * The editor collects a whole set and commits it together, so this is the bulk
 * endpoint, not one request per charge. Invalidating the entity's price list is
 * what makes the detail page show the new charges the moment the editor closes.
 */
export function useCreateBulkPrices() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
      charges,
    }: {
      entityType: PriceEntityType
      entityId: string
      charges: CreateCharge[]
    }) =>
      call(() =>
        client.prices.createPricesBulk({
          items: charges.map((charge) => toChargeRequest(charge, entityType, entityId)),
        } as never),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prices.all() })
      // The plan list shows a charge count, so it is stale too once charges land.
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
    },
  })
}

/**
 * Update one charge. The change is a new version of the price from
 * `effectiveFrom` (or from now), not an in-place rewrite of history.
 */
export function useUpdatePrice() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      call(() => client.prices.updatePrice(id, body as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prices.all() })
    },
  })
}

/** A charge, plus the plan, add-on, or cost sheet it prices. */
export interface FeatureChargeLink {
  charge: Charge
  parentName: string
  parentStatus: string
}

type NamedParent = { id?: string; name?: string; status?: string }

type PriceWithParent = ChargeWire & {
  plan?: NamedParent
  addon?: NamedParent
  meter?: { id?: string }
}

/**
 * Every plan, add-on, and cost-sheet charge that meters this feature.
 *
 * A feature does not carry its prices. A metered feature points at a meter, and
 * the prices that bill that meter are found with `meterIds` on
 * `POST /prices/search`.
 *
 * The expand values are **plural**: `addons` and `meters`, not `addon` and
 * `meter`. This route does not ignore an unknown one the way the subscription
 * search does; it answers `400 validation_error` naming the field, so the
 * whole query failed and the Charges tab on every feature showed an error.
 * `PriceExpandConfig` allows exactly: `meters`, `priceunit`, `plan`, `addons`,
 * `groups`, `features`.
 *
 * Anything still unnamed after the expand is looked up below, because a row
 * that shows a ULID is not a plan.
 */
export function useFeatureCharges(meterId: string | null) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.prices.list({ meterId: meterId ?? '', scope: 'feature' }),
    enabled: Boolean(meterId),
    queryFn: async (): Promise<FeatureChargeLink[]> => {
      const id = meterId ?? ''
      const response = await call(() =>
        client.prices.queryPrice({
          meterIds: [id],
          expand: 'plan,addons,meters',
          limit: 100,
          offset: 0,
        } as never),
      )
      const items = ((response.items ?? []) as PriceWithParent[]).filter(
        (item) => (item.meterId || item.meter?.id) === id,
      )

      const missing = (type: string) => [
        ...new Set(
          items
            .filter((item) => item.entityType === type && item.entityId && !named(item, type))
            .map((item) => item.entityId as string),
        ),
      ]
      const planIds = missing('PLAN')
      const addonIds = missing('ADDON')
      const sheetIds = [
        ...new Set(
          items
            .filter((item) => item.entityType === 'COSTSHEET' && item.entityId)
            .map((item) => item.entityId as string),
        ),
      ]

      const [plans, addons, sheets] = await Promise.all([
        planIds.length > 0
          ? call(() => client.plans.queryPlan({ planIds, limit: planIds.length, offset: 0 })).then(
              (page) => (page.items ?? []) as NamedParent[],
            )
          : [],
        addonIds.length > 0
          ? call(() =>
              client.addons.queryAddon({ addonIds, limit: addonIds.length, offset: 0 }),
            ).then((page) => (page.items ?? []) as NamedParent[])
          : [],
        sheetIds.length > 0
          ? call(() =>
              client.costs.queryCostsheet({
                costsheetIDs: sheetIds,
                queryFilter: { limit: sheetIds.length },
              } as never),
            ).then((page) => (page.items ?? []) as NamedParent[])
          : [],
      ])

      const byId = (rows: NamedParent[]) =>
        new Map(rows.filter((row) => row.id).map((row) => [row.id as string, row]))
      const planById = byId(plans)
      const addonById = byId(addons)
      const sheetById = byId(sheets)

      return items
        .filter(
          (item) =>
            item.entityType === 'PLAN' ||
            item.entityType === 'ADDON' ||
            item.entityType === 'COSTSHEET',
        )
        .map((item) => {
          const parent = parentOf(item, planById, addonById, sheetById)
          return { charge: toCharge(item), parentName: parent.name, parentStatus: parent.status }
        })
    },
  })
}

function named(item: PriceWithParent, type: string): boolean {
  if (type === 'PLAN') return Boolean(item.plan?.name)
  if (type === 'ADDON') return Boolean(item.addon?.name)
  return false
}

function parentOf(
  item: PriceWithParent,
  plans: Map<string, NamedParent>,
  addons: Map<string, NamedParent>,
  sheets: Map<string, NamedParent>,
): { name: string; status: string } {
  const looked =
    item.entityType === 'PLAN'
      ? (item.plan ?? (item.entityId ? plans.get(item.entityId) : undefined))
      : item.entityType === 'ADDON'
        ? (item.addon ?? (item.entityId ? addons.get(item.entityId) : undefined))
        : item.entityId
          ? sheets.get(item.entityId)
          : undefined
  const fallback =
    item.entityType === 'ADDON'
      ? 'Untitled add-on'
      : item.entityType === 'COSTSHEET'
        ? 'Untitled cost sheet'
        : 'Untitled plan'
  return {
    name: looked?.name || item.displayName || fallback,
    status: looked?.status || 'published',
  }
}

/**
 * Terminate a charge.
 *
 * A price is not hard-deleted; it is ended, optionally on a future date, so past
 * invoices that referenced it stay explicable. An absent `endDate` ends it now.
 */
export function useTerminatePrice() {
  const client = useFlexprice()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, endDate }: { id: string; endDate?: Date }) =>
      call(() => client.prices.deletePrice(id, endDate ? { endDate } : {})),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
    },
  })
}
