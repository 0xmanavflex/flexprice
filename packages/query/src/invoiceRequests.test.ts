import { describe, expect, it } from 'vitest'
import { CreateInvoiceRequest$outboundSchema } from '@flexprice/sdk/sdk/models'
import { emptyInvoice } from '@fp/domain'
import { toCreateInvoiceRequest, toInvoiceDetail } from './invoices'

describe('toCreateInvoiceRequest', () => {
  it('sends the entered total as given and parses through the SDK schema', () => {
    const request = toCreateInvoiceRequest({
      ...emptyInvoice(),
      customerId: 'cust_1',
      currency: 'usd',
      total: '120.50',
      dueDate: '2026-11-01',
      lines: [{ description: 'Setup', quantity: '1', amount: '120.50' }],
    })
    const wire = CreateInvoiceRequest$outboundSchema.parse(request)
    expect(wire).toMatchObject({
      customer_id: 'cust_1',
      currency: 'USD',
      subtotal: '120.50',
      total: '120.50',
      amount_due: '120.50',
      invoice_status: 'DRAFT',
      due_date: '2026-11-01T00:00:00.000Z',
      line_items: [{ display_name: 'Setup', quantity: '1', amount: '120.50' }],
    })
  })

  it('finalizes on creation when asked', () => {
    const request = toCreateInvoiceRequest({ ...emptyInvoice(), finalize: true, total: '1' })
    expect(request['invoiceStatus']).toBe('FINALIZED')
  })
})

describe('toInvoiceDetail', () => {
  it('keeps API figures as strings and names lines', () => {
    const detail = toInvoiceDetail({
      id: 'inv_1',
      currency: 'USD',
      total: '10.00',
      subtotal: '9.00',
      totalTax: '1.00',
      lineItems: [{ id: 'l1', displayName: 'Seats', quantity: '3', amount: '9.00' }],
    })
    expect(detail.subtotal).toBe('9.00')
    expect(detail.tax).toBe('1.00')
    expect(detail.lines[0]).toMatchObject({ description: 'Seats', amount: '9.00' })
  })
})
