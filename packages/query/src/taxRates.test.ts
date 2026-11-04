import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TAX_RATE_QUERY, TaxRateScope, TaxRateSortField, TaxRateStatus } from '@fp/domain'
import type { Flexprice } from '@fp/api'
import { fetchTaxRates, toTaxRate, toTaxRateFilter, type TaxRateWire } from './taxRates'

describe('toTaxRate', () => {
  it('keeps the percentage as the raw string the API sends', () => {
    const taxRate = toTaxRate({
      id: 'taxrate_1',
      name: 'GST',
      code: 'gst',
      description: 'Goods and services tax',
      percentageValue: '18',
      scope: 'EXTERNAL',
      status: 'published',
    })

    expect(taxRate.percentageValue).toBe('18')
    expect(taxRate.scope).toBe(TaxRateScope.External)
    expect(taxRate.status).toBe(TaxRateStatus.Published)
  })

  it('normalizes each known scope', () => {
    expect(toTaxRate({ scope: 'INTERNAL' }).scope).toBe(TaxRateScope.Internal)
    expect(toTaxRate({ scope: 'EXTERNAL' }).scope).toBe(TaxRateScope.External)
    expect(toTaxRate({ scope: 'ONETIME' }).scope).toBe(TaxRateScope.OneTime)
  })

  it('passes the createdAt/updatedAt dates through, and nulls them when absent', () => {
    const at = new Date('2026-01-01T00:00:00Z')
    const dated = toTaxRate({ createdAt: at, updatedAt: at })
    expect(dated.createdAt).toEqual(at)
    expect(dated.updatedAt).toEqual(at)

    const bare = toTaxRate({})
    expect(bare.createdAt).toBeNull()
    expect(bare.updatedAt).toBeNull()
  })

  it('falls back to safe defaults for unknown enum values and missing fields', () => {
    const taxRate = toTaxRate({ scope: 'galaxy', status: 'deleted' } as TaxRateWire)
    expect(taxRate.scope).toBe(TaxRateScope.Internal)
    expect(taxRate.status).toBe(TaxRateStatus.Published)
    expect(taxRate.name).toBe('Untitled tax rate')
    expect(taxRate.code).toBe('')
    expect(taxRate.description).toBe('')
    expect(taxRate.percentageValue).toBe('')
  })
})

describe('toTaxRateFilter', () => {
  it('computes limit and offset from the page and page size', () => {
    expect(toTaxRateFilter({ ...DEFAULT_TAX_RATE_QUERY, page: 3, pageSize: 25 })).toEqual({
      limit: 25,
      offset: 50,
    })
  })

  it('offsets to zero on the first page', () => {
    expect(toTaxRateFilter(DEFAULT_TAX_RATE_QUERY)).toMatchObject({ limit: 25, offset: 0 })
  })
})

describe('tax rate archive status', () => {
  it('reads an inactive rate as archived', () => {
    expect(toTaxRate({ id: 't', status: 'published', taxRateStatus: 'INACTIVE' }).status).toBe(
      'archived',
    )
    expect(toTaxRate({ id: 't', status: 'published', taxRateStatus: 'ACTIVE' }).status).toBe(
      'published',
    )
    // Republished: the record's own status stays archived, the rate's flag wins.
    expect(toTaxRate({ id: 't', status: 'archived', taxRateStatus: 'ACTIVE' }).status).toBe(
      'published',
    )
    expect(toTaxRate({ id: 't', status: 'archived' }).status).toBe('archived')
  })
})

describe('the tax rate status facet', () => {
  const client = {
    taxRates: {
      getTaxRates: async () => ({
        items: [
          { id: 'a', name: 'Active', status: 'published', taxRateStatus: 'ACTIVE' },
          { id: 'b', name: 'Archived by flag', status: 'published', taxRateStatus: 'INACTIVE' },
          { id: 'c', name: 'Republished', status: 'archived', taxRateStatus: 'ACTIVE' },
        ],
        pagination: { total: 3 },
      }),
    },
  } as unknown as Flexprice

  it('filters on the status the row shows, and counts what it shows', async () => {
    const archived = await fetchTaxRates(client, {
      ...DEFAULT_TAX_RATE_QUERY,
      statuses: [TaxRateStatus.Archived],
    })
    expect(archived.taxRates.map((rate) => rate.id)).toEqual(['b'])
    expect(archived.total).toBe(1)
    const published = await fetchTaxRates(client, {
      ...DEFAULT_TAX_RATE_QUERY,
      statuses: [TaxRateStatus.Published],
    })
    expect(published.taxRates.map((rate) => rate.id)).toEqual(['a', 'c'])
  })
})

describe('the tax rate list reads every rate', () => {
  const rates = Array.from({ length: 7 }, (_, index) => ({
    id: `t${index}`,
    name: `Rate ${String.fromCharCode(71 - index)}`,
    code: index === 5 ? 'vat-de' : `code-${index}`,
    createdAt: new Date(Date.UTC(2026, 0, index + 1)),
    updatedAt: new Date(Date.UTC(2026, 1, 7 - index)),
  }))
  const getTaxRates = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => ({
    items: rates.slice(offset, offset + limit),
    pagination: { total: rates.length },
  }))
  const client = { taxRates: { getTaxRates } } as unknown as Flexprice

  it('searches past the first page and counts the matches', async () => {
    const page = await fetchTaxRates(client, {
      ...DEFAULT_TAX_RATE_QUERY,
      pageSize: 2,
      search: 'VAT',
    })
    expect(page.taxRates.map((rate) => rate.id)).toEqual(['t5'])
    expect(page.total).toBe(1)
  })

  it('sorts every rate by the chosen field and direction before paging', async () => {
    const byName = await fetchTaxRates(client, {
      ...DEFAULT_TAX_RATE_QUERY,
      pageSize: 3,
      sortBy: TaxRateSortField.Name,
      sortDirection: 'asc',
    })
    expect(byName.taxRates.map((rate) => rate.name)).toEqual(['Rate A', 'Rate B', 'Rate C'])
    expect(byName.total).toBe(7)
    const oldest = await fetchTaxRates(client, {
      ...DEFAULT_TAX_RATE_QUERY,
      page: 3,
      pageSize: 3,
      sortBy: TaxRateSortField.CreatedAt,
      sortDirection: 'asc',
    })
    expect(oldest.taxRates.map((rate) => rate.id)).toEqual(['t6'])
  })
})
