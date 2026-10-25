import { DEFAULT_ADDON_QUERY, type Addon, type AddonQuery, AddonStatus } from '@fp/domain'

/** Add-ons as plain domain values: no client, no provider, no network. */
export const addonFixtures: Addon[] = [
  {
    id: 'addon_01',
    name: 'Extra seats pack',
    lookupKey: 'extra_seats_pack',
    description: 'Ten additional seats',
    status: AddonStatus.Published,
    chargeCount: 2,
    fixedChargeCount: 2,
    usageChargeCount: 0,
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
  },
  {
    id: 'addon_02',
    name: 'Priority support',
    lookupKey: 'priority_support',
    description: 'Faster response times and a named contact',
    status: AddonStatus.Published,
    chargeCount: 3,
    fixedChargeCount: 1,
    usageChargeCount: 2,
    createdAt: new Date('2026-01-14T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  },
  {
    id: 'addon_03',
    name: 'Advanced analytics',
    lookupKey: 'advanced_analytics',
    description: '',
    status: AddonStatus.Published,
    chargeCount: 1,
    fixedChargeCount: 0,
    usageChargeCount: 1,
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-03-12T00:00:00Z'),
  },
  {
    // Archived: the row that shows the muted status.
    id: 'addon_04',
    name: 'Legacy SSO',
    lookupKey: 'legacy_sso',
    description: 'Retired, kept for existing subscribers',
    status: AddonStatus.Archived,
    chargeCount: 0,
    fixedChargeCount: 0,
    usageChargeCount: 0,
    createdAt: new Date('2025-11-01T00:00:00Z'),
    updatedAt: new Date('2026-01-05T00:00:00Z'),
  },
  {
    // No lookup key and no description: the row a hand-written demo omits.
    id: 'addon_05',
    name: 'Onboarding',
    lookupKey: '',
    description: '',
    status: AddonStatus.Published,
    chargeCount: 4,
    fixedChargeCount: 4,
    usageChargeCount: 0,
    createdAt: null,
    updatedAt: null,
  },
]

export const fixtureAddonQuery: AddonQuery = { ...DEFAULT_ADDON_QUERY }

export function manyAddons(count: number): Addon[] {
  return Array.from({ length: count }, (_, index) => {
    const base = addonFixtures[index % addonFixtures.length] as Addon
    return { ...base, id: `addon_page_${index}`, name: `${base.name} ${index}` }
  })
}
