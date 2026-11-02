import { describe, expect, it } from 'vitest'
import { CreditNoteStatus, DEFAULT_CREDIT_NOTE_QUERY } from '@fp/domain'
import { parseCreditNoteSearch } from './creditNoteSearch'

describe('parseCreditNoteSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseCreditNoteSearch({})).toEqual(DEFAULT_CREDIT_NOTE_QUERY)
  })

  it('reads the short spelling', () => {
    expect(
      parseCreditNoteSearch({ page: '3', size: '50', q: 'acme', status: 'draft,voided' }),
    ).toEqual({
      page: 3,
      pageSize: 50,
      search: 'acme',
      statuses: [CreditNoteStatus.Draft, CreditNoteStatus.Voided],
      filters: [],
    })
  })

  it('reads the long spelling', () => {
    expect(
      parseCreditNoteSearch({ pageSize: '10', search: 'x', statuses: ['finalized'] }),
    ).toMatchObject({
      pageSize: 10,
      search: 'x',
      statuses: [CreditNoteStatus.Finalized],
    })
  })

  it('drops unknown and duplicate statuses and caps the page size', () => {
    const query = parseCreditNoteSearch({ status: 'draft,bogus,draft', size: '9999' })
    expect(query.statuses).toEqual([CreditNoteStatus.Draft])
    expect(query.pageSize).toBe(100)
  })

  it('degrades junk rather than throwing', () => {
    expect(parseCreditNoteSearch({ page: 'abc', q: null, status: null }).page).toBe(1)
  })
})
