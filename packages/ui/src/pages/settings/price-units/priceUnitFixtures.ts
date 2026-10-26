import {
  DEFAULT_PRICE_UNIT_QUERY,
  type PriceUnit,
  type PriceUnitQuery,
  PriceUnitStatus,
} from '@fp/domain'

/** Price units as plain domain values: no client, no provider, no network. */
export const priceUnitFixtures: PriceUnit[] = [
  {
    id: 'pu_01',
    name: 'Credits',
    code: 'CRD',
    symbol: '⛁',
    baseCurrency: 'USD',
    conversionRate: '0.01',
    status: PriceUnitStatus.Published,
    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  },
  {
    // A tiny rate: the row that proves the formatter keeps its decimals instead
    // of rounding to zero.
    id: 'pu_02',
    name: 'Tokens',
    code: 'TOK',
    symbol: '◈',
    baseCurrency: 'USD',
    conversionRate: '0.0000025',
    status: PriceUnitStatus.Published,
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-02-14T00:00:00Z'),
  },
  {
    id: 'pu_03',
    name: 'Euro credits',
    code: 'EUC',
    symbol: '✦',
    baseCurrency: 'EUR',
    conversionRate: '0.02',
    status: PriceUnitStatus.Published,
    createdAt: new Date('2026-01-18T00:00:00Z'),
    updatedAt: new Date('2026-02-28T00:00:00Z'),
  },
  {
    id: 'pu_04',
    name: 'Rupee coins',
    code: 'RCN',
    symbol: '◉',
    baseCurrency: 'INR',
    conversionRate: '1.5',
    status: PriceUnitStatus.Published,
    createdAt: new Date('2026-02-05T00:00:00Z'),
    updatedAt: new Date('2026-03-15T00:00:00Z'),
  },
  {
    // Archived: the muted row.
    id: 'pu_05',
    name: 'Legacy credits',
    code: 'LGC',
    symbol: '¤',
    baseCurrency: 'USD',
    conversionRate: '0.015',
    status: PriceUnitStatus.Archived,
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2025-12-01T00:00:00Z'),
  },
  {
    // No timestamps: the row a hand-written demo omits.
    id: 'pu_06',
    name: 'Storage gigabytes',
    code: 'SGB',
    symbol: '⛃',
    baseCurrency: 'USD',
    conversionRate: '0.10',
    status: PriceUnitStatus.Published,
    createdAt: null,
    updatedAt: null,
  },
]

export const fixturePriceUnitQuery: PriceUnitQuery = { ...DEFAULT_PRICE_UNIT_QUERY }

export function manyPriceUnits(count: number): PriceUnit[] {
  return Array.from({ length: count }, (_, index) => {
    const base = priceUnitFixtures[index % priceUnitFixtures.length] as PriceUnit
    return { ...base, id: `pu_page_${index}`, name: `${base.name} ${index}` }
  })
}
