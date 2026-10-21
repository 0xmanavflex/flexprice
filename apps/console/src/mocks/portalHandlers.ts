import { HttpResponse, http } from 'msw'

/**
 * The customer portal's API, `/v1/customer/portal/*`, mocked with the
 * backend's own wire shapes so the portal runs with `VITE_USE_MOCKS=true` and
 * the `@fp/domain` mappers are what turns them into the page.
 *
 * Any origin: the portal picks its API from the link's region. A token of
 * `expired` answers 401, as a lapsed session does.
 */

const BASE = '*/v1/customer/portal'

const day = (offset: number) => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString()
}

const CUSTOMER = {
  id: 'cus_northwind',
  external_id: 'northwind',
  name: 'Northwind Labs',
  email: 'billing@northwind.dev',
}

const SUBSCRIPTIONS = [
  {
    id: 'sub_growth',
    subscription_status: 'active',
    billing_period: 'MONTHLY',
    billing_period_count: 1,
    current_period_start: day(-23),
    current_period_end: day(7),
    plan: { id: 'plan_growth', name: 'Growth' },
  },
  {
    id: 'sub_voice',
    subscription_status: 'trialing',
    billing_period: 'MONTHLY',
    billing_period_count: 1,
    current_period_start: day(-7),
    current_period_end: day(23),
    trial_end: day(7),
    plan: { id: 'plan_voice', name: 'Voice add-on' },
  },
]

const invoice = (n: number, overrides: Record<string, unknown>) => ({
  id: `inv_${n}`,
  invoice_number: `INV-2026-0${n}`,
  invoice_status: 'FINALIZED',
  payment_status: 'SUCCEEDED',
  currency: 'usd',
  subtotal: '486.10',
  total: '486.10',
  total_tax: '0',
  total_discount: '0',
  amount_paid: '486.10',
  amount_remaining: '0',
  ...overrides,
})

const INVOICES = [
  invoice(1488, {
    payment_status: 'FAILED',
    subtotal: '474.44',
    total_tax: '37.96',
    total: '512.40',
    amount_paid: '0',
    amount_remaining: '512.40',
    finalized_at: day(-23),
    due_date: day(-9),
    period_start: day(-53),
    period_end: day(-23),
    line_items: [
      {
        id: 'li_1',
        display_name: 'Growth plan',
        price_type: 'FIXED',
        quantity: '1',
        amount: '249',
      },
      {
        id: 'li_2',
        display_name: 'API calls',
        price_type: 'USAGE',
        quantity: '842100',
        amount: '168.42',
      },
      {
        id: 'li_3',
        display_name: 'Storage',
        price_type: 'USAGE',
        quantity: '1140',
        amount: '57.02',
      },
    ],
  }),
  ...[1377, 1261, 1149, 1036].map((n, i) =>
    invoice(n, {
      finalized_at: day(-53 - 30 * i),
      due_date: day(-39 - 30 * i),
      period_start: day(-83 - 30 * i),
      period_end: day(-53 - 30 * i),
      line_items: [
        {
          id: `li_${n}`,
          display_name: 'Growth plan',
          price_type: 'FIXED',
          quantity: '1',
          amount: '486.10',
        },
      ],
    }),
  ),
]

const WALLETS = [
  {
    id: 'wal_prepaid',
    name: 'Prepaid credits',
    currency: 'usd',
    wallet_status: 'ACTIVE',
    balance: '1864',
    credit_balance: '18640',
    conversion_rate: '0.1',
    topup_conversion_rate: '0.1',
    auto_topup: { enabled: true, threshold: '2000', amount: '5000' },
  },
]

const TRANSACTIONS = [
  {
    id: 'wtx_1',
    type: 'DEBIT',
    transaction_reason: 'INVOICE_PAYMENT',
    description: 'INV-2026-01488',
    amount: '412',
    credit_amount: '4120',
    transaction_status: 'COMPLETED',
    created_at: day(-23),
    currency: 'usd',
  },
  {
    id: 'wtx_2',
    type: 'CREDIT',
    transaction_reason: 'SUBSCRIPTION_CREDIT_GRANT',
    description: 'Growth plan · monthly grant',
    amount: '200',
    credit_amount: '2000',
    transaction_status: 'COMPLETED',
    created_at: day(-23),
    currency: 'usd',
  },
  {
    id: 'wtx_3',
    type: 'DEBIT',
    transaction_reason: 'CREDIT_EXPIRED',
    description: 'August grant',
    amount: '38',
    credit_amount: '380',
    transaction_status: 'COMPLETED',
    created_at: day(-23),
    currency: 'usd',
  },
  {
    id: 'wtx_4',
    type: 'CREDIT',
    transaction_reason: 'PURCHASED_CREDIT_DIRECT',
    description: 'Auto top-up · Visa •••• 4242',
    amount: '500',
    credit_amount: '5000',
    transaction_status: 'COMPLETED',
    created_at: day(-36),
    currency: 'usd',
  },
]

const PAYMENT_METHODS = {
  providers: [
    {
      provider: 'stripe',
      items: [
        {
          id: 'pm_visa',
          provider: 'stripe',
          type: 'card',
          status: 'active',
          is_default: true,
          can_auto_charge: true,
          card: { brand: 'visa', last4: '4242', exp_month: 8, exp_year: 2028 },
        },
        {
          id: 'pm_mc',
          provider: 'stripe',
          type: 'card',
          status: 'active',
          is_default: false,
          can_auto_charge: true,
          card: { brand: 'mastercard', last4: '5100', exp_month: 3, exp_year: 2027 },
        },
        {
          id: 'pm_amex',
          provider: 'stripe',
          type: 'card',
          status: 'active',
          is_default: false,
          can_auto_charge: true,
          card: { brand: 'amex', last4: '0005', exp_month: 6, exp_year: 2025 },
        },
      ],
    },
  ],
}

const INTEGRATIONS = {
  payment_integrations: [
    {
      provider: 'stripe',
      capabilities: [
        { type: 'checkout' },
        { type: 'payment_link' },
        { type: 'payment_method_management' },
        { type: 'auto_charge' },
        { type: 'set_default_method' },
      ],
    },
    { provider: 'razorpay', capabilities: [{ type: 'checkout' }, { type: 'payment_link' }] },
  ],
}

const USAGE = {
  customer_id: CUSTOMER.id,
  features: [
    {
      feature: { id: 'feat_api', name: 'API calls', type: 'metered', unit_plural: 'calls' },
      total_limit: 1000000,
      is_unlimited: false,
      current_usage: '842100',
      usage_percent: '84.21',
      is_enabled: true,
      is_soft_limit: false,
      next_usage_reset_at: day(7),
    },
    {
      feature: { id: 'feat_tokens', name: 'AI tokens', type: 'metered', unit_plural: 'tokens' },
      total_limit: 5000000,
      is_unlimited: false,
      current_usage: '6400000',
      usage_percent: '128',
      is_enabled: true,
      is_soft_limit: true,
      next_usage_reset_at: day(7),
    },
    {
      feature: { id: 'feat_storage', name: 'Storage', type: 'metered', unit_plural: 'GB' },
      total_limit: null,
      is_unlimited: true,
      current_usage: '1140',
      usage_percent: '0',
      is_enabled: true,
    },
    { feature: { id: 'feat_sso', name: 'SSO', type: 'boolean' }, is_enabled: true },
  ],
}

function analytics(start: Date, end: Date) {
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  const features = [
    {
      id: 'feat_api',
      name: 'API calls',
      unit: 'calls',
      daily: 5.6,
      rate: 0.0002,
      group: 'Platform',
    },
    {
      id: 'feat_tokens',
      name: 'AI tokens',
      unit: 'tokens',
      daily: 4.27,
      rate: 0.00002,
      group: 'AI',
    },
    { id: 'feat_storage', name: 'Storage', unit: 'GB', daily: 1.9, rate: 0.05, group: 'Platform' },
  ]
  const items = features.map((f, index) => {
    const points = Array.from({ length: days }, (_, i) => {
      const cost = Math.round(f.daily * (0.75 + 0.35 * Math.sin((i + index * 2) / 3)) * 100) / 100
      return {
        timestamp: new Date(start.getTime() + i * 86_400_000).toISOString(),
        cost: cost.toFixed(2),
        usage: String(Math.round(cost / f.rate)),
      }
    })
    const cost = points.reduce((sum, p) => sum + Number(p.cost), 0)
    const usage = points.reduce((sum, p) => sum + Number(p.usage), 0)
    return {
      feature_id: f.id,
      name: f.name,
      unit_plural: f.unit,
      total_usage: String(usage),
      total_cost: cost.toFixed(2),
      currency: 'usd',
      price: { billing_model: 'FLAT_FEE', amount: String(f.rate) },
      group: { id: `grp_${f.group}`, name: f.group },
      points,
    }
  })
  return {
    currency: 'usd',
    total_cost: items.reduce((s, i) => s + Number(i.total_cost), 0).toFixed(2),
    items,
  }
}

const authorized = (request: Request) => {
  const token = request.headers.get('X-Session-Token')
  return token && token !== 'expired'
}

const unauthorized = () =>
  HttpResponse.json(
    { success: false, error: { message: 'Session expired', internal_error: 'unauthorized' } },
    { status: 401 },
  )

const checkout = (provider: string) => `https://checkout.${provider}.example/session/demo`

export const portalHandlers = [
  http.all(`${BASE}/*`, ({ request }) => (authorized(request) ? undefined : unauthorized())),
  http.get(`${BASE}/info`, () => HttpResponse.json(CUSTOMER)),
  http.get(`${BASE}/config`, () =>
    HttpResponse.json({ success: false, error: { message: 'Setting not found' } }, { status: 404 }),
  ),
  http.get(`${BASE}/integrations`, () => HttpResponse.json(INTEGRATIONS)),
  http.get(`${BASE}/usage`, () => HttpResponse.json(USAGE)),
  http.post(`${BASE}/analytics/revenue`, async ({ request }) => {
    const body = (await request.json()) as { start_time: string; end_time: string }
    return HttpResponse.json(analytics(new Date(body.start_time), new Date(body.end_time)))
  }),
  http.post(`${BASE}/subscriptions`, () =>
    HttpResponse.json({ items: SUBSCRIPTIONS, pagination: { total: SUBSCRIPTIONS.length } }),
  ),
  http.post(`${BASE}/invoices`, () =>
    HttpResponse.json({ items: INVOICES, pagination: { total: INVOICES.length } }),
  ),
  http.get(`${BASE}/invoices/:id/pdf`, () =>
    HttpResponse.json({ presigned_url: 'https://files.example/invoice.pdf' }),
  ),
  http.get(`${BASE}/invoices/:id`, ({ params }) => {
    const found = INVOICES.find((i) => i.id === params['id'])
    return found
      ? HttpResponse.json(found)
      : HttpResponse.json({ error: { message: 'Invoice not found' } }, { status: 404 })
  }),
  http.post(`${BASE}/invoices/:id/pay`, async ({ request, params }) => {
    const body = (await request.json()) as { payment_provider?: string }
    const provider = body.payment_provider ?? 'stripe'
    return HttpResponse.json({
      payment_id: 'pay_demo',
      invoice_id: params['id'],
      status: 'PENDING',
      amount: '512.40',
      currency: 'usd',
      payment_action: { type: 'redirect', url: checkout(provider) },
    })
  }),
  http.post(`${BASE}/wallets`, () => HttpResponse.json(WALLETS)),
  http.get(`${BASE}/wallets/:id/transactions`, ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 20)
    return HttpResponse.json({
      items: TRANSACTIONS.slice(0, limit),
      pagination: { total: TRANSACTIONS.length },
    })
  }),
  http.post(`${BASE}/wallets/:id/top-up`, async ({ request }) => {
    const body = (await request.json()) as {
      checkout?: { payment_provider?: string; use_saved_method?: boolean }
    }
    const viaCheckout = body.checkout?.payment_provider && !body.checkout.use_saved_method
    return HttpResponse.json({
      wallet: WALLETS[0],
      wallet_transaction: null,
      ...(viaCheckout
        ? {
            checkout_session: {
              id: 'cs_demo',
              checkout_status: 'pending',
              payment_provider: body.checkout?.payment_provider,
              payment_action: {
                type: 'redirect',
                url: checkout(body.checkout?.payment_provider ?? 'stripe'),
              },
            },
          }
        : {}),
    })
  }),
  http.get(`${BASE}/payment-methods`, () => HttpResponse.json(PAYMENT_METHODS)),
  http.post(`${BASE}/payment-methods`, async ({ request }) => {
    const body = (await request.json()) as { payment_provider: string }
    return HttpResponse.json({
      provider: body.payment_provider,
      action: { type: 'redirect', url: checkout(body.payment_provider) },
    })
  }),
  http.post(`${BASE}/payment-methods/delete`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/payment-methods/default`, () => HttpResponse.json({ success: true })),
]
