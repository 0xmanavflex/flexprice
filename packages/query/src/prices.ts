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
  type RoundType,
  type Tier,
  TierMode,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

/**
 * Charges: the translation between the product's "charge" and the API's price.
 *
 * A plan's money is not on the plan — it is a set of `Price` records tagged with
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
  createdAt?: Date | undefined
}

const PRICE_TYPES = new Set<string>(Object.values(PriceType))
const BILLING_MODELS = new Set<string>(Object.values(BillingModel))
const BILLING_PERIODS = new Set<string>(Object.values(BillingPeriod))
const INVOICE_CADENCES = new Set<string>(Object.values(InvoiceCadence))
const TIER_MODES = new Set<string>(Object.values(TierMode))

/** One tier band, snake-safe: the SDK camelCases it, but guard the shape anyway. */
function toTier(raw: { upTo?: number | null; unitAmount?: string; flatAmount?: string }): Tier {
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
    createdAt: wire.createdAt ?? null,
  }
}

/**
 * A charge draft, as a `CreatePriceRequest` for the bulk endpoint.
 *
 * The inverse of `toCharge`: fills the fields the API requires (`priceUnitType`
 * defaults to FIAT — the currency case), and sends only what the chosen billing
 * model uses. A usage charge carries its meter; a tiered charge its bands, with
 * a missing flat amount defaulted to `"0"` the way the backend expects.
 */
export function toChargeRequest(
  draft: CreateCharge,
  entityType: PriceEntityType,
  entityId: string,
): Record<string, unknown> {
  const common: Record<string, unknown> = {
    type: draft.type,
    billingModel: draft.billingModel,
    currency: draft.currency,
    billingPeriod: draft.billingPeriod,
    billingPeriodCount: 1,
    invoiceCadence: draft.invoiceCadence,
    priceUnitType: 'FIAT',
    entityType,
    entityId,
    ...(draft.displayName ? { displayName: draft.displayName } : {}),
    ...(draft.type === PriceType.Usage && draft.meterId ? { meterId: draft.meterId } : {}),
  }

  switch (draft.billingModel) {
    case BillingModel.FlatFee:
      return { ...common, amount: draft.amount }
    case BillingModel.Package:
      return {
        ...common,
        amount: draft.amount,
        transformQuantity: { divideBy: draft.divideBy },
      }
    case BillingModel.Tiered:
      return {
        ...common,
        tierMode: draft.tierMode,
        tiers: draft.tiers.map((tier) => ({
          upTo: tier.upTo,
          unitAmount: tier.unitAmount,
          flatAmount: tier.flatAmount ?? '0',
        })),
      }
  }
}

/**
 * The charges a plan (or add-on, or cost-sheet) carries.
 *
 * `expand: 'meters'` so a usage charge's row can name the feature it meters
 * without a second request. A generous `limit` because a plan's charges are a
 * handful, not a page — the detail page shows them all, not a slice.
 */
export function usePrices(entityType: PriceEntityType, entityId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.prices.list({ entityType, entityId }),
    queryFn: async () => {
      const response = await call(() =>
        client.prices.queryPrice({
          entityType,
          entityIds: [entityId],
          expand: 'meters',
          limit: 100,
          offset: 0,
        } as never),
      )
      return (response.items ?? []).map((item) => toCharge(item as ChargeWire))
    },
    // A plan with no id yet (a create in flight) has no charges to fetch.
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

/** Update one charge's amount or model in place. */
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
      call(() => client.prices.deletePrice(id, (endDate ? { endDate } : {}) as never)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prices.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all() })
    },
  })
}
