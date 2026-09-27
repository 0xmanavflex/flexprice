import { DEFAULT_PLAN_QUERY, type Plan, type PlanQuery, PlanStatus } from '@fp/domain'

/** Plans as plain domain values — no client, no provider, no network. */
export const planFixtures: Plan[] = [
  {
    id: 'plan_01',
    name: 'Starter',
    lookupKey: 'plan_starter',
    description: 'Entry tier, monthly',
    status: PlanStatus.Published,
    chargeCount: 1,
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
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-03-20T00:00:00Z'),
  },
  {
    // Archived, and priced nothing — the row that shows both edge states.
    id: 'plan_04',
    name: 'Legacy Team',
    lookupKey: 'plan_legacy_team',
    description: 'Retired, kept for existing subscribers',
    status: PlanStatus.Archived,
    chargeCount: 0,
    createdAt: new Date('2025-11-01T00:00:00Z'),
    updatedAt: new Date('2026-01-05T00:00:00Z'),
  },
  {
    // No lookup key and no description — the row a hand-written demo omits.
    id: 'plan_05',
    name: 'Enterprise',
    lookupKey: '',
    description: '',
    status: PlanStatus.Published,
    chargeCount: 2,
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
