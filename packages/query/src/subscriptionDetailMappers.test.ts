import { describe, expect, it } from 'vitest'
import {
  toCreateLineItemRequest,
  toDeleteLineItemRequest,
  toPendingSchedules,
  toSubscriptionDetail,
  toSubscriptionEntitlement,
  toLineChangePreview,
  toLineItemChangeRequest,
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
    expect(detail.commitmentAmount).toEqual({ amount: '500.00', currency: 'USD' })
    expect(detail.latestInvoice).toEqual({ id: 'inv_1', number: 'INV-0001' })
    expect(detail.lookupKey).toBe('acme-pro')
  })

  it('treats a zero or absent commitment and invoice as none', () => {
    const detail = toSubscriptionDetail({ commitmentAmount: '0' })
    expect(detail.commitmentAmount).toBeNull()
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

  it('prices a new contract charge inline in the contract billing period', () => {
    expect(
      toCreateLineItemRequest(
        { name: ' Onboarding ', amount: '250.00', quantity: '2', startDate: '2026-11-01' },
        'MONTHLY',
      ),
    ).toEqual({
      displayName: 'Onboarding',
      quantity: 2,
      startDate: new Date('2026-11-01T00:00:00Z'),
      price: {
        type: 'FIXED',
        billingModel: 'FLAT_FEE',
        billingPeriod: 'MONTHLY',
        invoiceCadence: 'ADVANCE',
        priceUnitType: 'FIAT',
        amount: '250.00',
        displayName: 'Onboarding',
      },
    })
  })

  it('leaves the effective date out when the change is immediate', () => {
    expect(toUpdateLineItemRequest({ amount: '120', effectiveFrom: '' })).toEqual({ amount: '120' })
    expect(toUpdateLineItemRequest({ amount: '120', effectiveFrom: '2026-12-01' })).toEqual({
      amount: '120',
      effectiveFrom: '2026-12-01T00:00:00Z',
    })
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
