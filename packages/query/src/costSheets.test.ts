import { describe, expect, it } from 'vitest'
import { CostSheetStatus, DEFAULT_COST_SHEET_QUERY } from '@fp/domain'
import { toCostSheet, toCostSheetFilter, type CostSheetWire } from './costSheets'

describe('toCostSheet', () => {
  it('counts the grouped prices and drops the array', () => {
    const sheet = toCostSheet({
      id: 'cs_1',
      name: 'Infra costs',
      lookupKey: 'infra',
      description: 'Compute and storage',
      prices: [{}, {}, {}],
      status: 'published',
    })

    expect(sheet.priceCount).toBe(3)
    expect(sheet.description).toBe('Compute and storage')
    expect(sheet).not.toHaveProperty('prices')
  })

  it('reports zero prices when the sheet groups none', () => {
    expect(toCostSheet({ name: 'Empty' }).priceCount).toBe(0)
    expect(toCostSheet({ name: 'Empty', prices: [] }).priceCount).toBe(0)
  })

  it('falls back to safe defaults for unknown or missing values', () => {
    const sheet = toCostSheet({ status: 'deleted' } as CostSheetWire)
    expect(sheet.status).toBe(CostSheetStatus.Published)
    expect(sheet.name).toBe('Untitled cost sheet')
    expect(sheet.lookupKey).toBe('')
    expect(sheet.description).toBe('')
  })
})

describe('toCostSheetFilter', () => {
  it('nests paging under queryFilter and maps the sort field', () => {
    const filter = toCostSheetFilter({
      ...DEFAULT_COST_SHEET_QUERY,
      page: 3,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    })
    expect(filter).toMatchObject({
      queryFilter: { limit: 25, offset: 50 },
      sort: [
        { field: 'updated_at', direction: 'desc' },
        { field: 'id', direction: 'desc' },
      ],
    })
  })

  it('asks for the prices, which the list counts as line items', () => {
    expect(toCostSheetFilter(DEFAULT_COST_SHEET_QUERY)).toMatchObject({
      queryFilter: { expand: 'prices' },
    })
  })

  it('omits the name key when the query has no search term', () => {
    expect(toCostSheetFilter(DEFAULT_COST_SHEET_QUERY)).not.toHaveProperty('name')
    expect(toCostSheetFilter({ ...DEFAULT_COST_SHEET_QUERY, search: 'infra' })).toHaveProperty(
      'name',
      'infra',
    )
  })
})
