import { describe, expect, it } from 'vitest'
import { DEFAULT_PAYMENT_QUERY, PaymentStatus } from '@fp/domain'
import { parsePaymentSearch } from './paymentSearch'

describe('parsePaymentSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parsePaymentSearch({})).toEqual(DEFAULT_PAYMENT_QUERY)
  })

  it('reads a full query', () => {
    expect(parsePaymentSearch({ page: '2', size: '50', q: 'INV-7', status: 'failed' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'INV-7',
      statuses: [PaymentStatus.Failed],
      sortBy: 'createdAt',
      sortDirection: 'desc',
      filters: [],
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parsePaymentSearch({ status: ['succeeded', 'failed'] }).statuses).toEqual([
      'succeeded',
      'failed',
    ])
    expect(parsePaymentSearch({ status: 'succeeded,failed' }).statuses).toEqual([
      'succeeded',
      'failed',
    ])
  })

  it.each([
    ['a bad page', { page: 'abc' }],
    ['page zero', { page: '0' }],
    ['an unknown status', { status: 'bounced' }],
    ['nulls', { page: null, status: null, q: null }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parsePaymentSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parsePaymentSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parsePaymentSearch({ size: '99999' }).pageSize).toBe(100)
  })

  it('defaults to newest first, and reads an ascending direction', () => {
    expect(parsePaymentSearch({}).sortDirection).toBe('desc')
    expect(parsePaymentSearch({ dir: 'asc' }).sortDirection).toBe('asc')
    expect(parsePaymentSearch({ dir: 'sideways' }).sortDirection).toBe('desc')
  })

  it('is stable across a parse of its own output', () => {
    const once = parsePaymentSearch({ status: ['succeeded'], sortDirection: 'asc' })
    expect(parsePaymentSearch({ ...once })).toEqual(once)
  })
})
