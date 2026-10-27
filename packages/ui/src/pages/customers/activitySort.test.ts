import { describe, expect, it } from 'vitest'
import { sortActivityRows, type ActivityRowView } from './CustomerActivityView'

const row = (id: string, title: string, actor: string, source: string) =>
  ({ id, title, actor, source }) as ActivityRowView

// As the API sends them: newest first.
const ROWS = [
  row('a', 'Invoice paid', 'Subrat', 'Workflow'),
  row('b', 'Customer created', 'Asha', 'API'),
  row('c', 'Wallet created', 'Billing', 'Dashboard'),
]

describe('sorting an activity page', () => {
  it('keeps the API order for newest first and reverses it for oldest first', () => {
    expect(sortActivityRows(ROWS, 'at', 'desc').map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(sortActivityRows(ROWS, 'at', 'asc').map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('orders by event, actor or source text', () => {
    expect(sortActivityRows(ROWS, 'event', 'asc').map((r) => r.id)).toEqual(['b', 'a', 'c'])
    expect(sortActivityRows(ROWS, 'actor', 'desc').map((r) => r.id)).toEqual(['a', 'c', 'b'])
    expect(sortActivityRows(ROWS, 'source', 'asc').map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not change the rows it was given', () => {
    sortActivityRows(ROWS, 'at', 'asc')
    expect(ROWS.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})
