import { describe, expect, it } from 'vitest'
import { InvoiceStatus, invoiceRecalculation } from './invoice'

const contract = { subscriptionId: 'sub_1', amountPaid: '0' }

describe('invoiceRecalculation', () => {
  it('recalculates a draft in place', () => {
    expect(invoiceRecalculation({ ...contract, status: InvoiceStatus.Draft })).toEqual({
      kind: 'in-place',
    })
  })

  it('replaces a voided contract invoice', () => {
    expect(invoiceRecalculation({ ...contract, status: InvoiceStatus.Void }).kind).toBe('replace')
  })

  it('voids, then replaces, an unpaid finalized contract invoice', () => {
    expect(invoiceRecalculation({ ...contract, status: InvoiceStatus.Open }).kind).toBe(
      'void-and-replace',
    )
    expect(invoiceRecalculation({ ...contract, status: InvoiceStatus.Overdue }).kind).toBe(
      'void-and-replace',
    )
  })

  it('refuses a paid, partly paid, skipped or one-off invoice, saying why', () => {
    for (const invoice of [
      { ...contract, status: InvoiceStatus.Paid, amountPaid: '50' },
      { ...contract, status: InvoiceStatus.Open, amountPaid: '0.01' },
      { ...contract, status: InvoiceStatus.Skipped },
      { subscriptionId: null, amountPaid: '0', status: InvoiceStatus.Void },
    ]) {
      const result = invoiceRecalculation(invoice)
      expect(result.kind).toBe('unavailable')
      expect(result.kind === 'unavailable' && result.reason.length > 0).toBe(true)
    }
  })
})
