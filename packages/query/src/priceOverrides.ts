import { BillingModel, type PriceOverride, type RoundType } from '@fp/domain'
import { tierPackageFields } from './prices'

/**
 * A domain override, in the shape the API takes.
 *
 * `overrideLineItems` rides on `CreateSubscriptionRequest` and the addon
 * requests, so this step is a slice of the eventual subscription wizard rather
 * than an endpoint of its own. Writing the mapping now means the wizard
 * assembles validated domain values and converts once, at the edge.
 *
 * The translation is small and one-directional on purpose: every field the API
 * accepts but the product does not offer stays absent, instead of being
 * threaded through the form as an untouched `undefined`.
 */
export interface OverrideLineItem {
  priceId: string
  billingModel: string
  amount?: string
  tierMode?: string
  tiers?: {
    upTo?: number
    unitAmount: string
    flatAmount?: string
    transformQuantity?: { divideBy: number; round: RoundType }
  }[]
  transformQuantity?: { divideBy: number }
  bucketSize?: string
}

export function toOverrideLineItem(override: PriceOverride): OverrideLineItem {
  const line = toPricedLine(override)
  return override.bucketSize ? { ...line, bucketSize: override.bucketSize } : line
}

function toPricedLine(override: PriceOverride): OverrideLineItem {
  switch (override.billingModel) {
    case BillingModel.FlatFee:
      return {
        priceId: override.priceId,
        billingModel: override.billingModel,
        amount: override.amount,
      }

    case BillingModel.Package:
      return {
        priceId: override.priceId,
        billingModel: override.billingModel,
        amount: override.amount,
        transformQuantity: { divideBy: override.divideBy },
      }

    case BillingModel.Tiered:
      return {
        priceId: override.priceId,
        billingModel: override.billingModel,
        tierMode: override.tierMode,
        tiers: override.tiers.map((tier) => ({
          // The open band is an absent up_to. The create-contract schema
          // rejects null (`expected number, received null`).
          ...(tier.upTo == null ? {} : { upTo: tier.upTo }),
          unitAmount: tier.unitAmount,
          ...(tier.flatAmount ? { flatAmount: tier.flatAmount } : {}),
          ...tierPackageFields(tier),
        })),
      }
  }
}
