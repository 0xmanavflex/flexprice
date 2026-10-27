import { describe, expect, it } from 'vitest'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import {
  oneRulePerField,
  resolveActivityFilters,
  sortActivityRows,
  type ActivityRowView,
} from './CustomerActivityView'

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

describe('resolving the activity filter', () => {
  const rule = (field: string, value: string) => ({ field, operator: 'is', values: [value] })

  it('keeps the last value when a field has two rules', () => {
    expect(
      resolveActivityFilters([rule('action', 'customer.created'), rule('action', 'invoice.paid')], {
        actorType: '',
      }).action,
    ).toBe('invoice.paid')
  })

  it('a newly chosen person sets the actor to people, over another actor type', () => {
    expect(
      resolveActivityFilters([rule('actorType', 'system'), rule('actorId', 'user_2')], {
        actorType: 'system',
        actorId: '',
      }),
    ).toMatchObject({ actorType: 'user', actorId: 'user_2' })
  })

  it('a newly chosen actor type drops the person', () => {
    expect(
      resolveActivityFilters([rule('actorType', 'system'), rule('actorId', 'user_2')], {
        actorType: 'user',
        actorId: 'user_2',
      }),
    ).toMatchObject({ actorType: 'system', actorId: '' })
  })
})

describe('one rule per field', () => {
  it('keeps the latest rule of each field', () => {
    const query = createFilterQuery([
      createFilterRule({ id: 'a', path: ['action'], operator: 'is', value: 'customer.created' }),
      createFilterRule({ id: 'b', path: ['source'], operator: 'is', value: 'api' }),
      createFilterRule({ id: 'c', path: ['action'], operator: 'is', value: 'invoice.paid' }),
    ])
    expect(oneRulePerField(query).rules.map((node) => node.id)).toEqual(['b', 'c'])
  })
})
