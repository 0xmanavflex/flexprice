import { describe, expect, it } from 'vitest'
import { DEFAULT_INVOICE_QUERY, InvoiceSortField, InvoiceStatus } from '@fp/domain'
import { parseInvoiceSearch } from './searchParams'

describe('parseInvoiceSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseInvoiceSearch({})).toEqual(DEFAULT_INVOICE_QUERY)
  })

  it('reads a full query', () => {
    expect(
      parseInvoiceSearch({ page: '3', size: '50', sort: 'total', dir: 'asc', status: 'overdue', q: 'acme' }),
    ).toEqual({
      page: 3,
      pageSize: 50,
      sortBy: InvoiceSortField.Total,
      sortDirection: 'asc',
      statuses: [InvoiceStatus.Overdue],
      search: 'acme',
    })
  })

  it('accepts statuses as a repeated param or a comma list', () => {
    expect(parseInvoiceSearch({ status: ['draft', 'paid'] }).statuses).toEqual(['draft', 'paid'])
    expect(parseInvoiceSearch({ status: 'draft,paid' }).statuses).toEqual(['draft', 'paid'])
  })

  it('de-duplicates statuses so a filter cannot look selected twice', () => {
    expect(parseInvoiceSearch({ status: 'paid,paid' }).statuses).toEqual(['paid'])
  })

  // A hand-edited URL should show the first page, not an error screen.
  it.each([
    ['a bad page', { page: 'abc' }],
    ['a negative page', { page: '-5' }],
    ['page zero', { page: '0' }],
    ['a bad sort field', { sort: 'nonsense' }],
    ['a bad direction', { dir: 'sideways' }],
    ['an unknown status', { status: 'exploded' }],
    ['nulls', { page: null, sort: null, status: null }],
  ])('degrades %s to a default rather than throwing', (_label, raw) => {
    expect(() => parseInvoiceSearch(raw as Record<string, unknown>)).not.toThrow()
    const parsed = parseInvoiceSearch(raw as Record<string, unknown>)
    expect(parsed.page).toBeGreaterThanOrEqual(1)
    expect(Object.values(InvoiceSortField)).toContain(parsed.sortBy)
  })

  it('caps page size, so a URL cannot ask for a million rows', () => {
    expect(parseInvoiceSearch({ size: '100000' }).pageSize).toBe(100)
  })
})


