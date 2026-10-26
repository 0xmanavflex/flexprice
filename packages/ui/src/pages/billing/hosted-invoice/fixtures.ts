import { type HostedInvoice, toHostedInvoice } from '@fp/domain'

/**
 * The hosted invoice stories' sample: the redesign's own example, written as
 * the `GET /public/v1/invoices` response it would come from and read through
 * `toHostedInvoice`, so the stories exercise the same mapping the page does.
 */
const wire = {
  tenant: {
    name: 'Vapi',
    billing_details: {
      help_email: 'billing@vapi.test',
      address: {
        address_line1: '548 Market St, Suite 41200',
        address_city: 'San Francisco',
        address_state: 'CA',
        address_postal_code: '94104',
        address_country: 'United States',
      },
    },
  },
  invoice: {
    id: 'inv_01M58D16AK0WHY9KTQ2TY4HBYW',
    invoice_number: 'INV-2026-01488',
    invoice_status: 'FINALIZED',
    payment_status: 'PENDING',
    currency: 'usd',
    subtotal: '539.20',
    total_discount: '29.90',
    total_prepaid_credits_applied: '45.00',
    total_tax: '38.30',
    total: '502.60',
    amount_paid: '0',
    amount_remaining: '502.60',
    issue_date: '2026-10-12T00:00:00Z',
    due_date: '2026-10-26T00:00:00Z',
    period_start: '2026-09-12T00:00:00Z',
    period_end: '2026-10-11T00:00:00Z',
    description:
      'Thank you for building with Vapi. Usage is billed in arrears; the platform fee and add-ons are billed in advance.',
    customer: {
      name: 'Northwind Labs',
      email: 'billing@northwind.test',
      address_line1: '1200 Harbor Blvd, Floor 3',
      address_city: 'Oakland',
      address_state: 'CA',
      address_postal_code: '94607',
      address_country: 'United States',
    },
    line_items: [
      {
        id: 'li_fee',
        display_name: 'Platform fee',
        plan_display_name: 'Growth plan',
        price_type: 'FIXED',
        amount: '199.00',
        quantity: '1',
        line_item_discount: '19.90',
        period_start: '2026-10-12T00:00:00Z',
        period_end: '2026-11-11T00:00:00Z',
      },
      {
        id: 'li_tokens',
        display_name: 'AI tokens',
        plan_display_name: 'Growth plan',
        price_type: 'USAGE',
        amount: '152.80',
        quantity: '4820000',
        adjusted_entitlement_quantity: '1000000',
        period_start: '2026-09-12T00:00:00Z',
        period_end: '2026-10-11T00:00:00Z',
      },
      {
        id: 'li_voice',
        display_name: 'Voice minutes',
        plan_display_name: 'Growth plan',
        price_type: 'USAGE',
        amount: '128.40',
        quantity: '2140',
        prepaid_credits_applied: '45.00',
        period_start: '2026-09-12T00:00:00Z',
        period_end: '2026-10-11T00:00:00Z',
      },
      {
        id: 'li_storage',
        display_name: 'Storage',
        plan_display_name: 'Growth plan',
        price_type: 'USAGE',
        amount: '10.00',
        quantity: '40',
        line_item_discount: '10.00',
        period_start: '2026-09-12T00:00:00Z',
        period_end: '2026-10-11T00:00:00Z',
      },
      {
        id: 'li_support',
        display_name: 'Priority support',
        entity_type: 'addon',
        price_type: 'FIXED',
        amount: '49.00',
        quantity: '1',
        period_start: '2026-10-12T00:00:00Z',
        period_end: '2026-11-11T00:00:00Z',
      },
    ],
    coupon_applications: [
      {
        invoice_line_item_id: 'li_fee',
        discounted_amount: '19.90',
        discount_type: 'percentage',
        discount_percentage: '10',
      },
    ],
    taxes: [{ tax_amount: '38.30', tax_rate: { name: 'Sales tax', percentage_value: '8.25' } }],
  },
  payments: [
    {
      id: 'pay_1',
      amount: '502.60',
      currency: 'usd',
      payment_status: 'FAILED',
      payment_method_type: 'CARD',
      payment_gateway: 'stripe',
      created_at: '2026-10-13T08:01:00Z',
      failed_at: '2026-10-13T08:01:00Z',
    },
  ],
  pay: { enabled: true },
}

/** An open invoice: five charges under a plan and an add-on, one failed card attempt. */
export const DEMO_HOSTED_INVOICE: HostedInvoice = toHostedInvoice(wire)

/** Paid after the failed attempt. */
export const DEMO_PAID_HOSTED_INVOICE: HostedInvoice = toHostedInvoice({
  ...wire,
  invoice: {
    ...wire.invoice,
    payment_status: 'SUCCEEDED',
    amount_paid: '502.60',
    amount_remaining: '0',
    paid_at: '2026-10-14T08:01:00Z',
  },
  payments: [
    ...wire.payments,
    {
      id: 'pay_2',
      amount: '502.60',
      currency: 'usd',
      payment_status: 'SUCCEEDED',
      payment_method_type: 'PAYMENT_LINK',
      payment_gateway: 'stripe',
      created_at: '2026-10-14T08:00:00Z',
      succeeded_at: '2026-10-14T08:01:00Z',
    },
  ],
  pay: { enabled: false },
})

/** Voided before anything was paid. */
export const DEMO_VOIDED_HOSTED_INVOICE: HostedInvoice = toHostedInvoice({
  ...wire,
  invoice: { ...wire.invoice, invoice_status: 'VOIDED', voided_at: '2026-10-14T00:00:00Z' },
  pay: { enabled: false },
})

/** What a response with no customer, lines, payments or contact leaves. */
export const SPARSE_HOSTED_INVOICE: HostedInvoice = toHostedInvoice({
  tenant: { name: 'Vapi', billing_details: {} },
  invoice: {
    invoice_number: 'INV-2026-01489',
    invoice_status: 'FINALIZED',
    payment_status: 'PENDING',
    currency: 'usd',
    total: '0',
    subtotal: '0',
    amount_remaining: '0',
  },
  payments: [],
  pay: { enabled: false },
})
