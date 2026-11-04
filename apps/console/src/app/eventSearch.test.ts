import { describe, expect, it } from 'vitest'
import { DEFAULT_RAW_EVENT_QUERY } from '@fp/domain'
import { parseEventSearch } from './eventSearch'

describe('parseEventSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseEventSearch({})).toEqual(DEFAULT_RAW_EVENT_QUERY)
  })

  it('reads a full query', () => {
    expect(
      parseEventSearch({
        page: '2',
        size: '50',
        q: 'api_call',
        customer: 'acme',
        source: 'sdk',
        dir: 'asc',
        period: '90d',
      }),
    ).toEqual({
      page: 2,
      pageSize: 50,
      search: 'api_call',
      customer: 'acme',
      source: 'sdk',
      sortDirection: 'asc',
      period: '90d',
    })
  })

  it('looks back 30 days unless a known window is asked for', () => {
    expect(parseEventSearch({}).period).toBe('30d')
    expect(parseEventSearch({ period: 'forever' }).period).toBe('30d')
  })

  it('defaults to newest first and only honours asc', () => {
    expect(parseEventSearch({ dir: 'sideways' }).sortDirection).toBe('desc')
  })

  it('caps the page size', () => {
    expect(parseEventSearch({ size: '5000' }).pageSize).toBe(100)
  })

  it.each([
    ['a bad page', { page: 'abc' }],
    ['page zero', { page: '0' }],
    ['nulls', { page: null, q: null, customer: null, source: null }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parseEventSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseEventSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })
})
