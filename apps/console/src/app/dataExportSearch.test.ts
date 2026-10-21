import { describe, expect, it } from 'vitest'
import { DEFAULT_DATA_EXPORT_QUERY } from '@fp/domain'
import { parseDataExportSearch } from './dataExportSearch'

describe('parseDataExportSearch', () => {
  it('returns the defaults for an empty URL', () => {
    expect(parseDataExportSearch({})).toEqual(DEFAULT_DATA_EXPORT_QUERY)
  })

  it('reads both the short and the long spellings', () => {
    expect(parseDataExportSearch({ q: 'acme', size: '50', status: 'enabled' })).toEqual({
      page: 1,
      pageSize: 50,
      search: 'acme',
      state: 'enabled',
    })
    expect(
      parseDataExportSearch({ search: 'acme', pageSize: 10, state: 'disabled' }),
    ).toMatchObject({
      search: 'acme',
      pageSize: 10,
      state: 'disabled',
    })
  })

  it('falls back on junk', () => {
    expect(parseDataExportSearch({ page: '-3', size: '9999', status: 'paused' })).toMatchObject({
      page: 1,
      pageSize: 100,
      state: 'all',
    })
  })
})
