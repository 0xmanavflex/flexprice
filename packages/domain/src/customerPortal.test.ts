import { describe, expect, it } from 'vitest'
import {
  billingCadence,
  creditsAfter,
  creditsCost,
  dailyAverage,
  isPayable,
  parseCreditAmount,
  periodProgress,
  portalInvoiceStatus,
  portalRangeWindow,
  projectSpend,
  spendChange,
  toPortalTopUps,
  totalDue,
  unitPriceLabel,
  toPortalActionUrl,
  DEFAULT_PORTAL_CONFIG,
  toPortalConfig,
  toPortalCustomer,
  toPortalPropertyKeys,
  toPortalGateways,
  toPortalInvoices,
  toPortalPaymentMethods,
  toPortalQuotas,
  toPortalSpend,
  toPortalSubscriptions,
  toPortalWalletTransactions,
  toPortalWallets,
  withPortalAutoTopup,
  walletFlows,
} from './customerPortal'
import { money } from './money'

const NOW = new Date('2026-10-05T12:00:00Z')

describe('customer and config', () => {
  it('names the customer and makes initials', () => {
    expect(
      toPortalCustomer({ id: 'c1', name: 'Northwind Labs', email: 'billing@northwind.dev' }),
    ).toEqual({
      id: 'c1',
      name: 'Northwind Labs',
      email: 'billing@northwind.dev',
      initials: 'NL',
    })
    expect(toPortalCustomer({ external_id: 'acme' }).initials).toBe('AC')
  })

  it('keeps the portal’s own tab order whatever the stored order', () => {
    const config = toPortalConfig({
      value: {
        sections: [
          { id: 'overview', enabled: true, order: 4 },
          { id: 'usage', enabled: true, order: 1 },
          { id: 'invoices', enabled: true, order: 3 },
          { id: 'credits', enabled: true, order: 2 },
        ],
      },
    })
    expect(config.tabs).toEqual(['overview', 'usage', 'credits', 'invoices'])
  })

  it('reads tabs in order and keeps overview first; no config means every tab', () => {
    const config = toPortalConfig({
      value: {
        theme: { primary_color: '#0f3d3e' },
        sections: [
          { id: 'invoices', enabled: true, order: 2 },
          { id: 'wallet', enabled: true, order: 1 },
          { id: 'usage', enabled: false, order: 0 },
        ],
      },
    })
    expect(config.primaryColor).toBe('#0f3d3e')
    expect(config.tabs).toEqual(['overview', 'credits', 'invoices'])
    expect(toPortalConfig(null)).toEqual(DEFAULT_PORTAL_CONFIG)
  })

  it('hides Overview when its section is off, unless nothing else is left', () => {
    const sections = (overview: boolean, usage: boolean) => ({
      value: {
        sections: [
          { id: 'overview', enabled: overview },
          { id: 'usage', enabled: usage },
          { id: 'credits', enabled: false },
          { id: 'invoices', enabled: false },
        ],
      },
    })
    expect(toPortalConfig(sections(false, true)).tabs).toEqual(['usage'])
    expect(toPortalConfig(sections(false, false)).tabs).toEqual(['overview'])
  })

  it('names each tab with the merchant’s section label', () => {
    const config = toPortalConfig({
      value: { sections: [{ id: 'credits', label: 'Wallet', enabled: true }, { id: 'usage' }] },
    })
    expect(config.labels).toEqual({
      overview: 'Overview',
      usage: 'Usage',
      credits: 'Wallet',
      invoices: 'Invoices',
    })
  })

  it('hides a part only when its tab is stored and switched off', () => {
    const config = toPortalConfig({
      value: {
        sections: [
          {
            id: 'overview',
            enabled: true,
            tabs: [
              { id: '9', type: 'wallet_balance', enabled: true },
              { id: '10', type: 'subscriptions', enabled: false },
            ],
          },
          {
            id: 'usage',
            enabled: true,
            tabs: [
              {
                id: '1',
                type: 'metric_cards',
                enabled: true,
                metric_cards: { show_revenue_metric: false },
              },
              { id: '2', type: 'usage_graph', enabled: false },
            ],
          },
          {
            id: 'credits',
            enabled: true,
            tabs: [{ id: '7', type: 'wallet_transactions', enabled: false }],
          },
        ],
      },
    })
    expect(config.parts).toEqual({
      creditBalance: true,
      // No payment methods tab stored: the server's default tree has none.
      paymentMethods: true,
      subscriptions: false,
      spendSummary: false,
      usageTrend: false,
      usageQuota: true,
      usageBreakdown: true,
      wallet: true,
      autoTopup: true,
      transactions: false,
    })
  })

  it('offers the usage graph’s presets and opens on its default', () => {
    const graph = (usage_graph: Record<string, unknown>) =>
      toPortalConfig({
        value: {
          sections: [{ id: 'usage', tabs: [{ id: '2', type: 'usage_graph', usage_graph }] }],
        },
      }).usage
    expect(
      graph({
        date_presets: ['last_month', 'last_7_days', 'someday'],
        default_preset: 'last_7_days',
        allow_custom_date_range: false,
      }),
    ).toEqual({ ranges: ['7d', 'last-month'], defaultRange: '7d', customRange: false })
    // A default outside the presets falls to the first offered.
    expect(graph({ date_presets: ['today'], default_preset: 'last_month' }).defaultRange).toBe(
      'today',
    )
    expect(graph({})).toEqual(DEFAULT_PORTAL_CONFIG.usage)
  })

  it('drops a brand colour that is not a colour', () => {
    expect(
      toPortalConfig({ value: { theme: { primary_color: 'red; background:url(x)' } } })
        .primaryColor,
    ).toBeNull()
  })
})

describe('subscriptions', () => {
  it('maps plan, status and cadence; ends of cancelled plans drop out', () => {
    const subs = toPortalSubscriptions({
      items: [
        {
          id: 's1',
          subscription_status: 'active',
          billing_period: 'MONTHLY',
          billing_period_count: 1,
          current_period_start: '2026-09-12T00:00:00Z',
          current_period_end: '2026-10-12T00:00:00Z',
          plan: { name: 'Growth' },
        },
        {
          id: 's2',
          subscription_status: 'trialing',
          billing_period: 'MONTHLY',
          plan: { name: 'Voice add-on' },
        },
        { id: 's3', subscription_status: 'cancelled', current_period_end: '2020-01-01T00:00:00Z' },
      ],
    })
    expect(subs.map((s) => [s.planName, s.statusLabel, s.cadence])).toEqual([
      ['Growth', 'Active', 'Billed monthly'],
      ['Voice add-on', 'Trial', 'Billed monthly'],
    ])
  })

  it('says how often for counts above one', () => {
    expect(billingCadence('MONTHLY', 3)).toBe('Billed every 3 months')
    expect(billingCadence('ANNUAL')).toBe('Billed yearly')
  })

  it('counts days into the period', () => {
    const p = periodProgress(
      new Date('2026-09-12T00:00:00Z'),
      new Date('2026-10-12T00:00:00Z'),
      NOW,
    )
    expect(p).toEqual({ day: 24, days: 30, fraction: 0.8 })
  })
})

describe('invoices', () => {
  it('reads status from invoice and payment status, then the due date', () => {
    expect(portalInvoiceStatus('VOIDED', 'SUCCEEDED', null, NOW)).toBe('void')
    expect(portalInvoiceStatus('FINALIZED', 'SUCCEEDED', null, NOW)).toBe('paid')
    expect(portalInvoiceStatus('FINALIZED', 'FAILED', null, NOW)).toBe('failed')
    expect(portalInvoiceStatus('FINALIZED', 'PENDING', new Date('2026-09-26'), NOW)).toBe('overdue')
    expect(portalInvoiceStatus('FINALIZED', 'PENDING', new Date('2026-11-01'), NOW)).toBe('open')
  })

  it('lists newest first without drafts, and knows what can be paid', () => {
    const invoices = toPortalInvoices(
      {
        items: [
          {
            id: 'a',
            invoice_number: 'INV-1',
            invoice_status: 'FINALIZED',
            payment_status: 'SUCCEEDED',
            currency: 'usd',
            total: '10',
            amount_remaining: '0',
            finalized_at: '2026-08-12T00:00:00Z',
          },
          {
            id: 'b',
            invoice_number: 'INV-2',
            invoice_status: 'FINALIZED',
            payment_status: 'FAILED',
            currency: 'usd',
            total: '512.40',
            amount_remaining: '512.40',
            finalized_at: '2026-09-12T00:00:00Z',
            line_items: [
              {
                id: 'l',
                display_name: 'API calls',
                price_type: 'USAGE',
                quantity: '842100',
                amount: '168.42',
              },
            ],
          },
          { id: 'c', invoice_status: 'DRAFT', payment_status: 'PENDING' },
        ],
      },
      NOW,
    )
    expect(invoices.map((i) => i.number)).toEqual(['INV-2', 'INV-1'])
    expect(invoices[0]!.amountDue).toEqual(money('512.40', 'USD'))
    expect(invoices[0]!.lines[0]).toMatchObject({ name: 'API calls', kind: 'Usage' })
    expect(invoices.map(isPayable)).toEqual([true, false])
  })
})

describe('wallets', () => {
  const wallets = toPortalWallets([
    {
      id: 'w1',
      name: 'Prepaid credits',
      currency: 'usd',
      wallet_status: 'ACTIVE',
      balance: '1864',
      credit_balance: '18640',
      conversion_rate: '0.1',
      auto_topup: { enabled: true, threshold: '500', amount: '2000' },
    },
    { id: 'w2', wallet_status: 'CLOSED', currency: 'usd' },
  ])

  it('maps balance, credit price and auto top-up; closed wallets drop out', () => {
    expect(wallets).toHaveLength(1)
    expect(wallets[0]).toMatchObject({
      name: 'Prepaid credits',
      active: true,
      credits: '18640',
      creditPrice: '0.1',
      autoTopup: { enabled: true, threshold: '500', credits: '2000' },
    })
  })

  it('applies a saved auto top-up to its wallet only', () => {
    const other = { ...wallets[0]!, id: 'w3', autoTopup: null }
    const saved = { enabled: false, threshold: '100', credits: '900', cooldown: null }
    const next = withPortalAutoTopup([wallets[0]!, other], 'w1', saved)
    expect(next[0]!.autoTopup).toEqual(saved)
    expect(next[1]).toBe(other)
    // The loaded list is not changed in place.
    expect(wallets[0]!.autoTopup?.enabled).toBe(true)
  })

  it('reads the API’s lowercase transaction types', () => {
    const { items } = toPortalWalletTransactions(
      {
        items: [
          {
            id: 'd',
            type: 'debit',
            amount: '1',
            credit_amount: '10',
            transaction_status: 'COMPLETED',
          },
          {
            id: 'c',
            type: 'credit',
            amount: '1',
            credit_amount: '10',
            transaction_status: 'COMPLETED',
          },
        ],
        pagination: { total: 2 },
      },
      'USD',
    )
    expect(items.map((t) => t.direction)).toEqual(['out', 'in'])
  })

  it('titles transactions by reason and sums flows exactly', () => {
    const { items, total } = toPortalWalletTransactions(
      {
        items: [
          {
            id: 't1',
            type: 'DEBIT',
            transaction_reason: 'INVOICE_PAYMENT',
            description: 'INV-2026-01488',
            amount: '412.10',
            credit_amount: '4121',
            transaction_status: 'COMPLETED',
          },
          {
            id: 't2',
            type: 'CREDIT',
            transaction_reason: 'SUBSCRIPTION_CREDIT_GRANT',
            amount: '0.20',
            credit_amount: '2',
            transaction_status: 'COMPLETED',
          },
          {
            id: 't3',
            type: 'CREDIT',
            transaction_reason: 'PURCHASED_CREDIT_DIRECT',
            amount: '0.10',
            credit_amount: '1',
            transaction_status: 'COMPLETED',
          },
          {
            id: 't4',
            type: 'CREDIT',
            transaction_reason: 'PURCHASED_CREDIT_INVOICED',
            amount: '50',
            credit_amount: '500',
            transaction_status: 'PENDING',
          },
        ],
        pagination: { total: 9 },
      },
      'USD',
    )
    expect(total).toBe(9)
    expect(items.map((t) => [t.title, t.direction])).toEqual([
      ['Invoice payment', 'out'],
      ['Plan credits', 'in'],
      ['Credits purchased', 'in'],
      ['Credits purchased', 'in'],
    ])
    const flows = walletFlows(items, 'USD')
    // 0.2 + 0.1 is 0.3 here, not 0.30000000000000004; the pending purchase is not counted.
    expect(flows.in).toEqual({ amount: money('0.3', 'USD'), credits: '3' })
    expect(flows.out.credits).toBe('4121')
  })
})

describe('buying credits', () => {
  it('prices credits exactly and rounds to the cent', () => {
    expect(creditsCost('5000', '0.1', 'USD')).toEqual(money('500', 'USD'))
    expect(creditsCost('3', '0.333', 'USD')).toEqual(money('1', 'USD'))
    expect(creditsCost('abc', '0.1', 'USD')).toBeNull()
    expect(creditsAfter('18640', '5000')).toBe('23640')
  })

  it('reads what the customer typed', () => {
    expect(parseCreditAmount('5,000')).toBe('5000')
    expect(parseCreditAmount('0')).toBeNull()
    expect(parseCreditAmount('-5')).toBeNull()
    expect(parseCreditAmount('1e3')).toBeNull()
  })

  it('averages a period to the cent', () => {
    expect(dailyAverage(money('393.42', 'USD'), 30)).toEqual(money('13.11', 'USD'))
    expect(dailyAverage(money('10', 'USD'), 3)).toEqual(money('3.33', 'USD'))
  })
})

describe('totals and projections', () => {
  const inv = (id: string, due: string, currency = 'USD') =>
    ({
      id,
      status: 'open',
      amountDue: money(due, currency),
    }) as Parameters<typeof totalDue>[0][number]

  it('sums what is owed in one currency, exactly', () => {
    expect(totalDue([inv('a', '0.1'), inv('b', '0.2'), inv('c', '5', 'EUR')])).toEqual({
      amount: money('0.3', 'USD'),
      count: 2,
      others: 1,
    })
    expect(totalDue([])).toBeNull()
  })

  it('compares spend with the window before', () => {
    expect(spendChange(money('112', 'USD'), money('100', 'USD'))).toBeCloseTo(0.12)
    expect(spendChange(money('5', 'USD'), money('0', 'USD'))).toBeNull()
  })

  it('projects the period at today’s pace', () => {
    expect(projectSpend(money('315.12', 'USD'), money('13.11', 'USD'), 7)).toEqual(
      money('406.89', 'USD'),
    )
  })

  it('prices a unit in a unit people read', () => {
    expect(unitPriceLabel(money('0.05', 'USD'), 'minutes')).toEqual({
      amount: money('0.05', 'USD'),
      per: 'minute',
    })
    expect(unitPriceLabel(money('0.0002', 'USD'), 'calls')).toEqual({
      amount: money('0.2', 'USD'),
      per: '1K calls',
    })
    expect(unitPriceLabel(money('0.000005', 'USD'), 'tokens')).toEqual({
      amount: money('5', 'USD'),
      per: '1M tokens',
    })
    expect(unitPriceLabel(money('0.1', 'USD'), 'GB-months')).toEqual({
      amount: money('0.1', 'USD'),
      per: 'GB-month',
    })
  })
})

describe('top-ups', () => {
  it('reads what is left of each credit and flags what needs attention', () => {
    const { items } = toPortalWalletTransactions(
      {
        items: [
          {
            id: 'g1',
            type: 'CREDIT',
            transaction_reason: 'SUBSCRIPTION_CREDIT_GRANT',
            credit_amount: '2000',
            credits_available: '1380',
            expiry_date: '2026-10-12T00:00:00Z',
            transaction_status: 'COMPLETED',
            amount: '200',
          },
          {
            id: 'g2',
            type: 'CREDIT',
            transaction_reason: 'PURCHASED_CREDIT_DIRECT',
            credit_amount: '10000',
            credits_available: '9840',
            transaction_status: 'COMPLETED',
            amount: '1000',
          },
          {
            id: 'g3',
            type: 'CREDIT',
            transaction_reason: 'FREE_CREDIT_GRANT',
            credit_amount: '5000',
            credits_available: '0',
            transaction_status: 'COMPLETED',
            amount: '500',
          },
          {
            id: 'g4',
            type: 'CREDIT',
            transaction_reason: 'FREE_CREDIT_GRANT',
            credit_amount: '100',
            credits_available: '100',
            expiry_date: '2026-09-01T00:00:00Z',
            transaction_status: 'COMPLETED',
            amount: '10',
          },
          {
            id: 'd1',
            type: 'DEBIT',
            transaction_reason: 'INVOICE_PAYMENT',
            credit_amount: '50',
            transaction_status: 'COMPLETED',
            amount: '5',
          },
        ],
      },
      'USD',
    )
    const topUps = toPortalTopUps(items, NOW)
    expect(topUps.map((t) => [t.id, t.remaining, t.state])).toEqual([
      ['g1', '1380', 'expiring soon'],
      ['g2', '9840', 'active'],
      ['g3', '0', 'used up'],
      ['g4', '100', 'expired'],
    ])
    expect(topUps[0]!.consumed).toBeCloseTo(0.31)
    expect(topUps[0]!.daysLeft).toBe(7)
  })
})

describe('usage ranges', () => {
  it('covers whole local days and ends tomorrow for rolling ranges', () => {
    const now = new Date(2026, 9, 5, 15, 30)
    expect(portalRangeWindow('30d', now)).toEqual({
      start: new Date(2026, 8, 6),
      end: new Date(2026, 9, 6),
      days: 30,
    })
    expect(portalRangeWindow('today', now).days).toBe(1)
    expect(portalRangeWindow('last-month', now)).toEqual({
      start: new Date(2026, 8, 1),
      end: new Date(2026, 9, 1),
      days: 30,
    })
  })
})

describe('payment methods and gateways', () => {
  it('flattens providers, marks expired cards and puts the default first', () => {
    const cards = toPortalPaymentMethods(
      {
        providers: [
          {
            provider: 'stripe',
            items: [
              {
                id: 'pm_2',
                provider: 'stripe',
                card: { brand: 'amex', last4: '0005', exp_month: 6, exp_year: 2026 },
              },
              {
                id: 'pm_1',
                provider: 'stripe',
                is_default: true,
                card: { brand: 'visa', last4: '4242', exp_month: 8, exp_year: 2028 },
              },
            ],
          },
        ],
      },
      NOW,
    )
    expect(cards.map((c) => [c.brand, c.network, c.expires, c.expired, c.isDefault])).toEqual([
      ['Visa', 'visa', '08/28', false, true],
      ['American Express', 'amex', '06/26', true, false],
    ])
  })

  it("reads Razorpay's network names, and keeps an unknown brand's own wording", () => {
    const cards = toPortalPaymentMethods({
      providers: [
        {
          provider: 'razorpay',
          items: [
            { id: 'a', card: { network: 'MasterCard', last4: '1' } },
            { id: 'b', card: { network: 'RuPay', last4: '2' } },
            { id: 'c', card: { network: 'Elo', last4: '3' } },
            { id: 'd', card: { brand: 'unknown', last4: '4' } },
          ],
        },
      ],
    })
    expect(cards.map((c) => [c.brand, c.network])).toEqual([
      ['Mastercard', 'mastercard'],
      ['RuPay', 'rupay'],
      ['Elo', 'card'],
      ['Card', 'card'],
    ])
  })

  it('reads gateway capabilities', () => {
    expect(
      toPortalGateways({
        payment_integrations: [
          {
            provider: 'stripe',
            capabilities: [
              { type: 'checkout' },
              { type: 'payment_method_management' },
              { type: 'auto_charge' },
            ],
          },
          { provider: 'razorpay', capabilities: [{ type: 'checkout' }, { type: 'payment_link' }] },
        ],
      }),
    ).toEqual([
      {
        provider: 'stripe',
        label: 'Stripe',
        paysInvoices: false,
        checkout: true,
        savesCards: true,
        autoCharge: true,
      },
      {
        provider: 'razorpay',
        label: 'Razorpay',
        paysInvoices: true,
        checkout: true,
        savesCards: false,
        autoCharge: false,
      },
    ])
  })

  it('finds the next page in any gateway answer', () => {
    expect(toPortalActionUrl({ payment_action: { url: 'https://pay.example/a' } })).toBe(
      'https://pay.example/a',
    )
    expect(toPortalActionUrl({ action: { type: 'redirect', url: 'https://pay.example/b' } })).toBe(
      'https://pay.example/b',
    )
    expect(
      toPortalActionUrl({ checkout_session: { payment_action: { url: 'https://pay.example/c' } } }),
    ).toBe('https://pay.example/c')
    expect(toPortalActionUrl({ wallet: {} })).toBeNull()
  })
})

describe('usage', () => {
  it('keeps metered allowances and says how far over a soft limit is', () => {
    const quotas = toPortalQuotas({
      features: [
        {
          feature: { id: 'f1', name: 'API calls', type: 'metered', unit_plural: 'calls' },
          total_limit: 1000000,
          current_usage: '842100',
          usage_percent: '84.21',
          is_enabled: true,
        },
        {
          feature: { id: 'f2', name: 'Tokens', type: 'metered' },
          total_limit: 1000,
          current_usage: '2400',
          usage_percent: '240',
          is_enabled: true,
          is_soft_limit: true,
        },
        {
          feature: { id: 'f3', name: 'Storage', type: 'metered' },
          total_limit: null,
          is_unlimited: true,
          current_usage: '12',
          is_enabled: true,
        },
        { feature: { id: 'f4', name: 'SSO', type: 'boolean' }, is_enabled: true },
      ],
    })
    expect(quotas.map((q) => [q.name, q.limit, q.unlimited, q.over])).toEqual([
      ['API calls', '1000000', false, null],
      ['Tokens', '1000', false, '1400'],
      ['Storage', null, true, null],
    ])
  })

  it('merges a feature priced twice and sorts by cost', () => {
    const spend = toPortalSpend({
      currency: 'usd',
      total_cost: '393.42',
      items: [
        { feature_id: 'f2', name: 'Storage', total_cost: '25', total_usage: '250', points: [] },
        {
          feature_id: 'f1',
          name: 'API calls',
          total_cost: '100',
          total_usage: '500000',
          price: { billing_model: 'FLAT_FEE', amount: '0.0002' },
          points: [{ timestamp: '2026-10-01T00:00:00Z', usage: '10', cost: '1' }],
        },
        {
          feature_id: 'f1',
          name: 'API calls',
          total_cost: '68.42',
          total_usage: '342100',
          points: [{ timestamp: '2026-10-01T00:00:00Z', usage: '5', cost: '0.5' }],
        },
      ],
    })
    expect(spend.items.map((i) => [i.name, i.cost.amount, i.usage])).toEqual([
      ['API calls', '168.42', '842100'],
      ['Storage', '25', '250'],
    ])
    expect(spend.items[0]!.points).toEqual([
      { at: new Date('2026-10-01T00:00:00Z'), usage: 15, cost: 1.5 },
    ])
    expect(spend.items[0]!.share).toBeCloseTo(0.428, 2)
    // Priced twice: the effective rate, marked as an average.
    expect(spend.items[0]!.unitCost?.amount).toBe('0.0002')
    expect(spend.items[0]!.unitCostIsAverage).toBe(true)
  })

  it('grouped by a property, splits each feature by its value', () => {
    const spend = toPortalSpend(
      {
        currency: 'usd',
        items: [
          { feature_id: 'f1', name: 'API calls', total_cost: '6', properties: { region: 'eu' } },
          { feature_id: 'f1', name: 'API calls', total_cost: '4', properties: { region: 'us' } },
          { feature_id: 'f2', name: 'Storage', total_cost: '1', properties: {} },
        ],
      },
      'region',
    )
    expect(spend.items.map((i) => [i.group, i.name, i.cost.amount])).toEqual([
      ['eu', 'API calls', '6'],
      ['us', 'API calls', '4'],
      ['No value', 'Storage', '1'],
    ])
    expect(spend.total.amount).toBe('11')
  })

  it('reads the property keys a customer may group by', () => {
    expect(toPortalPropertyKeys({ keys: ['region', '', 'region', 'model'] })).toEqual([
      'region',
      'model',
    ])
    expect(toPortalPropertyKeys(null)).toEqual([])
  })

  it('gives a tiered price a unit price too: cost over usage', () => {
    const spend = toPortalSpend({
      currency: 'usd',
      items: [
        {
          feature_id: 'f1',
          name: 'Voice minutes',
          total_cost: '39.98',
          total_usage: '2000',
          price: { billing_model: 'TIERED', amount: '' },
          points: [],
        },
        {
          feature_id: 'f2',
          name: 'Calls',
          total_cost: '10',
          total_usage: '50000',
          price: { billing_model: 'FLAT_FEE', amount: '0.0002' },
          points: [],
        },
        { feature_id: 'f3', name: 'Idle', total_cost: '0', total_usage: '0', points: [] },
      ],
    })
    const byName = Object.fromEntries(spend.items.map((i) => [i.name, i]))
    expect(byName['Voice minutes']?.unitCost?.amount).toBe('0.01999')
    expect(byName['Voice minutes']?.unitCostIsAverage).toBe(true)
    expect(byName['Calls']?.unitCost?.amount).toBe('0.0002')
    expect(byName['Calls']?.unitCostIsAverage).toBe(false)
    expect(byName['Idle']?.unitCost).toBeNull()
  })
})
