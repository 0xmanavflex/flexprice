import { DEFAULT_PLAN_QUERY, type Plan, type PlanQuery, PlanStatus } from '@fp/domain'

/**
 * Plans as plain domain values: no client, no provider, no network.
 *
 * The charge splits cover all four `PlanKind`s between them, so a story that
 * renders this list renders every Type the column can show: flat-rate,
 * usage-based, hybrid and a plan with no charges at all.
 */
export const planFixtures: Plan[] = [
  {
    id: 'plan_01',
    name: 'Starter',
    lookupKey: 'plan_starter',
    description: 'Entry tier, monthly',
    status: PlanStatus.Published,
    chargeCount: 1,
    fixedChargeCount: 1,
    usageChargeCount: 0,
    headline: { amount: '$29', period: 'MONTHLY' },
    usageNames: [],
    metadata: {},
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
  },
  {
    id: 'plan_02',
    name: 'Pro',
    lookupKey: 'plan_pro',
    description: 'Seat-based with usage overage',
    status: PlanStatus.Published,
    chargeCount: 3,
    fixedChargeCount: 1,
    usageChargeCount: 2,
    headline: { amount: '$99', period: 'MONTHLY' },
    usageNames: ['Seats overage', 'API calls'],
    metadata: {},
    createdAt: new Date('2026-01-12T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'plan_03',
    name: 'Business',
    lookupKey: 'plan_business',
    description: '',
    status: PlanStatus.Published,
    chargeCount: 5,
    fixedChargeCount: 0,
    usageChargeCount: 5,
    // Usage-only: the API's first price is a usage rate, not a flat fee.
    headline: { amount: '$0.002', period: 'MONTHLY' },
    usageNames: ['API calls'],
    metadata: {},
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-03-20T00:00:00Z'),
  },
  {
    // Archived, and priced nothing: the row that shows both edge states.
    id: 'plan_04',
    name: 'Legacy Team',
    lookupKey: 'plan_legacy_team',
    description: 'Retired, kept for existing subscribers',
    status: PlanStatus.Archived,
    chargeCount: 0,
    fixedChargeCount: 0,
    usageChargeCount: 0,
    headline: null,
    usageNames: [],
    metadata: {},
    createdAt: new Date('2025-11-01T00:00:00Z'),
    updatedAt: new Date('2026-01-05T00:00:00Z'),
  },
  {
    // No lookup key and no description: the row a hand-written demo omits.
    id: 'plan_05',
    name: 'Enterprise',
    lookupKey: '',
    description: '',
    status: PlanStatus.Published,
    chargeCount: 2,
    fixedChargeCount: 2,
    usageChargeCount: 0,
    headline: { amount: 'Custom', period: '' },
    usageNames: [],
    metadata: {},
    createdAt: null,
    updatedAt: null,
  },
]

export const fixturePlanQuery: PlanQuery = { ...DEFAULT_PLAN_QUERY }

export function manyPlans(count: number): Plan[] {
  return Array.from({ length: count }, (_, index) => {
    const base = planFixtures[index % planFixtures.length] as Plan
    return { ...base, id: `plan_page_${index}`, name: `${base.name} ${index}` }
  })
}
