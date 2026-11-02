import { describe, expect, it } from 'vitest'
import {
  BillingModel,
  BillingPeriod,
  PriceEntityType,
  PriceType,
  PriceWindowSize,
  TierMode,
} from '@fp/domain'
import { toCharge, toChargeRequest, toTier, toUpdatePriceRequest } from './prices'

describe('toCharge', () => {
  it('maps a plan price to the charge a row renders', () => {
    const charge = toCharge({
      id: 'price_1',
      type: 'USAGE',
      billingModel: 'TIERED',
      tierMode: 'SLAB',
      tiers: [
        { upTo: 100, unitAmount: '0.5' },
        { upTo: null, unitAmount: '0.2' },
      ],
      currency: 'usd',
      billingPeriod: 'MONTHLY',
      invoiceCadence: 'ARREAR',
      meterId: 'meter_1',
      meter: { id: 'meter_1', name: 'API calls' },
      entityType: 'PLAN',
      entityId: 'plan_1',
    })
    expect(charge).toMatchObject({
      id: 'price_1',
      type: PriceType.Usage,
      billingModel: BillingModel.Tiered,
      tierMode: TierMode.Slab,
      meterId: 'meter_1',
      meterName: 'API calls',
      entityId: 'plan_1',
    })
    expect(charge.tiers).toEqual([
      { upTo: 100, unitAmount: '0.5' },
      { upTo: null, unitAmount: '0.2' },
    ])
  })

  it('falls back to the amount when the API sends no display amount', () => {
    expect(toCharge({ id: 'p', amount: '49.00' }).displayAmount).toBe('49.00')
  })
})

describe('toChargeRequest', () => {
  it('tags a flat fee with the plan it prices', () => {
    const body = toChargeRequest(
      {
        type: PriceType.Fixed,
        billingModel: BillingModel.FlatFee,
        amount: '49.00',
        currency: 'usd',
        billingPeriod: BillingPeriod.Monthly,
        invoiceCadence: 'ADVANCE',
        displayName: 'Platform',
        meterId: null,
        tierMode: TierMode.Volume,
        tiers: [],
        divideBy: 1,
      } as never,
      PriceEntityType.Plan,
      'plan_1',
    )
    expect(body).toMatchObject({
      entityType: 'PLAN',
      entityId: 'plan_1',
      amount: '49.00',
      displayName: 'Platform',
    })
    expect(body).not.toHaveProperty('meterId')
  })
})

describe('tier package size', () => {
  const sized = {
    upTo: null,
    unitAmount: '1000',
    transformQuantity: { divideBy: 100, round: 'up' },
  }

  it('reads a package band, defaulting the rounding to up', () => {
    expect(toTier({ ...sized, transformQuantity: { divideBy: 100, round: 'down' } })).toEqual({
      upTo: null,
      unitAmount: '1000',
      transformQuantity: { divideBy: 100, round: 'down' },
    })
    expect(toTier({ ...sized, transformQuantity: { divideBy: 100 } }).transformQuantity).toEqual({
      divideBy: 100,
      round: 'up',
    })
    expect(toTier({ ...sized, transformQuantity: { divideBy: 0 } })).not.toHaveProperty(
      'transformQuantity',
    )
  })

  it('sends the size only on package bands, for fiat and custom units', () => {
    const draft = {
      type: PriceType.Usage,
      billingModel: BillingModel.Tiered,
      currency: 'usd',
      billingPeriod: BillingPeriod.Monthly,
      invoiceCadence: 'ARREAR',
      meterId: 'meter_1',
      tierMode: TierMode.Slab,
      tiers: [
        { upTo: 1000, unitAmount: '0', transformQuantity: { divideBy: 0, round: 'down' } },
        sized,
      ],
    }
    const fiat = toChargeRequest(draft as never, PriceEntityType.Plan, 'plan_1')
    const custom = toChargeRequest(
      { ...draft, priceUnit: 'BTC' } as never,
      PriceEntityType.Plan,
      'plan_1',
    )
    for (const tiers of [
      fiat.tiers,
      (custom.priceUnitConfig as { priceUnitTiers: unknown }).priceUnitTiers,
    ]) {
      expect(tiers).toEqual([
        { upTo: 1000, unitAmount: '0', flatAmount: '0' },
        {
          upTo: null,
          unitAmount: '1000',
          flatAmount: '0',
          transformQuantity: { divideBy: 100, round: 'up' },
        },
      ])
    }
  })
})

describe('toUpdatePriceRequest', () => {
  it('sends only the price itself, never currency, period or meter', () => {
    const body = toUpdatePriceRequest({
      type: PriceType.Fixed,
      billingModel: BillingModel.FlatFee,
      amount: '59.00',
      currency: 'usd',
      billingPeriod: BillingPeriod.Monthly,
      invoiceCadence: 'ADVANCE',
      effectiveFrom: '2026-11-01',
      meterId: null,
      tierMode: TierMode.Volume,
      tiers: [],
      divideBy: 1,
    } as never)
    expect(body).toEqual({
      billingModel: 'FLAT_FEE',
      amount: '59.00',
      effectiveFrom: '2026-11-01T00:00:00Z',
    })
  })
})

describe('toChargeRequest price options', () => {
  it('sends the group, start date and minimum quantity of a fixed charge', () => {
    const body = toChargeRequest(
      {
        type: PriceType.Fixed,
        billingModel: BillingModel.FlatFee,
        amount: '10',
        currency: 'USD',
        billingPeriod: BillingPeriod.Monthly,
        invoiceCadence: 'ADVANCE',
        groupId: 'grp_1',
        startDate: '2030-02-01',
        minQuantity: 2,
      },
      'PLAN',
      'plan_1',
    )
    expect(body['groupId']).toBe('grp_1')
    expect(body['minQuantity']).toBe(2)
    expect((body['startDate'] as Date).toISOString()).toBe('2030-02-01T00:00:00.000Z')
  })
})

describe('usage windows', () => {
  const usage = (over: Record<string, unknown> = {}) =>
    ({
      type: PriceType.Usage,
      billingModel: BillingModel.FlatFee,
      amount: '0.01',
      currency: 'usd',
      billingPeriod: BillingPeriod.Monthly,
      invoiceCadence: 'ARREAR',
      meterId: 'meter_1',
      ...over,
    }) as never

  it('sends the window on a usage charge', () => {
    const body = toChargeRequest(
      usage({ bucketSize: PriceWindowSize.Day }),
      PriceEntityType.Plan,
      'plan_1',
    )
    expect(body['bucketSize']).toBe('DAY')
  })

  it('omits it when the charge has no window', () => {
    expect(toChargeRequest(usage(), PriceEntityType.Plan, 'plan_1')).not.toHaveProperty(
      'bucketSize',
    )
  })

  it('never sends one on a fixed charge', () => {
    // The API rejects bucket_size on a fixed price outright, and a charge
    // switched from usage to fixed can still be holding the old value.
    const body = toChargeRequest(
      usage({ type: PriceType.Fixed, meterId: undefined, bucketSize: PriceWindowSize.Hour }),
      PriceEntityType.Plan,
      'plan_1',
    )
    expect(body).not.toHaveProperty('bucketSize')
  })

  /*
   * On update the field carries three meanings, and getting them round the
   * wrong way is silent: absent inherits the existing price's window, the
   * sentinel clears it, a value replaces it. So "the user removed the window"
   * cannot be expressed by omission: it has to say `none`.
   */
  it('states the window on update rather than leaving it to inherit', () => {
    expect(toUpdatePriceRequest(usage({ bucketSize: PriceWindowSize.Hour }))['bucketSize']).toBe(
      'HOUR',
    )
  })

  it('clears the window with the sentinel, not by omitting it', () => {
    expect(toUpdatePriceRequest(usage())['bucketSize']).toBe('none')
  })

  it('says nothing about windows when updating a fixed charge', () => {
    expect(
      toUpdatePriceRequest(usage({ type: PriceType.Fixed, meterId: undefined })),
    ).not.toHaveProperty('bucketSize')
  })

  it('reads a window off the wire, and ignores one it cannot offer', () => {
    expect(toCharge({ id: 'p1', type: 'USAGE', bucketSize: 'DAY' } as never).bucketSize).toBe('DAY')
    // WEEK is a real meter-level window but not one the charge form offers, so
    // it reads as unset here rather than becoming a value the select cannot show.
    expect(toCharge({ id: 'p1', type: 'USAGE', bucketSize: 'WEEK' } as never).bucketSize).toBeNull()
    expect(toCharge({ id: 'p1', type: 'USAGE' } as never).bucketSize).toBeNull()
  })
})
