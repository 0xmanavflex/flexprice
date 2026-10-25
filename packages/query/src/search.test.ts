import { describe, expect, it } from 'vitest'
import { FilterOp, type ListFilterSpec } from '@fp/domain'
import { toFilterConditions, toMetadataFilter } from './search'

const SPECS: ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  { field: 'status', label: 'Status', kind: 'options', options: [] },
  { field: 'created_at', label: 'Created', kind: 'date' },
  { field: 'amount_due', label: 'Amount due', kind: 'number' },
  { field: 'metadata', label: 'Metadata', kind: 'keyvalue' },
]

describe('toFilterConditions', () => {
  it('types each condition for the search DSL', () => {
    expect(
      toFilterConditions(
        [
          { field: 'name', op: FilterOp.Contains, value: ' acme ' },
          { field: 'status', op: FilterOp.NotIn, value: ['archived'] },
          { field: 'created_at', op: FilterOp.After, value: '2026-10-01' },
          { field: 'created_at', op: FilterOp.Before, value: '2026-10-05' },
          { field: 'amount_due', op: FilterOp.Gt, value: '100' },
        ],
        SPECS,
      ),
    ).toEqual([
      { field: 'name', operator: 'contains', dataType: 'string', value: { string: 'acme' } },
      { field: 'status', operator: 'not_in', dataType: 'array', value: { array: ['archived'] } },
      {
        field: 'created_at',
        operator: 'after',
        dataType: 'date',
        value: { date: '2026-10-02T00:00:00.000Z' },
      },
      {
        field: 'created_at',
        operator: 'before',
        dataType: 'date',
        value: { date: '2026-10-05T00:00:00.000Z' },
      },
      { field: 'amount_due', operator: 'gt', dataType: 'number', value: { number: 100 } },
    ])
  })

  it('drops incomplete filters', () => {
    expect(toFilterConditions([{ field: 'name', op: FilterOp.Eq, value: '' }], SPECS)).toEqual([])
  })
})

describe('toMetadataFilter', () => {
  it('sends key/value pairs as the metadata map, not as conditions', () => {
    const filters = [
      { field: 'metadata', op: FilterOp.Eq, value: 'region=eu' },
      { field: 'metadata', op: FilterOp.Eq, value: 'tier=gold' },
      { field: 'name', op: FilterOp.Contains, value: 'Acme' },
    ]
    expect(toMetadataFilter(filters, SPECS)).toEqual({ region: 'eu', tier: 'gold' })
    expect(toFilterConditions(filters, SPECS)).toEqual([
      expect.objectContaining({ field: 'name', operator: 'contains' }),
    ])
  })

  it('is empty without key/value filters', () => {
    expect(toMetadataFilter([], SPECS)).toEqual({})
  })
})
