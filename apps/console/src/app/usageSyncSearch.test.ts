import { describe, expect, it } from 'vitest'
import { DEFAULT_USAGE_SYNC_QUERY } from '@fp/domain'
import { parseUsageSyncSearch } from './usageSyncSearch'

describe('parseUsageSyncSearch', () => {
  it('returns the defaults for an empty URL', () => {
    expect(parseUsageSyncSearch({})).toEqual(DEFAULT_USAGE_SYNC_QUERY)
  })

  it('reads both the short and the long spellings', () => {
    expect(parseUsageSyncSearch({ q: 'acme', size: '50', sync: 'unsynced' })).toEqual({
      page: 1,
      pageSize: 50,
      search: 'acme',
      state: 'unsynced',
    })
    expect(parseUsageSyncSearch({ search: 'acme', pageSize: 10, state: 'synced' })).toMatchObject({
      search: 'acme',
      pageSize: 10,
      state: 'synced',
    })
  })

  it('falls back on an unknown state and junk numbers, and caps the page size', () => {
    expect(parseUsageSyncSearch({ sync: 'maybe', page: '-2', size: '9999' })).toMatchObject({
      state: 'all',
      page: 1,
      pageSize: 100,
    })
  })
})
