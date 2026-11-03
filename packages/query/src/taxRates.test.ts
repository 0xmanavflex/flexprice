import { describe, expect, it } from 'vitest'
import { DEFAULT_TAX_RATE_QUERY, TaxRateScope, TaxRateStatus } from '@fp/domain'
import { toTaxRate, toTaxRateFilter, type TaxRateWire } from './taxRates'

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
