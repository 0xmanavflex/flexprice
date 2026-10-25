import { describe, expect, it } from 'vitest'
import { sortWithTieBreak } from './listSort'

describe('sortWithTieBreak', () => {
  it('appends id so tied rows have a defined order', () => {
    expect(sortWithTieBreak('updated_at', 'desc')).toEqual([
      { field: 'updated_at', direction: 'desc' },
      { field: 'id', direction: 'desc' },
    ])
  })

  it('points the tie-break the same way as the primary key', () => {
    expect(sortWithTieBreak('created_at', 'asc')).toEqual([
      { field: 'created_at', direction: 'asc' },
      { field: 'id', direction: 'asc' },
    ])
  })

  it('leaves a sort by id alone: it is already a total order', () => {
    expect(sortWithTieBreak('id', 'asc')).toEqual([{ field: 'id', direction: 'asc' }])
  })
})
