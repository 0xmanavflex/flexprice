import { describe, expect, it } from 'vitest'
import { BillingModel, TierMode, priceOverrideSchema } from '@fp/domain'
import { toOverrideLineItem } from './priceOverrides'

/** Only validated domain values reach the mapper, so tests parse first. */
const valid = (value: unknown) => priceOverrideSchema.parse(value)

describe('toOverrideLineItem', () => {
  it('maps a flat fee without inventing tier fields', () => {
    const result = toOverrideLineItem(
      valid({ priceId: 'p1', billingModel: BillingModel.FlatFee, amount: '9.99' }),
    )

    expect(result).toEqual({ priceId: 'p1', billingModel: 'FLAT_FEE', amount: '9.99' })
    expect(result).not.toHaveProperty('tiers')
    expect(result).not.toHaveProperty('transformQuantity')
  })

  it('nests the package size the way the API expects', () => {
    expect(
      toOverrideLineItem(
        valid({ priceId: 'p1', billingModel: BillingModel.Package, amount: '10', divideBy: 1000 }),
      ),
    ).toEqual({
      priceId: 'p1',
      billingModel: 'PACKAGE',
      amount: '10',
      transformQuantity: { divideBy: 1000 },
    })
  })

  it('preserves tier order and the unbounded final band', () => {
    const result = toOverrideLineItem(
      valid({
        priceId: 'p1',
        billingModel: BillingModel.Tiered,
        tierMode: TierMode.Slab,
        tiers: [
          { upTo: 100, unitAmount: '0.10' },
          { upTo: null, unitAmount: '0.05' },
        ],
      }),
    )

    expect(result.tierMode).toBe('SLAB')
    expect(result.tiers).toEqual([
      { upTo: 100, unitAmount: '0.10' },
      { unitAmount: '0.05' },
    ])
    expect(result.tiers?.[1]).not.toHaveProperty('upTo')
  })

  it('omits an absent flat amount rather than sending an empty one', () => {
    const result = toOverrideLineItem(
      valid({
        priceId: 'p1',
        billingModel: BillingModel.Tiered,
        tierMode: TierMode.Volume,
        tiers: [{ upTo: null, unitAmount: '0.05' }],
      }),
    )
    expect(result.tiers?.[0]).not.toHaveProperty('flatAmount')
  })

  // Amounts stay strings the whole way. A float here would be a rounding bug
  // shipped straight into a subscription.
  it('keeps amounts as exact decimal strings', () => {
    const result = toOverrideLineItem(
      valid({
        priceId: 'p1',
        billingModel: BillingModel.FlatFee,
        amount: '12345678901234567.89',
      }),
    )
    expect(result.amount).toBe('12345678901234567.89')
  })
})

describe('toOverrideLineItem with a bucket size', () => {
  it('sends the bucket size a usage override chose, and none when it kept the charge’s own', () => {
    expect(
      toOverrideLineItem(
        valid({
          priceId: 'price_api',
          billingModel: BillingModel.FlatFee,
          amount: '0.01',
          bucketSize: 'HOUR',
        }),
      ),
    ).toMatchObject({ priceId: 'price_api', bucketSize: 'HOUR' })
    expect(
      toOverrideLineItem(
        valid({
          priceId: 'price_api',
          billingModel: BillingModel.FlatFee,
          amount: '0.01',
          bucketSize: '',
        }),
      ),
    ).not.toHaveProperty('bucketSize')
  })

  it('refuses a bucket size the API does not know', () => {
    expect(() =>
      valid({
        priceId: 'price_api',
        billingModel: BillingModel.FlatFee,
        amount: '0.01',
        bucketSize: 'FORTNIGHT',
      }),
    ).toThrow()
  })
})
