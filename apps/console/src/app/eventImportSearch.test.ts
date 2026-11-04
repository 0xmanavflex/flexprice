import { describe, expect, it } from 'vitest'
import { DEFAULT_EVENT_IMPORT_QUERY } from '@fp/domain'
import { parseEventImportSearch } from './eventImportSearch'

describe('parseEventImportSearch', () => {
  it('returns the defaults for an empty URL', () => {
    expect(parseEventImportSearch({})).toEqual(DEFAULT_EVENT_IMPORT_QUERY)
  })

  it('reads the status, the page, the search and the open import', () => {
    expect(
      parseEventImportSearch({ status: 'FAILED', page: '2', size: '50', q: 'oct', open: 'task_1' }),
    ).toEqual({ page: 2, pageSize: 50, status: 'FAILED', search: 'oct', open: 'task_1' })
  })

  it('falls back on junk', () => {
    expect(parseEventImportSearch({ page: '-3', size: '9999', status: 'done' })).toMatchObject({
      page: 1,
      pageSize: 100,
      status: 'all',
    })
  })
})
