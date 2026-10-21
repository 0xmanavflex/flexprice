import { describe, expect, it } from 'vitest'
import { DEFAULT_CUSTOMER_QUERY, CustomerStatus } from '@fp/domain'
import { parseCustomerSearch } from './customerSearch'

describe('parseCustomerSearch', () => {
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

  it('drops filters it cannot run', () => {
    expect(
      parseCustomerSearch({ filters: [{ field: 'plan', op: 'eq', value: 'x' }] }).filters,
    ).toEqual([])
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parseCustomerSearch({ status: ['published', 'archived'] }).statuses).toEqual([
      'published',
      'archived',
    ])
    expect(parseCustomerSearch({ status: 'published,archived' }).statuses).toEqual([
      'published',
      'archived',
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
