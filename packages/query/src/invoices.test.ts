import { describe, expect, it } from 'vitest'
import { DEFAULT_INVOICE_QUERY, InvoiceSortField, InvoiceStatus } from '@fp/domain'
import { isServerFilterable, toInvoice, toInvoiceFilter, type InvoiceWire } from './invoices'

describe('toInvoiceFilter — domain vocabulary out, transport in', () => {
  it('turns a 1-based page into an offset', () => {
    expect(toInvoiceFilter({ ...DEFAULT_INVOICE_QUERY, page: 1, pageSize: 25 })).toMatchObject({
      limit: 25,
      offset: 0,
    })
    expect(toInvoiceFilter({ ...DEFAULT_INVOICE_QUERY, page: 3, pageSize: 25 })).toMatchObject({
      offset: 50,
    })
  })

  it('maps domain sort fields onto API field names', () => {
    expect(
      toInvoiceFilter({
        ...DEFAULT_INVOICE_QUERY,
        sortBy: InvoiceSortField.Total,
        sortDirection: 'asc',
      }).sort,
    ).toEqual([{ field: 'amount_due', direction: 'asc' }])
  })

  it('skips line items, which a list never renders and which dominate the payload', () => {
    expect(toInvoiceFilter(DEFAULT_INVOICE_QUERY)).toMatchObject({ skipLineItems: true })
  })

  it('omits the status filter entirely when nothing is selected', () => {
    // An empty array must mean "no filter", not "match nothing".
    expect(toInvoiceFilter(DEFAULT_INVOICE_QUERY)).not.toHaveProperty('invoiceStatus')
  })

  it('sends the API values for statuses the server understands', () => {
    expect(
      toInvoiceFilter({
        ...DEFAULT_INVOICE_QUERY,
        statuses: [InvoiceStatus.Draft, InvoiceStatus.Void],
      }),
    ).toMatchObject({ invoiceStatus: ['DRAFT', 'VOIDED'] })
  })

  // `overdue` and `paid` are derived, not stored. Silently dropping them from
  // the request is correct; silently returning the wrong rows would not be.
  it('drops derived statuses rather than inventing an API value', () => {
    const filter = toInvoiceFilter({
      ...DEFAULT_INVOICE_QUERY,
      statuses: [InvoiceStatus.Overdue, InvoiceStatus.Draft],
    })

    expect(filter).toMatchObject({ invoiceStatus: ['DRAFT'] })
    expect(isServerFilterable(InvoiceStatus.Overdue)).toBe(false)
    expect(isServerFilterable(InvoiceStatus.Draft)).toBe(true)
  })
})

describe('toInvoice — a narrow model out of a 45-field optional response', () => {
  const wire: InvoiceWire = {
    id: 'inv_1',
    invoiceNumber: 'INV-0001',
    customerId: 'cus_1',
    customer: { name: 'Acme Corp' },
    invoiceStatus: 'FINALIZED',
    paymentStatus: 'PENDING',
    currency: 'usd',
    total: '1234.56',
    amountDue: '1234.56',
    amountRemaining: '1234.56',
    dueDate: new Date('2026-01-01T00:00:00Z'),
    issueDate: new Date('2025-12-01T00:00:00Z'),
  }

  it('produces domain money, not strings', () => {
    const invoice = toInvoice(wire, new Date('2025-12-15T00:00:00Z'))

    expect(invoice.total).toEqual({ amount: '1234.56', currency: 'USD' })
    expect(invoice.amountRemaining).toEqual({ amount: '1234.56', currency: 'USD' })
  })

  it('resolves one status from the response’s three', () => {
    expect(toInvoice(wire, new Date('2025-12-15T00:00:00Z')).status).toBe(InvoiceStatus.Open)
    expect(toInvoice(wire, new Date('2026-06-01T00:00:00Z')).status).toBe(InvoiceStatus.Overdue)
  })

  it('resolves a display name so no cell has to fall back', () => {
    expect(toInvoice({ ...wire, customer: { name: 'Acme Corp' } }).customerName).toBe('Acme Corp')
    expect(toInvoice({ ...wire, customer: { email: 'a@b.com' } }).customerName).toBe('a@b.com')
    expect(toInvoice({ ...wire, customer: undefined }).customerName).toBe('cus_1')
  })

  it('shows the id when a draft has no number yet', () => {
    expect(toInvoice({ ...wire, invoiceNumber: undefined }).number).toBe('inv_1')
    expect(toInvoice({ ...wire, invoiceNumber: '' }).number).toBe('inv_1')
  })

  // Every field on InvoiceResponse is optional. The grid must still get a row.
  it('survives a response with nothing on it', () => {
    const invoice = toInvoice({})

    expect(invoice.total).toEqual({ amount: '0', currency: 'USD' })
    expect(invoice.status).toBe(InvoiceStatus.Paid)
    expect(invoice.dueDate).toBeNull()
    expect(invoice.customerName).toBe('Unknown')
  })

  it('treats a zero remaining balance as paid, whatever the payment status says', () => {
    expect(toInvoice({ ...wire, amountRemaining: '0.00' }).status).toBe(InvoiceStatus.Paid)
  })
})
