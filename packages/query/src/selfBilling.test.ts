import { describe, expect, it } from 'vitest'
import {
  toCheckoutBody,
  toSelfBillingCheckout,
  toSelfBillingPlan,
  toSelfBillingStatus,
  toSelfBillingSummary,
} from './selfBilling'

describe('toSelfBillingSummary', () => {
  it('reads the trial, invoices, the event cap and what was billed', () => {
    const summary = toSelfBillingSummary(
      {
        status: 'suspended',
        subscription_status: 'incomplete',
        trial_ends_at: '2026-10-10T00:00:00Z',
        invoices: [
          {
            id: 'inv_1',
            number: 'FP-0001',
            payment_status: 'PENDING',
            total: '199',
            currency: 'usd',
            due_date: '2026-10-10T00:00:00Z',
            pdf_url: '',
          },
        ],
        usage: {
          period: { start_time: '2026-10-10T00:00:00Z', end_time: '2026-11-10T00:00:00Z' },
          features: [
            {
              feature: { meter: { event_name: 'events_ingested' } },
              total_limit: 50000,
              is_unlimited: false,
              current_usage: '46900',
            },
            { feature: { lookup_key: 'invoice_value' }, is_unlimited: true, current_usage: '0' },
          ],
        },
      },
      '2026-10-20',
    )
    expect(summary).toEqual({
      state: 'suspended',
      plan: null,
      trialEndsOn: '2026-10-10',
      invoices: [
        {
          id: 'inv_1',
          number: 'FP-0001',
          status: 'overdue',
          total: 199,
          currency: 'USD',
          dueDate: '2026-10-10',
          pdfUrl: null,
        },
      ],
      events: { used: 46900, cap: 50000 },
      billed: 0,
      period: { start: '2026-10-10', end: '2026-11-10' },
    })
  })

  it('has no cap once unlimited, and no usage when none came back', () => {
    expect(
      toSelfBillingSummary({
        status: 'active',
        usage: {
          features: [
            {
              feature: { meter: { event_name: 'events_ingested' } },
              is_unlimited: true,
              current_usage: '12480000',
            },
          ],
        },
      }).events,
    ).toEqual({ used: 12480000, cap: null })
    expect(toSelfBillingSummary({ status: 'trialing' }).events).toBeNull()
  })

  it('reads the plan and its charges from the API, and none when it sends none', () => {
    const { plan } = toSelfBillingSummary({
      status: 'trialing',
      plan: {
        id: 'plan_1',
        name: 'Pay as you go',
        description: 'For everyone',
        charges: [
          {
            price_id: 'price_base',
            display_name: 'Platform fee',
            type: 'FIXED',
            amount: '199',
            currency: 'usd',
            billing_period: 'MONTHLY',
            billing_period_count: 1,
          },
          {
            price_id: 'price_rate',
            display_name: 'Billing fee',
            type: 'USAGE',
            amount: '0.005',
            currency: 'usd',
            billing_period: 'MONTHLY',
            transform_quantity: { divide_by: 0 },
            meter_display_name: 'Invoice value',
          },
        ],
      },
    })
    expect(plan).toEqual({
      id: 'plan_1',
      name: 'Pay as you go',
      description: 'For everyone',
      charges: [
        {
          id: 'price_base',
          name: 'Platform fee',
          type: 'fixed',
          amount: '199',
          currency: 'USD',
          billingPeriod: 'MONTHLY',
          billingPeriodCount: 1,
          divideBy: null,
          meterName: null,
          shareOfBilled: false,
        },
        {
          id: 'price_rate',
          name: 'Billing fee',
          type: 'usage',
          amount: '0.005',
          currency: 'USD',
          billingPeriod: 'MONTHLY',
          billingPeriodCount: 1,
          divideBy: null,
          meterName: 'Invoice value',
          shareOfBilled: true,
        },
      ],
    })
    expect(toSelfBillingSummary({ status: 'trialing' }).plan).toBeNull()
    expect(
      toSelfBillingSummary({ status: 'trialing', plan: { id: '', charges: [] } }).plan,
    ).toBeNull()
  })
})

describe('status and checkout', () => {
  it('reads unknown states as none', () => {
    expect(toSelfBillingStatus({ enabled: true, status: 'trialing' })).toEqual({
      enabled: true,
      state: 'trialing',
    })
    expect(toSelfBillingStatus({})).toEqual({ enabled: false, state: null })
    expect(
      toSelfBillingCheckout({
        checkout_id: 'co_1',
        url: 'https://checkout.stripe.com/x',
        status: 'initiated',
        terminal: false,
        tenant_status: 'trialing',
      }),
    ).toEqual({
      checkoutId: 'co_1',
      url: 'https://checkout.stripe.com/x',
      status: 'initiated',
      terminal: false,
      state: 'trialing',
    })
  })

  it('reads a trial from subscription_status when status only says the account is usable', () => {
    // As /portal/billing/summary answered on 2026-11-02 for a trialing tenant.
    const summary = toSelfBillingSummary(
      {
        status: 'active',
        subscription_status: 'trialing',
        trial_ends_at: '2026-11-20T18:30:00Z',
        usage: {
          features: [
            {
              feature: {
                lookup_key: 'feat-events',
                meter: { id: 'meter_events', event_name: 'events_ingested' },
              },
              total_limit: 10000,
              is_unlimited: false,
              current_usage: '0',
            },
          ],
          period: null,
        },
        plan: {
          id: 'plan_1',
          name: 'Billing prod',
          charges: [
            {
              price_id: 'price_invoice_value',
              display_name: 'Invoice value',
              type: 'USAGE',
              amount: '0.005',
              currency: 'usd',
              billing_period: 'MONTHLY',
              meter_id: 'meter_invoice_value',
              meter_display_name: 'Invoice value',
            },
            {
              price_id: 'price_events',
              display_name: 'Events',
              type: 'USAGE',
              amount: '0',
              currency: 'usd',
              billing_period: 'MONTHLY',
              meter_id: 'meter_events',
              meter_display_name: 'Events',
            },
            {
              price_id: 'price_fixed',
              display_name: 'Fixed charge',
              type: 'FIXED',
              amount: '1',
              currency: 'usd',
              billing_period: 'MONTHLY',
              billing_period_count: 1,
            },
          ],
        },
      },
      '2026-11-02',
    )
    expect(summary.state).toBe('trialing')
    expect(summary.trialEndsOn).toBe('2026-11-20')
    expect(summary.events).toEqual({ used: 0, cap: 10000 })
    expect(summary.plan?.charges.map((c) => [c.id, c.shareOfBilled])).toEqual([
      ['price_invoice_value', true],
      ['price_events', false],
      ['price_fixed', false],
    ])
  })

  it('keeps an active, paying account active', () => {
    expect(
      toSelfBillingSummary({ status: 'active', subscription_status: 'active' }, '2026-11-02').state,
    ).toBe('active')
    expect(
      toSelfBillingSummary({ status: 'suspended', subscription_status: 'trialing' }, '2026-11-02')
        .state,
    ).toBe('suspended')
  })

  it('knows the invoice-value charge by its meter even when it is renamed', () => {
    const plan = toSelfBillingPlan(
      {
        id: 'plan_1',
        name: 'Pro',
        charges: [
          {
            price_id: 'p1',
            display_name: 'Platform share',
            type: 'USAGE',
            amount: '0.01',
            meter_id: 'm_iv',
          },
        ],
      },
      [{ feature: { meter: { id: 'm_iv', event_name: 'invoice_value' } }, current_usage: '0' }],
    )
    expect(plan?.charges[0]?.shareOfBilled).toBe(true)
  })

  it('sends the address as the API names it', () => {
    expect(
      toCheckoutBody({
        name: ' Acme Inc ',
        email: 'billing@acme.io',
        country: 'us',
        line1: '548 Market St',
        line2: '',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94104',
        taxId: '',
      }),
    ).toEqual({
      name: 'Acme Inc',
      email: 'billing@acme.io',
      address_line1: '548 Market St',
      address_line2: '',
      address_city: 'San Francisco',
      address_state: 'CA',
      address_country: 'US',
      address_postal_code: '94104',
      tax_id: '',
    })
  })
})
