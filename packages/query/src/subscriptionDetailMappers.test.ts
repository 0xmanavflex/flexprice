import { describe, expect, it } from 'vitest'
import { NO_USAGE_TERMS } from '@fp/domain'
import {
  toCreateLineItemRequest,
  toDeleteLineItemRequest,
  toPendingSchedules,
  toSubscriptionDetail,
  toSubscriptionEntitlement,
  toLineChangePreview,
  toLineItemChangeRequest,
  toLineBucket,
  toSubscriptionLine,
  toSubscriptionUsage,
  toUpdateLineItemRequest,
} from './subscriptions'

describe('subscription detail mappers', () => {
  it('keeps price amounts as strings and classifies the line', () => {
    const line = toSubscriptionLine({
      id: 'l1',
      planDisplayName: 'Pro',
      priceType: 'USAGE',
      billingPeriod: 'MONTHLY',
      price: { amount: '0.0020', currency: 'usd' },
    })
    expect(line.kind).toBe('usage')
    expect(line.name).toBe('Pro')
    expect(line.amount.amount).toBe('0.0020')
    expect(line.billingPeriodLabel).toBe('Monthly')
  })

  it('falls back on the subscription currency', () => {
    expect(toSubscriptionLine({ currency: 'EUR', price: { amount: '5' } }).amount.currency).toBe(
      'EUR',
    )
  })

  it('maps entitlements, treating a missing limit as unlimited', () => {
    expect(toSubscriptionEntitlement({ feature: { id: 'f', name: 'SSO' } })).toMatchObject({
      name: 'SSO',
      enabled: false,
      usageLimit: null,
      resetPeriodLabel: '',
    })
    expect(
      toSubscriptionEntitlement({
        feature: { id: 'f' },
        entitlement: { isEnabled: true, usageLimit: 10, usageResetPeriod: 'MONTHLY' },
      }),
    ).toMatchObject({ enabled: true, usageLimit: 10, resetPeriodLabel: 'Monthly' })
  })

  it('carries metadata and terms on the detail', () => {
    const detail = toSubscriptionDetail({ metadata: { a: 'b' }, paymentTerms: 'NET_30' })
    expect(detail.metadata).toEqual({ a: 'b' })
    expect(detail.paymentTerms).toBe('NET_30')
  })
})

describe('unset Go times', () => {
  it('maps the zero time to null so open-ended charges are not treated as ended', () => {
    const zero = new Date('0001-01-01T00:00:00Z')
    const line = toSubscriptionLine({ startDate: zero, endDate: zero })
    expect(line.startDate).toBeNull()
    expect(line.endDate).toBeNull()
    const real = new Date('2026-01-01T00:00:00Z')
    expect(toSubscriptionLine({ startDate: real, endDate: real }).endDate).toEqual(real)
  })
})

describe('subscription detail additions', () => {
  it('reads commitment, trial start and latest invoice', () => {
    const detail = toSubscriptionDetail({
      currency: 'usd',
      commitmentAmount: '500.00',
      trialStart: new Date('2026-01-01'),
      timezone: 'UTC',
      lookupKey: 'acme-pro',
      latestInvoice: { id: 'inv_1', invoiceNumber: 'INV-0001' },
    })
    expect(detail.commitment).toEqual({
      amount: { amount: '500.00', currency: 'USD' },
      period: 'MONTHLY',
      periodCount: 1,
      overageFactor: 1,
      trueUp: false,
    })
    expect(detail.latestInvoice).toEqual({ id: 'inv_1', number: 'INV-0001' })
    expect(detail.lookupKey).toBe('acme-pro')
  })

  it('reads the overage factor, true-up and a commitment period of its own', () => {
    const detail = toSubscriptionDetail({
      currency: 'usd',
      billingPeriod: 'MONTHLY',
      billingPeriodCount: 1,
      commitmentAmount: '30000',
      commitmentDuration: 'ANNUAL',
      overageFactor: '1.2',
      enableTrueUp: true,
    })
    expect(detail.commitment).toEqual({
      amount: { amount: '30000', currency: 'USD' },
      period: 'ANNUAL',
      periodCount: 1,
      overageFactor: 1.2,
      trueUp: true,
    })
  })

  it('measures a commitment with no period of its own over the billing period', () => {
    const quarterly = toSubscriptionDetail({
      billingPeriod: 'MONTHLY',
      billingPeriodCount: 3,
      commitmentAmount: '900',
    })
    expect(quarterly.commitment).toMatchObject({ period: 'MONTHLY', periodCount: 3 })
    // A duration equal to the billing period is the billing period, count and all.
    const same = toSubscriptionDetail({
      billingPeriod: 'MONTHLY',
      billingPeriodCount: 3,
      commitmentAmount: '900',
      commitmentDuration: 'MONTHLY',
    })
    expect(same.commitment).toMatchObject({ period: 'MONTHLY', periodCount: 3 })
  })

  it('keeps a latest invoice with no number', () => {
    const detail = toSubscriptionDetail({
      latestInvoice: { id: 'inv_1' },
    })
    expect(detail.latestInvoice).toEqual({ id: 'inv_1', number: '' })
  })

  it('treats a zero or absent commitment and invoice as none', () => {
    const detail = toSubscriptionDetail({ commitmentAmount: '0', overageFactor: '1.5' })
    expect(detail.commitment).toBeNull()
    expect(toSubscriptionDetail({ overageFactor: '1', enableTrueUp: false }).commitment).toBeNull()
    expect(detail.latestInvoice).toBeNull()
  })
})

describe('toSubscriptionUsage', () => {
  it('maps charges and the commitment', () => {
    const usage = toSubscriptionUsage({
      amount: 120.5,
      currency: 'usd',
      commitmentAmount: 100,
      commitmentUtilized: 100,
      overageAmount: 20.5,
      hasOverage: true,
      charges: [
        { meterDisplayName: 'API calls', quantity: 4200, amount: 0.0000001, meterId: 'm1' },
        { quantity: 1, amount: 20.5, isOverage: true, subscriptionLineItemId: 'li_2' },
      ],
    })
    expect(usage.total.amount).toBe('120.5')
    expect(usage.commitment?.amount).toBe('100')
    expect(usage.overage?.amount).toBe('20.5')
    expect(usage.charges[0]?.name).toBe('API calls')
    expect(usage.charges[0]?.amount.amount).toBe('0.0000001')
    expect(usage.charges[1]).toMatchObject({ id: 'li_2', name: 'Usage', isOverage: true })
  })

  it('is total for an empty response', () => {
    const usage = toSubscriptionUsage({})
    expect(usage.total.amount).toBe('0')
    expect(usage.commitment).toBeNull()
    expect(usage.charges).toEqual([])
  })
})

describe('toPendingSchedules', () => {
  it('keeps only pending, known schedule types', () => {
    const schedules = toPendingSchedules([
      { id: 's1', scheduleType: 'plan_change', status: 'pending', canBeCancelled: true },
      { id: 's2', scheduleType: 'cancellation', status: 'executed' },
      { id: 's3', scheduleType: 'something_new', status: 'pending' },
    ])
    expect(schedules.map((s) => s.id)).toEqual(['s1'])
    expect(schedules[0]?.canBeCancelled).toBe(true)
  })

  it('marks where a charge comes from', () => {
    expect(toSubscriptionLine({ entityType: 'plan' }).source).toBe('plan')
    expect(toSubscriptionLine({ entityType: 'addon' }).source).toBe('addon')
    expect(toSubscriptionLine({ entityType: 'subscription' }).source).toBe('contract')
    expect(toSubscriptionLine({}).source).toBe('plan')
  })

  it('prices a new fixed contract charge inline, with quantity, start date and proration', () => {
    const request = toCreateLineItemRequest({
      charge: {
        type: 'FIXED',
        billingModel: 'FLAT_FEE',
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        invoiceCadence: 'ADVANCE',
        displayName: 'Onboarding',
        amount: '250.00',
      },
      quantity: '2',
      startDate: '2026-11-01',
      proration: 'none',
      terms: NO_USAGE_TERMS,
    })
    expect(request).toEqual({
      displayName: 'Onboarding',
      quantity: 2,
      startDate: new Date('2026-11-01T00:00:00Z'),
      prorationBehavior: 'none',
      price: {
        type: 'FIXED',
        billingModel: 'FLAT_FEE',
        billingPeriod: 'MONTHLY',
        billingPeriodCount: 1,
        invoiceCadence: 'ADVANCE',
        priceUnitType: 'FIAT',
        displayName: 'Onboarding',
        amount: '250.00',
      },
    })
  })

  it('sends a metered charge with its meter, bands, bucket and commitment: and no quantity', () => {
    const request = toCreateLineItemRequest({
      charge: {
        type: 'USAGE',
        billingModel: 'TIERED',
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        invoiceCadence: 'ARREAR',
        meterId: 'meter_1',
        tierMode: 'SLAB',
        tiers: [
          { upTo: 1000, unitAmount: '0.01' },
          { upTo: null, unitAmount: '0.005', flatAmount: '2' },
        ],
      },
      quantity: '1',
      startDate: '',
      proration: 'create_prorations',
      terms: {
        bucketSize: 'DAY',
        commitment: {
          kind: 'amount',
          value: '500',
          windowed: true,
          overageFactor: '1.5',
          trueUp: true,
        },
      },
    })
    expect(request).toMatchObject({
      price: {
        type: 'USAGE',
        billingModel: 'TIERED',
        meterId: 'meter_1',
        tierMode: 'SLAB',
        bucketSize: 'DAY',
        tiers: [
          { upTo: 1000, unitAmount: '0.01', flatAmount: '0' },
          { upTo: null, unitAmount: '0.005', flatAmount: '2' },
        ],
      },
      commitmentType: 'amount',
      commitmentAmount: 500,
      commitmentWindowed: true,
      commitmentOverageFactor: 1.5,
      commitmentTrueUpEnabled: true,
    })
    expect(request).not.toHaveProperty('quantity')
    expect(request).not.toHaveProperty('prorationBehavior')
    expect(request).not.toHaveProperty('startDate')
    expect(request['price']).not.toHaveProperty('currency')
    expect(request['price']).not.toHaveProperty('entityId')
  })

  it("sends a commitment's own period, and per bucket only when there are buckets", () => {
    const usage = {
      type: 'USAGE',
      billingModel: 'FLAT_FEE',
      currency: 'USD',
      billingPeriod: 'MONTHLY',
      invoiceCadence: 'ARREAR',
      amount: '0.01',
      meterId: 'meter_1',
    } as Parameters<typeof toCreateLineItemRequest>[0]['charge']
    const request = toCreateLineItemRequest({
      charge: usage,
      quantity: '1',
      startDate: '',
      proration: 'create_prorations',
      terms: {
        bucketSize: '',
        commitment: {
          kind: 'amount',
          value: '500',
          windowed: true,
          overageFactor: '1',
          trueUp: false,
          duration: 'QUARTERLY',
        },
      },
    } as Parameters<typeof toCreateLineItemRequest>[0])
    expect(request).toMatchObject({ commitmentDuration: 'QUARTERLY', commitmentWindowed: false })
  })

  it('sends a quantity commitment as a quantity', () => {
    const request = toCreateLineItemRequest({
      charge: {
        type: 'USAGE',
        billingModel: 'FLAT_FEE',
        currency: 'USD',
        billingPeriod: 'MONTHLY',
        invoiceCadence: 'ARREAR',
        meterId: 'm',
        amount: '0.02',
      },
      quantity: '1',
      startDate: '',
      proration: 'create_prorations',
      terms: {
        bucketSize: '',
        commitment: {
          kind: 'quantity',
          value: '1000',
          windowed: false,
          overageFactor: '1',
          trueUp: false,
        },
      },
    })
    expect(request).toMatchObject({ commitmentType: 'quantity', commitmentQuantity: 1000 })
    expect(request).not.toHaveProperty('commitmentAmount')
  })

  describe('editing a metered charge', () => {
    const edit = {
      priceUnit: '',
      effectiveFrom: '',
      terms: NO_USAGE_TERMS,
    }

    it('sends a flat amount, leaving the date out when the change is immediate', () => {
      const price = { priceId: 'p', billingModel: 'FLAT_FEE', amount: '120' } as const
      expect(toUpdateLineItemRequest({ ...edit, price })).toEqual({
        billingModel: 'FLAT_FEE',
        amount: '120',
      })
      expect(toUpdateLineItemRequest({ ...edit, price, effectiveFrom: '2026-12-01' })).toEqual({
        billingModel: 'FLAT_FEE',
        amount: '120',
        effectiveFrom: '2026-12-01T00:00:00Z',
      })
    })

    it('clears a stored commitment period when the edit goes back to the billing period', () => {
      const price = { priceId: 'p', billingModel: 'FLAT_FEE', amount: '120' } as const
      const commitment = {
        kind: 'amount',
        value: '500',
        windowed: false,
        overageFactor: '1',
        trueUp: false,
      } as const
      expect(
        toUpdateLineItemRequest({
          ...edit,
          price,
          terms: { bucketSize: '', commitment: { ...commitment, duration: null } },
        } as Parameters<typeof toUpdateLineItemRequest>[0]),
      ).toMatchObject({ commitmentDuration: '' })
      expect(
        toUpdateLineItemRequest({
          ...edit,
          price,
          terms: { bucketSize: '', commitment: { ...commitment, duration: 'WEEKLY' } },
        } as Parameters<typeof toUpdateLineItemRequest>[0]),
      ).toMatchObject({ commitmentDuration: 'WEEKLY' })
    })

    it('sends a package size and a tier table in the price unit when the price has one', () => {
      expect(
        toUpdateLineItemRequest({
          ...edit,
          price: { priceId: 'p', billingModel: 'PACKAGE', amount: '2', divideBy: 1000 },
        }),
      ).toEqual({
        billingModel: 'PACKAGE',
        amount: '2',
        transformQuantity: { divideBy: 1000 },
      })
      expect(
        toUpdateLineItemRequest({
          ...edit,
          priceUnit: 'TOK',
          price: {
            priceId: 'p',
            billingModel: 'TIERED',
            tierMode: 'VOLUME',
            tiers: [{ upTo: null, unitAmount: '3' }],
          },
        }),
      ).toEqual({
        billingModel: 'TIERED',
        tierMode: 'VOLUME',
        priceUnitTiers: [{ upTo: null, unitAmount: '3', flatAmount: '0' }],
      })
    })

    it('carries the bucket and commitment', () => {
      expect(
        toUpdateLineItemRequest({
          ...edit,
          price: { priceId: 'p', billingModel: 'FLAT_FEE', amount: '1' },
          terms: {
            bucketSize: 'HOUR',
            commitment: {
              kind: 'amount',
              value: '40',
              windowed: false,
              overageFactor: '2',
              trueUp: false,
            },
          },
        }),
      ).toMatchObject({
        bucketSize: 'HOUR',
        commitmentType: 'amount',
        commitmentAmount: 40,
        commitmentOverageFactor: 2,
      })
    })
  })

  it('reads how a line is priced, for editing', () => {
    const line = toSubscriptionLine({
      id: 'l1',
      priceType: 'USAGE',
      billingPeriod: 'MONTHLY',
      currency: 'usd',
      meterId: 'm1',
      commitmentType: 'quantity',
      commitmentQuantity: '5000',
      commitmentOverageFactor: '1.2',
      commitmentTrueUpEnabled: true,
      price: {
        billingModel: 'TIERED',
        tierMode: 'SLAB',
        bucketSize: 'DAY',
        tiers: [
          { upTo: 100, unitAmount: '1' },
          { unitAmount: '0.5', flatAmount: '3' },
        ],
      },
    })
    expect(line.pricing).toEqual({
      billingModel: 'TIERED',
      tierMode: 'SLAB',
      tiers: [
        { upTo: 100, unitAmount: '1' },
        { upTo: null, unitAmount: '0.5', flatAmount: '3' },
      ],
      divideBy: null,
      priceUnit: '',
      meterId: 'm1',
      billingPeriod: 'MONTHLY',
      currency: 'USD',
      terms: {
        bucketSize: 'DAY',
        commitment: {
          kind: 'quantity',
          value: '5000',
          windowed: false,
          overageFactor: '1.2',
          trueUp: true,
        },
      },
    })
    expect(toSubscriptionLine({ id: 'l2' }).pricing).toBeNull()
  })

  it('reads a windowed commitment’s UTC windows', () => {
    const line = toSubscriptionLine({
      priceType: 'USAGE',
      commitmentType: 'quantity',
      commitmentQuantity: '10',
      commitmentWindowed: true,
      commitmentDuration: 'MONTHLY',
      price: { billingModel: 'FLAT_FEE', amount: '0.02' },
      commitmentTimeBuckets: [
        {
          id: 'morning',
          commitmentValue: '30',
          start: { hour: 0, minute: 0 },
          end: { hour: 8, minute: 30 },
          overageFactor: 1.5,
          trueUpEnabled: false,
          priceId: 'price_window',
        },
      ],
    })
    expect(line.pricing?.terms.commitment).toEqual({
      kind: 'quantity',
      value: '10',
      windowed: true,
      overageFactor: '1',
      trueUp: false,
      duration: 'MONTHLY',
      windows: [
        {
          id: 'morning',
          start: '00:00',
          end: '08:30',
          value: '30',
          overageFactor: '1.5',
          trueUp: false,
          priceId: 'price_window',
        },
      ],
    })
  })

  it('reads a custom price unit’s amounts, not the currency ones', () => {
    const line = toSubscriptionLine({
      priceType: 'USAGE',
      price: {
        billingModel: 'TIERED',
        priceUnitType: 'CUSTOM',
        priceUnit: 'TOK',
        tiers: [{ unitAmount: '9' }],
        priceUnitTiers: [{ unitAmount: '3' }],
      },
    })
    expect(line.pricing?.priceUnit).toBe('TOK')
    expect(line.pricing?.tiers).toEqual([{ upTo: null, unitAmount: '3' }])
  })

  it('leaves the end date out when the end is immediate', () => {
    expect(toDeleteLineItemRequest({ effectiveFrom: '' })).toEqual({})
    expect(toDeleteLineItemRequest({ effectiveFrom: '2026-12-01' })).toEqual({
      effectiveFrom: '2026-12-01T00:00:00Z',
    })
  })
})

describe('line item change', () => {
  const line = {
    id: 'li_1',
    quantity: '2',
    amount: { amount: '100', currency: 'USD' },
    amountEditable: true,
  }

  it('sends only what changed, with the date as a Date', () => {
    const request = toLineItemChangeRequest(line, {
      quantity: '5',
      amount: '100',
      effectiveDate: '2026-10-15',
    }) as { type: string; lineItemChangeParams: { lineItems: Record<string, unknown>[] } }
    expect(request.type).toBe('line_item_change')
    expect(request.lineItemChangeParams.lineItems).toEqual([
      { id: 'li_1', quantity: '5', effectiveDate: new Date('2026-10-15T00:00:00Z') },
    ])
  })

  it('never sends a price for a charge whose price cannot change', () => {
    const request = toLineItemChangeRequest(
      { ...line, amountEditable: false },
      { quantity: '', amount: '250', effectiveDate: '' },
    ) as { lineItemChangeParams: { lineItems: Record<string, unknown>[] } }
    expect(request.lineItemChangeParams.lineItems).toEqual([{ id: 'li_1' }])
  })

  it('reads a preview into changed lines and invoices', () => {
    const preview = toLineChangePreview({
      changedResources: {
        lineItems: [{ id: 'li_2', changeAction: 'created', quantity: '5' }],
        invoices: [
          { action: 'created', status: 'draft', invoice: { amountDue: '60', currency: 'usd' } },
        ],
      },
    })
    expect(preview.lines[0]).toMatchObject({ action: 'created', quantity: '5' })
    expect(preview.invoices[0]?.amountDue?.amount).toBe('60')
  })

  it('marks only flat-fee, non-custom fixed prices as editable', () => {
    const editable = (priceType: string, billingModel: string, priceUnitType: string) =>
      toSubscriptionLine({ priceType, price: { billingModel, priceUnitType } }).amountEditable
    expect(editable('FIXED', 'FLAT_FEE', 'FIAT')).toBe(true)
    expect(editable('FIXED', 'FLAT_FEE', 'CUSTOM')).toBe(false)
    expect(editable('FIXED', 'PACKAGE', 'FIAT')).toBe(false)
    expect(editable('USAGE', 'FLAT_FEE', 'FIAT')).toBe(false)
  })
})

describe('the price a line carries', () => {
  it('is the embedded price, read as a charge', () => {
    const line = toSubscriptionLine({
      priceId: 'price_api',
      priceType: 'USAGE',
      price: {
        id: 'ignored_in_favour_of_price_id',
        amount: '0.002',
        displayAmount: '$0.002',
        currency: 'usd',
        billingModel: 'TIERED',
        tierMode: 'SLAB',
        billingPeriod: 'MONTHLY',
        invoiceCadence: 'ARREAR',
      },
    })

    expect(line.charge?.id).toBe('price_api')
    expect(line.charge?.displayAmount).toBe('$0.002')
    expect(line.charge?.billingModel).toBe('TIERED')
  })

  it('has no charge when the API sent no price', () => {
    expect(toSubscriptionLine({ priceId: 'price_x' }).charge).toBeNull()
  })

  it('reports the plan price it overrides, and nothing when it overrides none', () => {
    expect(
      toSubscriptionLine({ price: { amount: '1', parentPriceId: 'price_plan' } }).overridesPriceId,
    ).toBe('price_plan')
    expect(toSubscriptionLine({ price: { amount: '1' } }).overridesPriceId).toBe('')
  })
})

describe('toLineBucket', () => {
  it('reads a bucket as long as the billing period as the whole period', () => {
    expect(toLineBucket('MONTH', 'MONTHLY')).toBe('')
    expect(toLineBucket('WEEK', 'WEEKLY')).toBe('')
  })

  it('keeps a real window, and drops values the form cannot show', () => {
    expect(toLineBucket('DAY', 'MONTHLY')).toBe('DAY')
    expect(toLineBucket('MONTH', 'ANNUAL')).toBe('MONTH')
    expect(toLineBucket('FORTNIGHT', 'MONTHLY')).toBe('')
    expect(toLineBucket(undefined, 'MONTHLY')).toBe('')
  })
})
