import { describe, expect, it } from 'vitest'
import {
  FilterOp,
  type ListFilterSpec,
  decodeListFilters,
  encodeListFilters,
  runnableFilters,
  splitKeyValue,
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

describe('key/value filters', () => {
  const specs: ListFilterSpec[] = [{ field: 'metadata', label: 'Metadata', kind: 'keyvalue' }]

  it('splits on the first =, so a value may hold one', () => {
    expect(splitKeyValue('region=eu')).toEqual({ key: 'region', value: 'eu' })
    expect(splitKeyValue('query=a=b')).toEqual({ key: 'query', value: 'a=b' })
    expect(splitKeyValue('tier=')).toEqual({ key: 'tier', value: '' })
  })

  it('needs a key', () => {
    expect(splitKeyValue('=eu')).toBeNull()
    expect(splitKeyValue('region')).toBeNull()
    expect(runnableFilters([{ field: 'metadata', op: FilterOp.Eq, value: '=eu' }], specs)).toEqual(
      [],
    )
  })

  it('offers only "is"', () => {
    expect(
      runnableFilters([{ field: 'metadata', op: FilterOp.Contains, value: 'a=b' }], specs),
    ).toEqual([])
    expect(
      runnableFilters([{ field: 'metadata', op: FilterOp.Eq, value: 'a=b' }], specs),
    ).toHaveLength(1)
  })
})
