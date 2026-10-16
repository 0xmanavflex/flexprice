import { describe, expect, it } from 'vitest'
import {
  FilterOp,
  type ListFilterSpec,
  decodeListFilters,
  encodeListFilters,
  runnableFilters,
} from './listFilter'

const SPECS: ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  { field: 'status', label: 'Status', kind: 'options', options: [] },
  { field: 'created_at', label: 'Created', kind: 'date' },
  { field: 'amount', label: 'Amount', kind: 'number' },
]

describe('list filters', () => {
  it('round-trips through the URL', () => {
    const filters = [
      { field: 'name', op: FilterOp.Contains, value: 'acme' },
      { field: 'status', op: FilterOp.In, value: ['published'] },
    ]
    expect(decodeListFilters(encodeListFilters(filters))).toEqual(filters)
    expect(encodeListFilters([])).toBeUndefined()
  })

  it('reads a broken URL as no filter', () => {
    expect(decodeListFilters('{nope')).toEqual([])
    expect(decodeListFilters([{ field: 'name', op: 'starts_with', value: 'a' }])).toEqual([])
  })

  it('keeps only complete filters whose operator suits the field', () => {
    expect(
      runnableFilters(
        [
          { field: 'name', op: FilterOp.Contains, value: ' ' },
          { field: 'name', op: FilterOp.Gt, value: 'a' },
          { field: 'status', op: FilterOp.In, value: [] },
          { field: 'created_at', op: FilterOp.Before, value: '2026-10-01' },
          { field: 'amount', op: FilterOp.Gt, value: 'ten' },
          { field: 'unknown', op: FilterOp.Eq, value: 'x' },
        ],
        SPECS,
      ),
    ).toEqual([{ field: 'created_at', op: FilterOp.Before, value: '2026-10-01' }])
  })
})
