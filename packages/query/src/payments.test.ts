import { describe, expect, it } from 'vitest'
import { DEFAULT_PAYMENT_QUERY, PaymentStatus } from '@fp/domain'
import { toPayment, toPaymentFilter } from './payments'

describe('toPayment', () => {
  it('joins the amount and currency into a Money', () => {
    const payment = toPayment({
      id: 'pay_1',
      amount: '50.00',
      currency: 'usd',
      paymentStatus: 'SUCCEEDED',
    })

    expect(payment.amount).toEqual({ amount: '50.00', currency: 'USD' })
    expect(payment.status).toBe(PaymentStatus.Succeeded)
  })

  it('defaults a missing amount to zero rather than crashing', () => {
    expect(toPayment({ paymentStatus: 'PENDING' }).amount).toEqual({ amount: '0', currency: 'USD' })
  })

  it.each([
    ['INITIATED', PaymentStatus.Pending],
    ['PENDING', PaymentStatus.Pending],
    ['PROCESSING', PaymentStatus.Pending],
    ['SUCCEEDED', PaymentStatus.Succeeded],
    ['OVERPAID', PaymentStatus.Overpaid],
    ['FAILED', PaymentStatus.Failed],
    ['REFUNDED', PaymentStatus.Refunded],
    ['PARTIALLY_REFUNDED', PaymentStatus.Refunded],
    ['VOIDED', PaymentStatus.Voided],
  ])('maps the wire status %s to %s', (wire, expected) => {
    expect(toPayment({ paymentStatus: wire }).status).toBe(expected)
  })

  it('folds a partial refund into refunded', () => {
    expect(toPayment({ paymentStatus: 'PARTIALLY_REFUNDED' }).status).toBe(PaymentStatus.Refunded)
  })

  it('treats an unknown or missing status as pending', () => {
    expect(toPayment({ paymentStatus: 'MYSTERY' }).status).toBe(PaymentStatus.Pending)
    expect(toPayment({}).status).toBe(PaymentStatus.Pending)
  })

  it('falls back to empty strings for method and invoice, and null for dates', () => {
    const payment = toPayment({ paymentStatus: 'PENDING' })
    expect(payment.methodType).toBe('')
    expect(payment.invoiceNumber).toBe('')
    expect(payment.createdAt).toBeNull()
    expect(payment.succeededAt).toBeNull()
  })

  it('carries method, invoice and dates through when present', () => {
    const created = new Date('2026-01-01T00:00:00Z')
    const succeeded = new Date('2026-01-02T00:00:00Z')
    const payment = toPayment({
      paymentStatus: 'SUCCEEDED',
      paymentMethodType: 'card',
      invoiceNumber: 'INV-0007',
      createdAt: created,
      succeededAt: succeeded,
    })

    expect(payment.methodType).toBe('card')
    expect(payment.invoiceNumber).toBe('INV-0007')
    expect(payment.createdAt).toBe(created)
    expect(payment.succeededAt).toBe(succeeded)
  })
})

describe('toPayment billing entity', () => {
  it('keeps the billing entity, and leaves it off when the wire has none', () => {
    expect(toPayment({ billingEntityId: 'be_1' }).billingEntityId).toBe('be_1')
    expect(toPayment({})).not.toHaveProperty('billingEntityId')
  })
})

describe('toPaymentFilter', () => {
  it('turns the page and size into a limit and offset', () => {
    const filter = toPaymentFilter({ ...DEFAULT_PAYMENT_QUERY, page: 3, pageSize: 25 })
    expect(filter).toMatchObject({ limit: 25, offset: 50 })
  })

  it('sends the chosen order as the API column and direction', () => {
    expect(toPaymentFilter({ ...DEFAULT_PAYMENT_QUERY, sortDirection: 'asc' })).toMatchObject({
      sort: 'created_at',
      order: 'asc',
    })
  })

  it('offsets to zero on the first page', () => {
    expect(toPaymentFilter({ ...DEFAULT_PAYMENT_QUERY, page: 1, pageSize: 25 })).toMatchObject({
      limit: 25,
      offset: 0,
    })
  })
})
