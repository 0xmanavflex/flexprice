import { describe, expect, it } from 'vitest'
import {
  hostedInvoiceState,
  paymentMethodLabel,
  toHostedInvoice,
  toPaymentActionUrl,
  toPresignedUrl,
} from './hostedInvoice'

/** Trimmed from a real `GET /public/v1/invoices` answered by the local stack. */
function wire(overrides: { invoice?: Record<string, unknown>; tenant?: Record<string, unknown>; payments?: unknown; pay?: unknown } = {}) {
  return {
    tenant: {
      name: 'Default Tenant',
      billing_details: { email: 'billing@acme.test', help_email: 'help@acme.test', address: {} },
      ...overrides.tenant,
    },
    invoice: {
      id: 'inv_01M58D16AK0WHY9KTQ2TY4HBYW',
      invoice_status: 'FINALIZED',
      payment_status: 'PENDING',
      currency: 'inr',
      amount_paid: '0',
      subtotal: '8800',
      total: '8800',
      total_discount: '0',
      total_tax: '0',
      amount_remaining: '8800',
      invoice_number: 'INV-202610-01512',
      description: 'Invoice for advance charges',
      due_date: '2026-11-15T00:00:00Z',
      paid_at: null,
      customer: { name: 'Acme Robotics', email: 'ap@acme.test' },
      line_items: [
        { id: 'li_1', display_name: 'Platform fee', amount: '8000', quantity: '1' },
        { id: 'li_2', display_name: 'API calls', amount: '800', quantity: '4000' },
      ],
      ...overrides.invoice,
    },
    payments: overrides.payments ?? [],
    pay: overrides.pay ?? { enabled: true },
  }
}

describe('hostedInvoiceState', () => {
  it('voided wins over everything', () => {
    expect(hostedInvoiceState('VOIDED', 'SUCCEEDED')).toBe('voided')
  })

  it.each(['SUCCEEDED', 'OVERPAID', 'REFUNDED', 'PARTIALLY_REFUNDED'])('%s is paid', (status) => {
    expect(hostedInvoiceState('FINALIZED', status)).toBe('paid')
  })

  it('processing payment is processing', () => {
    expect(hostedInvoiceState('FINALIZED', 'PROCESSING')).toBe('processing')
  })

  it.each(['PENDING', 'FAILED'])('%s is open', (status) => {
    expect(hostedInvoiceState('FINALIZED', status)).toBe('open')
  })
})

describe('toHostedInvoice', () => {
  it('maps a full response', () => {
    const invoice = toHostedInvoice(wire())

    expect(invoice.number).toBe('INV-202610-01512')
    expect(invoice.state).toBe('open')
    expect(invoice.total).toEqual({ amount: '8800', currency: 'INR' })
    expect(invoice.amountRemaining).toEqual({ amount: '8800', currency: 'INR' })
    expect(invoice.tenant).toEqual({ name: 'Default Tenant', contactEmail: 'help@acme.test' })
    expect(invoice.customerName).toBe('Acme Robotics')
    expect(invoice.memo).toBe('Invoice for advance charges')
    expect(invoice.dueAt).toEqual(new Date('2026-11-15T00:00:00Z'))
    expect(invoice.lines).toEqual([
      { id: 'li_1', name: 'Platform fee', quantity: '1', amount: { amount: '8000', currency: 'INR' } },
      { id: 'li_2', name: 'API calls', quantity: '4000', amount: { amount: '800', currency: 'INR' } },
    ])
    expect(invoice.payEnabled).toBe(true)
  })

  it('falls back to the billing email, then to none', () => {
    expect(toHostedInvoice(wire({ tenant: { billing_details: { email: 'billing@acme.test' } } })).tenant.contactEmail).toBe(
      'billing@acme.test',
    )
    expect(toHostedInvoice(wire({ tenant: { billing_details: null } })).tenant.contactEmail).toBeNull()
  })

  it('leaves out zero or missing discount and tax', () => {
    const none = toHostedInvoice(wire({ invoice: { total_tax: undefined } }))
    expect(none.discount).toBeNull()
    expect(none.tax).toBeNull()

    const both = toHostedInvoice(wire({ invoice: { total_discount: '100', total_tax: '18' } }))
    expect(both.discount).toEqual({ amount: '100', currency: 'INR' })
    expect(both.tax).toEqual({ amount: '18', currency: 'INR' })
  })

  it('takes the paid date from the invoice, else the latest succeeded payment', () => {
    const payments = [
      { id: 'pay_1', amount: '8800', currency: 'inr', payment_status: 'FAILED', payment_gateway: 'stripe', payment_method_type: 'CARD', created_at: '2026-10-13T08:00:00Z', succeeded_at: null, failed_at: '2026-10-13T08:01:00Z' },
      { id: 'pay_2', amount: '8800', currency: 'inr', payment_status: 'SUCCEEDED', payment_gateway: 'stripe', payment_method_type: 'PAYMENT_LINK', created_at: '2026-10-14T08:00:00Z', succeeded_at: '2026-10-14T08:01:00Z', failed_at: null },
    ]
    const fromPayment = toHostedInvoice(wire({ invoice: { payment_status: 'SUCCEEDED' }, payments }))
    expect(fromPayment.state).toBe('paid')
    expect(fromPayment.paidAt).toEqual(new Date('2026-10-14T08:01:00Z'))
    expect(fromPayment.paidWith).toBe('Stripe')
    expect(fromPayment.payments.map((p) => p.status)).toEqual(['FAILED', 'SUCCEEDED'])

    const fromInvoice = toHostedInvoice(wire({ invoice: { payment_status: 'SUCCEEDED', paid_at: '2026-10-15T00:00:00Z' }, payments }))
    expect(fromInvoice.paidAt).toEqual(new Date('2026-10-15T00:00:00Z'))
  })

  it('survives a sparse response', () => {
    const sparse = toHostedInvoice({
      tenant: {},
      invoice: { invoice_status: 'FINALIZED', payment_status: 'PENDING', currency: 'usd' },
      payments: null,
      pay: {},
    })

    expect(sparse.lines).toEqual([])
    expect(sparse.payments).toEqual([])
    expect(sparse.customerName).toBeNull()
    expect(sparse.memo).toBeNull()
    expect(sparse.dueAt).toBeNull()
    expect(sparse.payEnabled).toBe(false)
    expect(sparse.total).toEqual({ amount: '0', currency: 'USD' })
  })
})

describe('paymentMethodLabel', () => {
  it('names the method in words', () => {
    expect(paymentMethodLabel('CARD', 'stripe')).toBe('Card')
    expect(paymentMethodLabel('PAYMENT_LINK', 'stripe')).toBe('Stripe')
    expect(paymentMethodLabel('BANK_TRANSFER', null)).toBe('Bank transfer')
  })
})

describe('action responses', () => {
  it('reads the payment link', () => {
    expect(toPaymentActionUrl({ payment_action: { type: 'payment_link', url: 'https://checkout.test/x' } })).toBe(
      'https://checkout.test/x',
    )
    expect(toPaymentActionUrl({ payment_id: 'pay_1' })).toBeNull()
  })

  it('reads the download URL', () => {
    expect(toPresignedUrl({ presigned_url: 'https://s3.test/x.pdf' })).toBe('https://s3.test/x.pdf')
    expect(toPresignedUrl(null)).toBeNull()
  })
})
