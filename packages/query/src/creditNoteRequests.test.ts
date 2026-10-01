import { describe, expect, it } from 'vitest'
import { CreateCreditNoteRequest$outboundSchema } from '@flexprice/sdk/sdk/models'
import { createCreditNoteSchema, emptyCreditNote } from '@fp/domain'
import { toCreateCreditNoteRequest, toCreditNoteDetail } from './creditNotes'

const draft = {
  ...emptyCreditNote(),
  invoiceId: 'inv_1',
  memo: ' Overbilled ',
  refundTarget: 'PREPAID_WALLET' as const,
  lines: [
    { invoiceLineItemId: 'li_1', label: 'Seats', amount: '20' },
    { invoiceLineItemId: 'li_2', label: 'Usage', amount: '' },
  ],
}

describe('credit note requests', () => {
  it('credits only the lines with an amount', () => {
    const parsed = CreateCreditNoteRequest$outboundSchema.parse(toCreateCreditNoteRequest(draft))
    expect(parsed.invoice_id).toBe('inv_1')
    expect(parsed.reason).toBe('BILLING_ERROR')
    expect(parsed.refund_target).toBe('PREPAID_WALLET')
    expect(parsed.memo).toBe('Overbilled')
    expect(parsed.line_items).toEqual([
      { invoice_line_item_id: 'li_1', amount: '20', display_name: 'Seats' },
    ])
  })

  it('requires at least one credited line', () => {
    expect(createCreditNoteSchema.safeParse(draft).success).toBe(true)
    const none = createCreditNoteSchema.safeParse({
      ...draft,
      lines: [{ invoiceLineItemId: 'li_1', label: 'Seats', amount: '0' }],
    })
    expect(none.success).toBe(false)
  })
})

describe('credit note detail mapping', () => {
  it('maps lines, reason and dates', () => {
    const detail = toCreditNoteDetail({
      id: 'cn_1',
      creditNoteStatus: 'FINALIZED',
      creditNoteType: 'REFUND',
      currency: 'USD',
      totalAmount: '20',
      invoiceId: 'inv_1',
      reason: 'DUPLICATE',
      lineItems: [{ id: 'l', invoiceLineItemId: 'li_1', displayName: 'Seats', amount: '20' }],
    })
    expect(detail.status).toBe('finalized')
    expect(detail.type).toBe('refund')
    expect(detail.lines[0]?.description).toBe('Seats')
    expect(detail.reason).toBe('DUPLICATE')
  })
})
