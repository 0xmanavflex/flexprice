import { describe, expect, it } from 'vitest'
import { ACTIVE_CUSTOMERS_FILTER, DEFAULT_CUSTOMER_QUERY, CustomerStatus } from '@fp/domain'
import { parseCustomerSearch } from './customerSearch'

describe('parseCustomerSearch', () => {
  it('keeps an ascending sort; the default is descending, so asc must not fall back to it', () => {
    expect(parseCustomerSearch({ sortBy: 'name', sortDirection: 'asc' })).toMatchObject({
      sortBy: 'name',
      sortDirection: 'asc',
    })
  })

  it('keeps a space in the search, so the box can hold one while typing', () => {
    expect(parseCustomerSearch({ search: 'demo customer' }).search).toBe('demo customer')
    expect(parseCustomerSearch({ search: 'demo ' }).search).toBe('demo ')
  })

  it('returns defaults for an empty URL', () => {
    expect(parseCustomerSearch({})).toEqual(DEFAULT_CUSTOMER_QUERY)
  })

  it('reads a full query', () => {
    expect(
      parseCustomerSearch({
        page: '2',
        size: '50',
        q: 'acme',
        status: 'archived',
        sort: 'createdAt',
        dir: 'desc',
        filters: '[{"field":"email","op":"contains","value":"@acme"}]',
      }),
    ).toEqual({
      page: 2,
      pageSize: 50,
      search: 'acme',
      statuses: [CustomerStatus.Archived],
      sortBy: 'createdAt',
      sortDirection: 'desc',
      filters: [{ field: 'email', op: 'contains', value: '@acme' }],
    })
  })

  it('opens on active customers, and an explicit empty filter list means every status', () => {
    expect(parseCustomerSearch({}).filters).toEqual([ACTIVE_CUSTOMERS_FILTER])
    expect(parseCustomerSearch({ filters: [] }).filters).toEqual([])
    expect(parseCustomerSearch({ filters: '[]' }).filters).toEqual([])
  })

  it('leaves the default filter off a link that names a status', () => {
    const query = parseCustomerSearch({ status: 'archived' })
    expect(query.filters).toEqual([{ field: 'status', op: 'in', value: ['archived'] }])
    expect(query.statuses).toEqual([])
  })

  it('drops filters it cannot run', () => {
    expect(
      parseCustomerSearch({ filters: [{ field: 'plan', op: 'eq', value: 'x' }] }).filters,
    ).toEqual([])
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    // Alongside explicit filters the facet is kept as written…
    expect(
      parseCustomerSearch({ status: ['published', 'archived'], filters: [] }).statuses,
    ).toEqual(['published', 'archived'])
    // …and on its own it becomes the visible status filter.
    expect(parseCustomerSearch({ status: 'published,archived' }).filters).toEqual([
      { field: 'status', op: 'in', value: ['published', 'archived'] },
    ])
  })

  it.each([
    ['a bad page', { page: 'abc' }],
    ['page zero', { page: '0' }],
    ['an unknown status', { status: 'expired' }],
    ['nulls', { page: null, status: null, q: null }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parseCustomerSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseCustomerSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parseCustomerSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('is stable across a parse of its own output', () => {
    const once = parseCustomerSearch({
      status: ['archived'],
      sortBy: 'name',
      sortDirection: 'desc',
    })
    expect(parseCustomerSearch({ ...once })).toEqual(once)
  })
})
