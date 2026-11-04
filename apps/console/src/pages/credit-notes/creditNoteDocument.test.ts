import { describe, expect, it } from 'vitest'
import { toCreditNoteDetail, toInvoiceDetail } from '@fp/query'
import { toCreditNoteDocument } from './creditNoteDocument'

const note = toCreditNoteDetail({
  id: 'memo',
  invoiceId: 'invoice',
  creditNoteStatus: 'FINALIZED',
  creditNoteType: 'ADJUSTMENT',
  totalAmount: '12345678901234567.89',
  currency: 'USD',
  lineItems: [{ id: 'credit', invoiceLineItemId: 'original', amount: '0.10' }],
})
const invoice = toInvoiceDetail({
  id: 'invoice',
  currency: 'USD',
  total: '250',
  amountDue: '100',
  lineItems: [
    { id: 'other', amount: '99' },
    { id: 'original', amount: '151' },
  ],
})

describe('credit memo document mapping', () => {
  it('joins original amounts by ID and retains exact authoritative totals', () => {
    const document = toCreditNoteDocument(note, invoice)
    expect(document.lines[0]?.invoiced).toBe('151')
    expect(document.amount).toBe('12345678901234567.89')
    expect(document.invoiceTotal).toBe('250')
    expect(document.invoiceAmountDue).toBe('100')
  })
  it('does not substitute zero for unavailable or mismatched invoice lines', () => {
    expect(toCreditNoteDocument(note).lines[0]?.invoiced).toBeNull()
    expect(toCreditNoteDocument(note, { ...invoice, id: 'another' }).invoiceTotal).toBeUndefined()
    expect(toCreditNoteDocument(note, { ...invoice, currency: 'EUR' }).invoiceTotal).toBeUndefined()
    expect(toCreditNoteDocument(note, { ...invoice, lines: [] }).lines[0]?.invoiced).toBeNull()
  })
  it('dates a memo by its creation when it has no finalized date', () => {
    const created = new Date('2026-10-09T12:00:00Z')
    const format = (value: Date) =>
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
    const unfinalized = { ...note, finalizedAt: null, createdAt: created }
    expect(toCreditNoteDocument(unfinalized).issuedAt).toBe(format(created))
    const finalized = new Date('2026-10-12T12:00:00Z')
    expect(toCreditNoteDocument({ ...unfinalized, finalizedAt: finalized }).issuedAt).toBe(
      format(finalized),
    )
    expect(toCreditNoteDocument({ ...unfinalized, createdAt: null }).issuedAt).toBeNull()
  })
  it('does not infer successful refunds from finalization', () => {
    const document = toCreditNoteDocument({ ...note, type: 'refund', refundStatus: 'FAILED' })
    expect(document.settlement).toBe('unknown')
    expect(document.refundStatus).toBe('FAILED')
    expect(toCreditNoteDocument({ ...note, status: 'draft' }).settlement).toBe('pending')
    expect(toCreditNoteDocument({ ...note, status: 'voided' }).settlement).toBe('void')
  })
})
