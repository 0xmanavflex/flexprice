import { describe, expect, it } from 'vitest'
import {
  hostedInvoiceState,
  isOverdue,
  sumDecimals,
  paymentMethodLabel,
  toHostedInvoice,
  toPaymentActionUrl,
  toPresignedUrl,
} from './hostedInvoice'

/** Trimmed from a real `GET /public/v1/invoices` answered by the local stack. */
function wire(
  overrides: {
    invoice?: Record<string, unknown>
    tenant?: Record<string, unknown>
    payments?: unknown
    pay?: unknown
  } = {},
) {
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
    expect(invoice.tenant).toEqual({
      name: 'Default Tenant',
      contactEmail: 'help@acme.test',
      address: [],
    })
    expect(invoice.customerName).toBe('Acme Robotics')
    expect(invoice.memo).toBe('Invoice for advance charges')
    expect(invoice.dueAt).toEqual(new Date('2026-11-15T00:00:00Z'))
    expect(
      invoice.lines.map(({ id, name, quantity, amount }) => ({ id, name, quantity, amount })),
    ).toEqual([
      {
        id: 'li_1',
        name: 'Platform fee',
        quantity: '1',
        amount: { amount: '8000', currency: 'INR' },
      },
      {
        id: 'li_2',
        name: 'API calls',
        quantity: '4000',
        amount: { amount: '800', currency: 'INR' },
      },
    ])
    expect(invoice.payEnabled).toBe(true)
  })

  it('falls back to the billing email, then to none', () => {
    expect(
      toHostedInvoice(wire({ tenant: { billing_details: { email: 'billing@acme.test' } } })).tenant
        .contactEmail,
    ).toBe('billing@acme.test')
    expect(
      toHostedInvoice(wire({ tenant: { billing_details: null } })).tenant.contactEmail,
    ).toBeNull()
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
      {
        id: 'pay_1',
        amount: '8800',
        currency: 'inr',
        payment_status: 'FAILED',
        payment_gateway: 'stripe',
        payment_method_type: 'CARD',
        created_at: '2026-10-13T08:00:00Z',
        succeeded_at: null,
        failed_at: '2026-10-13T08:01:00Z',
      },
      {
        id: 'pay_2',
        amount: '8800',
        currency: 'inr',
        payment_status: 'SUCCEEDED',
        payment_gateway: 'stripe',
        payment_method_type: 'PAYMENT_LINK',
        created_at: '2026-10-14T08:00:00Z',
        succeeded_at: '2026-10-14T08:01:00Z',
        failed_at: null,
      },
    ]
    const fromPayment = toHostedInvoice(
      wire({ invoice: { payment_status: 'SUCCEEDED' }, payments }),
    )
    expect(fromPayment.state).toBe('paid')
    expect(fromPayment.paidAt).toEqual(new Date('2026-10-14T08:01:00Z'))
    expect(fromPayment.paidWith).toBe('Stripe')
    expect(fromPayment.payments.map((p) => p.status)).toEqual(['FAILED', 'SUCCEEDED'])

    const fromInvoice = toHostedInvoice(
      wire({ invoice: { payment_status: 'SUCCEEDED', paid_at: '2026-10-15T00:00:00Z' }, payments }),
    )
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

  it('never calls an invoice paid when no amount was reported', () => {
    const sparse = toHostedInvoice({
      tenant: {},
      invoice: { invoice_status: 'FINALIZED', payment_status: 'PENDING', currency: 'usd' },
      payments: null,
      pay: {},
    })

    expect(sparse.state).toBe('open')
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
    expect(
      toPaymentActionUrl({
        payment_action: { type: 'payment_link', url: 'https://checkout.test/x' },
      }),
    ).toBe('https://checkout.test/x')
    expect(toPaymentActionUrl({ payment_id: 'pay_1' })).toBeNull()
  })

  it('reads the download URL', () => {
    expect(toPresignedUrl({ presigned_url: 'https://s3.test/x.pdf' })).toBe('https://s3.test/x.pdf')
    expect(toPresignedUrl(null)).toBeNull()
  })
})

describe('toHostedInvoice, for the redesigned page', () => {
  const full = () =>
    toHostedInvoice(
      wire({
        tenant: {
          billing_details: {
            help_email: 'billing@vapi.test',
            address: {
              address_line1: '548 Market St',
              address_city: 'San Francisco',
              address_state: 'CA',
              address_postal_code: '94104',
              address_country: 'US',
            },
          },
        },
        invoice: {
          currency: 'usd',
          issue_date: '2026-10-12T00:00:00Z',
          period_start: '2026-09-12T00:00:00Z',
          period_end: '2026-10-11T00:00:00Z',
          total_prepaid_credits_applied: '45',
          customer: {
            name: 'Northwind Labs',
            email: 'billing@northwind.test',
            address_line1: '1200 Harbor Blvd',
            address_city: 'Oakland',
            address_state: 'CA',
            address_postal_code: '94607',
          },
          line_items: [
            {
              id: 'li_fee',
              display_name: 'Platform fee',
              plan_display_name: 'Growth',
              price_type: 'FIXED',
              amount: '199',
              quantity: '1',
              line_item_discount: '19.9',
              period_start: '2026-10-12T00:00:00Z',
              period_end: '2026-11-11T00:00:00Z',
            },
            {
              id: 'li_voice',
              display_name: 'Voice minutes',
              plan_display_name: 'Growth',
              price_type: 'USAGE',
              amount: '128.40',
              quantity: '2140',
              prepaid_credits_applied: '45',
              adjusted_entitlement_quantity: '100',
            },
            {
              id: 'li_support',
              display_name: 'Priority support',
              entity_type: 'addon',
              price_type: 'FIXED',
              amount: '49',
              quantity: '1',
            },
          ],
          coupon_applications: [
            {
              invoice_line_item_id: 'li_fee',
              discounted_amount: '19.90',
              discount_type: 'percentage',
              discount_percentage: '10.00',
            },
          ],
          taxes: [
            { tax_amount: '38.30', tax_rate: { name: 'Sales tax', percentage_value: '8.250' } },
          ],
        },
      }),
    )

  it('groups lines by plan, an add-on by itself, each with what it comes to', () => {
    const invoice = full()
    expect(invoice.groups.map((g) => [g.name, g.total.amount, g.lines.length])).toEqual([
      ['Growth', '262.50', 2],
      ['Priority support', '49', 1],
    ])
  })

  it('takes coupons and credits off the line, keeping what it cost before', () => {
    const [fee, voice] = full().lines
    expect(fee?.gross.amount).toBe('199')
    expect(fee?.amount.amount).toBe('179.10')
    expect(fee?.adjustments).toEqual([
      { label: 'Coupon (10% off)', amount: { amount: '19.90', currency: 'USD' } },
    ])
    expect(fee?.unitPrice?.amount).toBe('199')
    expect(voice?.amount.amount).toBe('83.40')
    expect(voice?.adjustments[0]?.label).toBe('Prepaid credits applied')
    // Usage may be tiered, so no unit price is implied.
    expect(voice?.unitPrice).toBeNull()
    expect(voice?.included).toBe('100')
  })

  it('names each tax with its rate', () => {
    expect(full().taxes).toEqual([
      { name: 'Sales tax', rate: '8.25%', amount: { amount: '38.30', currency: 'USD' } },
    ])
  })

  it('prints both parties with their addresses', () => {
    const invoice = full()
    expect(invoice.tenant.address).toEqual(['548 Market St', 'San Francisco, CA 94104', 'US'])
    expect(invoice.customer).toEqual({
      name: 'Northwind Labs',
      email: 'billing@northwind.test',
      address: ['1200 Harbor Blvd', 'Oakland, CA 94607'],
    })
  })

  it('reads the dates the summary card shows', () => {
    const invoice = full()
    expect(invoice.issuedAt).toEqual(new Date('2026-10-12T00:00:00Z'))
    expect(invoice.periodStart).toEqual(new Date('2026-09-12T00:00:00Z'))
    expect(invoice.prepaidCredits?.amount).toBe('45')
  })
})

describe('isOverdue', () => {
  const due = new Date('2026-10-26T00:00:00Z')
  it('is overdue from the day after the due date', () => {
    expect(isOverdue({ state: 'open', dueAt: due }, new Date('2026-10-26T23:00:00Z'))).toBe(false)
    expect(isOverdue({ state: 'open', dueAt: due }, new Date('2026-10-27T00:00:00Z'))).toBe(true)
  })
  it('never for a paid invoice, or one with no due date', () => {
    expect(isOverdue({ state: 'paid', dueAt: due }, new Date('2026-12-01T00:00:00Z'))).toBe(false)
    expect(isOverdue({ state: 'open', dueAt: null }, new Date('2026-12-01T00:00:00Z'))).toBe(false)
  })
})

describe('sumDecimals', () => {
  it('adds and subtracts exactly', () => {
    expect(sumDecimals(['199', '-19.90'])).toBe('179.10')
    expect(sumDecimals(['0.1', '0.2'])).toBe('0.3')
    expect(sumDecimals(['10', '-12.5'])).toBe('-2.5')
  })
})

describe('zero-amount lines', () => {
  it('leaves out a line that charged nothing', () => {
    const invoice = toHostedInvoice({
      invoice: {
        currency: 'usd',
        line_items: [
          {
            id: 'l1',
            display_name: 'API calls',
            amount: '0.00',
            quantity: '0',
            price_type: 'USAGE',
          },
          { id: 'l2', display_name: 'Seats', amount: 12, quantity: '1', price_type: 'FIXED' },
        ],
      },
    })
    expect(invoice.lines.map((line) => line.name)).toEqual(['Seats'])
  })
})

describe('hostedInvoiceState with nothing left to pay', () => {
  it('reads as paid when nothing is owed, as the console does', () => {
    expect(hostedInvoiceState('FINALIZED', 'PENDING', false)).toBe('paid')
  })
  it('stays processing while a payment is in flight', () => {
    expect(hostedInvoiceState('FINALIZED', 'PROCESSING', false)).toBe('processing')
  })
  it('stays open while money is owed', () => {
    expect(hostedInvoiceState('FINALIZED', 'PENDING', true)).toBe('open')
  })
})
