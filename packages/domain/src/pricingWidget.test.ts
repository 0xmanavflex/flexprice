import { describe, expect, it } from 'vitest'
import { CreditGrantCadence, CreditGrantPeriod, type CreditGrant } from './creditGrant'
import type { Entitlement } from './entitlement'
import { FeatureType } from './feature'
import { PlanStatus, type Plan } from './plan'
import { BillingModel, BillingPeriod, PriceType, type Charge } from './price'
import {
  defaultPricingSelection,
  pricingCards,
  pricingOptions,
  pricingPreview,
  usageChargeCompact,
} from './pricingWidget'

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
      ['Starter', '$19', false],
      ['Pro', '$49', true],
      // Usage only reads $0, as V1's card does.
      ['Pay as you go', '$0', true],
    ])
    expect(cards[1]?.per).toBe('month')
    // A switched-off boolean feature is not "included".
    expect(cards[1]?.included.map((line) => line.label)).toEqual(['Unlimited AI message', 'SSO'])
    expect(cards[2]?.credits.map((line) => line.label)).toEqual([
      '100 credits · Free credits · one-time',
      '2,500 credits · Monthly top-up · monthly',
    ])
    expect(cards[2]?.credits[0]).toMatchObject({
      amount: '100 credits',
      name: 'Free credits',
      cadence: 'one-time',
      recurring: false,
    })
    expect(cards[1]?.included[0]).toMatchObject({ featureName: 'AI message' })
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
      ['Pro', '$490', 'year'],
    ])
  })
})

describe('pricing widget fees by model', () => {
  it('prices a tiered recurring fee from its floor, not as a $0 flat fee', () => {
    const [card] = pricingCards({
      plans: [plan('plan_t', 'Tiered')],
      chargesByPlan: new Map([
        [
          'plan_t',
          [
            charge('plan_t', { amount: '10' }),
            {
              ...charge('plan_t', {
                amount: '',
                billingModel: BillingModel.Tiered,
                tiers: [{ upTo: 5, unitAmount: '2', flatAmount: '30' }],
              } as Partial<Charge>),
              id: 'tiered',
            },
          ],
        ],
      ]),
      entitlements: [],
      creditGrantsByPlan: new Map(),
      selection: { period: BillingPeriod.Monthly, currency: 'USD' },
      now: NOW,
    })
    expect(card?.price).toBe('from $42')
  })

  it('carries the plan description to the card', () => {
    const [card] = pricingCards({
      plans: [{ ...plan('plan_starter', 'Starter'), description: 'For small teams' }],
      chargesByPlan,
      entitlements: [],
      creditGrantsByPlan: new Map(),
      selection: { period: BillingPeriod.Monthly, currency: 'USD' },
      now: NOW,
    })
    expect(card?.description).toBe('For small teams')
  })
})

describe('plan preview', () => {
  it('reads a plan as its widget card does, saying usage bills on top without listing it', () => {
    const preview = pricingPreview({
      plan: plan('plan_pro', 'Pro'),
      charges: chargesByPlan.get('plan_pro')!,
      entitlements: [],
      creditGrants: [],
      now: NOW,
    })
    expect(preview).toMatchObject({ name: 'Pro', price: '$49', per: 'month', hasUsage: true })
    // Usage charges are not listed: a plan can meter thousands.
    expect(preview).not.toHaveProperty('usage')
  })

  it('has nothing to show before the plan has a charge', () => {
    expect(
      pricingPreview({
        plan: plan('plan_new', 'New'),
        charges: [],
        entitlements: [],
        creditGrants: [],
        now: NOW,
      }),
    ).toBeNull()
  })

  it('shows one-time fees, and a plan with nothing else still has a preview', () => {
    const setup = charge('plan_setup', {
      amount: '49',
      billingPeriod: BillingPeriod.OneTime,
      displayName: 'Setup fee',
    } as Partial<Charge>)
    const alone = pricingPreview({
      plan: plan('plan_setup', 'Setup only'),
      charges: [setup],
      entitlements: [],
      creditGrants: [],
      now: NOW,
    })
    expect(alone).toMatchObject({ price: '$49', per: null, hasUsage: false })
    expect(alone?.oneTime).toEqual([{ id: setup.id, name: 'Setup fee', price: '$49' }])

    const withFee = pricingPreview({
      plan: plan('plan_pro', 'Pro'),
      charges: [...chargesByPlan.get('plan_pro')!, { ...setup, entityId: 'plan_pro' }],
      entitlements: [],
      creditGrants: [],
      now: NOW,
    })
    // The fee is listed, not added to the monthly price.
    expect(withFee).toMatchObject({ price: '$49', per: 'month' })
    expect(withFee?.oneTime.map((line) => line.price)).toEqual(['$49'])
  })

  it('prices a tiered one-time fee from its tiers, not its empty amount', () => {
    const preview = pricingPreview({
      plan: plan('plan_tiered', 'Tiered setup'),
      charges: [
        charge('plan_tiered', {
          amount: '',
          billingPeriod: BillingPeriod.OneTime,
          billingModel: BillingModel.Tiered,
          displayName: 'Onboarding',
          tiers: [{ upTo: 10, unitAmount: '0', flatAmount: '49' }],
        } as Partial<Charge>),
      ],
      entitlements: [],
      creditGrants: [],
      now: NOW,
    })
    expect(preview?.price).toBe('from $49')
    expect(preview?.oneTime.map((line) => line.price)).toEqual(['from $49'])
  })

  it('floors a tiered fee at one unit of its first band, and counts it in the total', () => {
    const fee = (id: string, overrides: Partial<Charge>) =>
      ({
        ...charge('plan_mix', { billingPeriod: BillingPeriod.OneTime, ...overrides }),
        id,
      }) as Charge
    const preview = pricingPreview({
      plan: plan('plan_mix', 'Mixed'),
      charges: [
        fee('setup', { amount: '10', displayName: 'Setup' }),
        fee('onboarding', {
          amount: '',
          billingModel: BillingModel.Tiered,
          displayName: 'Onboarding',
          tiers: [{ upTo: 10, unitAmount: '2', flatAmount: '49' }],
        } as Partial<Charge>),
      ],
      entitlements: [],
      creditGrants: [],
      now: NOW,
    })
    expect(preview?.oneTime.map((line) => line.price)).toEqual(['$10', 'from $51'])
    expect(preview?.price).toBe('from $61')
  })

  it('keeps every decimal place a small tiered fee has, in its line and the total', () => {
    const preview = pricingPreview({
      plan: plan('plan_tiny', 'Tiny'),
      charges: [
        charge('plan_tiny', {
          amount: '',
          billingPeriod: BillingPeriod.OneTime,
          billingModel: BillingModel.Tiered,
          tiers: [{ upTo: null, unitAmount: '0.00000015', flatAmount: '0' }],
        } as Partial<Charge>),
      ],
      entitlements: [],
      creditGrants: [],
      now: NOW,
    })
    expect(preview?.oneTime.map((line) => line.price)).toEqual(['from $0.00000015'])
    expect(preview?.price).toBe('from $0.00000015')
  })

  it('adds one-time fees exactly, without binary rounding', () => {
    const fee = (id: string, amount: string) =>
      ({ ...charge('plan_exact', { amount, billingPeriod: BillingPeriod.OneTime }), id }) as Charge
    const preview = pricingPreview({
      plan: plan('plan_exact', 'Exact'),
      charges: [fee('a', '0.1'), fee('b', '0.00000000000000001')],
      entitlements: [],
      creditGrants: [],
      now: NOW,
    })
    expect(preview?.price).toBe('$0.10000000000000001')
  })

  it('keeps every decimal place a small rate has', () => {
    expect(usageChargeCompact(charge('p', { type: PriceType.Usage, amount: '0.00000015' }))).toBe(
      '$0.00000015/unit',
    )
  })

  it('words usage as V1 does', () => {
    expect(
      usageChargeCompact(
        charge('p', { type: PriceType.Usage, amount: '5', billingModel: BillingModel.Package }),
      ),
    ).toBe('$5/pkg')
    expect(
      usageChargeCompact(
        charge('p', {
          type: PriceType.Usage,
          billingModel: BillingModel.Tiered,
          tiers: [{ upTo: 1000, unitAmount: '0.002', flatAmount: '0' }],
        } as Partial<Charge>),
      ),
    ).toBe('from $0.002/unit')
  })
})

describe('a plan card allowance', () => {
  const card = (entitlement: Partial<Entitlement>) =>
    pricingCards({
      plans: [plan('plan_pro', 'Pro')],
      chargesByPlan,
      entitlements: [
        {
          id: 'ent_1',
          entityId: 'plan_pro',
          featureName: 'AI Messages',
          featureType: FeatureType.Metered,
          usageLimit: null,
          usageResetPeriod: null,
          ...entitlement,
        } as Entitlement,
      ],
      creditGrantsByPlan: new Map(),
      selection: { period: 'MONTHLY', currency: 'USD' },
      now: NOW,
    })[0]?.included[0]?.label

  it('keeps the period the allowance resets over', () => {
    expect(card({ usageLimit: 10, usageResetPeriod: 'MONTHLY' })).toBe('10 AI Messages per month')
    expect(card({ grantQuota: '100', grantDurationUnit: 'day', grantMeasure: 'quantity' })).toBe(
      '100 AI Messages per day',
    )
    expect(card({})).toBe('Unlimited AI Messages')
  })

  it('names an amount allowance as a value of usage', () => {
    expect(
      card({
        grantQuota: '12.5',
        grantDurationUnit: 'subscription_period',
        grantMeasure: 'amount',
      }),
    ).toBe('AI Messages: 12.5 of usage value per billing period')
  })
})
