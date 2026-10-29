import { http, HttpResponse } from 'msw'
import { MOCK_PAID_KEY, type MockAccountState, mockAccountState } from './selfBillingState'

/**
 * Self-billing, `/portal/billing/*`, for the console under mocks.
 *
 * Off by default, so every other page looks as it always has. Pick an account
 * state with `localStorage['flexprice.mock.selfBilling']`: trial, ending, near,
 * limit, suspended, active or due. A checkout "pays" at once: polling it
 * answers completed and the account turns active for the rest of the tab.
 */
const BASE = '*/v1'
type MockState = MockAccountState

const day = (offset: number) => {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString()
}

const usage = (used: number, cap: number | null, billed: number) => ({
  features: [
    {
      feature: { lookup_key: 'events_ingested', meter: { event_name: 'events_ingested' } },
      total_limit: cap,
      is_unlimited: cap === null,
      current_usage: String(used),
    },
    {
      feature: { lookup_key: 'invoice_value', meter: { event_name: 'invoice_value' } },
      is_unlimited: true,
      current_usage: String(billed),
    },
  ],
  period: { start_time: day(-15), end_time: day(15) },
})

const invoice = (number: string, total: string, paid: boolean, due: number) => ({
  id: `inv_${number}`,
  number,
  status: 'FINALIZED',
  payment_status: paid ? 'SUCCEEDED' : 'PENDING',
  total,
  currency: 'usd',
  due_date: day(due),
  pdf_url: paid ? `https://example.com/${number}.pdf` : '',
})

/** The plan the summary reports, in the API's shape: the console prices nothing itself. */
const PLAN = {
  id: 'plan_selfbilling_payg',
  name: 'Pay as you go',
  description: 'A platform fee, plus a share of what you bill in production.',
  charges: [
    {
      price_id: 'price_platform',
      line_item_id: '',
      display_name: 'Platform fee',
      type: 'FIXED',
      quantity: '1',
      amount: '199',
      currency: 'usd',
      billing_model: 'FLAT_FEE',
      billing_period: 'MONTHLY',
      billing_period_count: 1,
      invoice_cadence: 'ADVANCE',
      transform_quantity: { divide_by: 0 },
      meter_id: '',
      meter_display_name: '',
      price_unit_type: 'FIAT',
      price_unit_amount: '',
    },
    {
      price_id: 'price_billed',
      line_item_id: '',
      display_name: 'Billing fee',
      type: 'USAGE',
      quantity: '0',
      amount: '0.005',
      currency: 'usd',
      billing_model: 'FLAT_FEE',
      billing_period: 'MONTHLY',
      billing_period_count: 1,
      invoice_cadence: 'ARREAR',
      transform_quantity: { divide_by: 0 },
      meter_id: 'meter_invoice_value',
      meter_display_name: 'Invoice value',
      price_unit_type: 'FIAT',
      price_unit_amount: '',
    },
  ],
}

function summaryOf(state: MockState) {
  return { plan: PLAN, ...summaryByState(state) }
}

function summaryByState(state: MockState) {
  switch (state) {
    case 'trial':
      return {
        status: 'trialing',
        trial_ends_at: day(15),
        invoices: [],
        usage: usage(31_240, 50_000, 0),
      }
    case 'ending':
      return {
        status: 'trialing',
        trial_ends_at: day(3),
        invoices: [],
        usage: usage(31_240, 50_000, 0),
      }
    case 'near':
      return {
        status: 'trialing',
        trial_ends_at: day(15),
        invoices: [],
        usage: usage(46_500, 50_000, 0),
      }
    case 'limit':
      return {
        status: 'suspended',
        trial_ends_at: day(15),
        invoices: [],
        usage: usage(51_870, 50_000, 0),
      }
    case 'suspended':
      return {
        status: 'suspended',
        trial_ends_at: day(-10),
        invoices: [invoice('FP-0001', '199', false, -10)],
        usage: usage(46_900, 50_000, 0),
      }
    case 'active':
      return {
        status: 'active',
        invoices: [invoice('FP-0001', '199', true, -30)],
        usage: usage(12_480_000, null, 184_200),
      }
    case 'due':
      return {
        status: 'active',
        invoices: [invoice('FP-0002', '1120.25', false, 10), invoice('FP-0001', '199', true, -30)],
        usage: usage(12_480_000, null, 184_200),
      }
  }
}

const statusOf = (state: MockState | null) =>
  state ? { enabled: true, status: summaryOf(state).status } : { enabled: false }

export const selfBillingHandlers = [
  http.get(`${BASE}/portal/billing/status`, () => HttpResponse.json(statusOf(mockAccountState()))),
  http.get(`${BASE}/portal/billing/summary`, () => {
    const state = mockAccountState()
    return state
      ? HttpResponse.json(summaryOf(state))
      : HttpResponse.json({ message: 'self-billing is disabled' }, { status: 404 })
  }),
  http.post(`${BASE}/portal/billing/checkout`, () =>
    HttpResponse.json({
      checkout_id: 'co_mock',
      url: '/billing/checkout/success',
      status: 'initiated',
      terminal: false,
      tenant_status: statusOf(mockAccountState()).status ?? 'trialing',
    }),
  ),
  http.get(`${BASE}/portal/billing/checkout/:id`, ({ params }) => {
    try {
      localStorage.setItem(MOCK_PAID_KEY, '1')
    } catch {
      // The account just stays as it was.
    }
    return HttpResponse.json({
      checkout_id: params['id'],
      status: 'completed',
      terminal: true,
      tenant_status: 'active',
    })
  }),
  http.post(
    `${BASE}/portal/billing/checkout/:id/cancel`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(`${BASE}/portal/billing/portal-session`, () =>
    HttpResponse.json({ url: 'https://billing.stripe.com/p/session/mock', expires_at: day(1) }),
  ),
]
