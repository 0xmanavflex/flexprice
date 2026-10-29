import { describe, expect, it } from 'vitest'
import { CreditGrantCadence, CreditGrantPeriod, type CreditGrant } from './creditGrant'
import type { Entitlement } from './entitlement'
import { FeatureType } from './feature'
import { PlanStatus, type Plan } from './plan'
import { BillingPeriod, PriceType, type Charge } from './price'
import { defaultPricingSelection, pricingCards, pricingOptions } from './pricingWidget'

const NOW = Date.UTC(2026, 9, 29)

const plan = (id: string, name: string): Plan =>
  ({ id, name, description: '', status: PlanStatus.Published }) as Plan

const charge = (entityId: string, overrides: Partial<Charge>): Charge =>
  ({
    id: `${entityId}_${overrides.type ?? PriceType.Fixed}_${overrides.billingPeriod ?? 'M'}_${overrides.currency ?? 'usd'}`,
    entityId,
    type: PriceType.Fixed,
    amount: '0',
    currency: 'usd',
    billingPeriod: BillingPeriod.Monthly,
    endDate: null,
    ...overrides,
  }) as Charge

const chargesByPlan = new Map<string, Charge[]>([
  [
    'plan_pro',
    [
      charge('plan_pro', { amount: '49' }),
      charge('plan_pro', { amount: '490', billingPeriod: BillingPeriod.Annual }),
      charge('plan_pro', { type: PriceType.Usage, amount: '0.01' }),
    ],
  ],
  ['plan_starter', [charge('plan_starter', { amount: '19' })]],
  ['plan_payg', [charge('plan_payg', { type: PriceType.Usage, amount: '0.05' })]],
  ['plan_inr', [charge('plan_inr', { amount: '999', currency: 'inr' })]],
  ['plan_old', [charge('plan_old', { amount: '5', endDate: new Date(Date.UTC(2026, 0, 1)) })]],
])

const plans = [
  plan('plan_pro', 'Pro'),
  plan('plan_starter', 'Starter'),
  plan('plan_payg', 'Pay as you go'),
  plan('plan_inr', 'India'),
  plan('plan_old', 'Retired'),
]

describe('pricing widget', () => {
  it('offers the periods and currencies the live charges use', () => {
    expect(pricingOptions(chargesByPlan, NOW)).toEqual({
      periods: [
        { label: 'Monthly', value: 'MONTHLY' },
        { label: 'Annual', value: 'ANNUAL' },
      ],
      currencies: [
        { label: 'INR', value: 'INR' },
        { label: 'USD', value: 'USD' },
      ],
    })
  })

  it('opens on the period and currency that show the most plans with a fee', () => {
    expect(defaultPricingSelection(chargesByPlan, NOW)).toEqual({
      period: 'MONTHLY',
      currency: 'USD',
    })
    expect(defaultPricingSelection(new Map(), NOW)).toBeNull()
  })

  it('shows each plan priced in the selection, cheapest fee first and usage-only last', () => {
    const entitlements = [
      {
        id: 'ent_1',
        entityId: 'plan_pro',
        featureName: 'AI message',
        featureType: FeatureType.Metered,
        usageLimit: null,
      },
      {
        id: 'ent_2',
        entityId: 'plan_pro',
        featureName: 'SSO',
        featureType: FeatureType.Boolean,
        isEnabled: true,
      },
      {
        id: 'ent_3',
        entityId: 'plan_pro',
        featureName: 'Audit log',
        featureType: FeatureType.Boolean,
        isEnabled: false,
      },
    ] as unknown as Entitlement[]
    const grants = new Map<string, CreditGrant[]>([
      [
        'plan_payg',
        [
          {
            id: 'cg_1',
            name: 'Free credits',
            credits: '100',
            cadence: CreditGrantCadence.OneTime,
            period: null,
          } as CreditGrant,
          {
            id: 'cg_2',
            name: 'Monthly top-up',
            credits: '2500',
            cadence: CreditGrantCadence.Recurring,
            period: CreditGrantPeriod.Monthly,
          } as CreditGrant,
        ],
      ],
    ])
    const cards = pricingCards({
      plans,
      chargesByPlan,
      entitlements,
      creditGrantsByPlan: grants,
      selection: { period: 'MONTHLY', currency: 'USD' },
      now: NOW,
    })
    expect(cards.map((card) => [card.name, card.price, card.hasUsage])).toEqual([
      ['Starter', '$19.00', false],
      ['Pro', '$49.00', true],
      ['Pay as you go', null, true],
    ])
    expect(cards[1]?.per).toBe('month')
    // A switched-off boolean feature is not "included".
    expect(cards[1]?.included.map((line) => line.label)).toEqual(['Unlimited AI message', 'SSO'])
    expect(cards[2]?.credits.map((line) => line.label)).toEqual([
      '100 credits · Free credits · one-time',
      '2,500 credits · Monthly top-up · monthly',
    ])
  })

  it('switches price and plans with the selection', () => {
    const annual = pricingCards({
      plans,
      chargesByPlan,
      entitlements: [],
      creditGrantsByPlan: new Map(),
      selection: { period: 'ANNUAL', currency: 'USD' },
      now: NOW,
    })
    expect(annual.map((card) => [card.name, card.price, card.per])).toEqual([
      ['Pro', '$490.00', 'year'],
    ])
  })
})
