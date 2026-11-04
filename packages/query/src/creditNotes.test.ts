import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CREDIT_NOTE_QUERY, CreditNoteStatus, CreditNoteType } from '@fp/domain'
import { fetchCreditNotes, toCreditNote } from './creditNotes'

const auth = { getToken: async () => 'jwt', getEnvironmentId: async () => 'env_1' }

describe('toCreditNote', () => {
  it('maps the wire shape to the domain', () => {
    const note = toCreditNote({
      id: 'cn_0123456789',
      credit_note_number: 'CN-0001',
      credit_note_status: 'FINALIZED',
      credit_note_type: 'REFUND',
      currency: 'usd',
      total_amount: 12.5,
      created_at: '2026-01-02T03:04:05Z',
      invoice: { invoice_number: 'INV-9' },
      customer: { name: 'Acme', external_id: 'acme' },
    })
    expect(note).toMatchObject({
      number: 'CN-0001',
      status: CreditNoteStatus.Finalized,
      type: CreditNoteType.Refund,
      invoiceNumber: 'INV-9',
      customerName: 'Acme',
    })
    expect(note.createdAt?.toISOString()).toBe('2026-01-02T03:04:05.000Z')
  })

  it('falls back to short ids and a draft status', () => {
    const note = toCreditNote({ id: 'cn_0123456789', invoice_id: 'inv_abcdefghij' })
    expect(note.number).toBe('cn_01234')
    expect(note.invoiceNumber).toBe('')
    expect(note.status).toBe(CreditNoteStatus.Draft)
    expect(note.type).toBeNull()
  })
})

describe('fetchCreditNotes', () => {
  it('sends paging and status and narrows by search', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      seen.push(String(input))
      return new Response(
        JSON.stringify({
          items: [
            { id: 'a', credit_note_number: 'CN-1', customer: { name: 'Acme' } },
            { id: 'b', credit_note_number: 'CN-2', customer: { name: 'Globex' } },
          ],
          pagination: { total: 40 },
        }),
        { status: 200 },
      )
    })
    const page = await fetchCreditNotes('https://api.test/v1', auth, {
      ...DEFAULT_CREDIT_NOTE_QUERY,
      page: 2,
      statuses: [CreditNoteStatus.Voided],
      search: 'glob',
    })
    expect(seen[0]).toContain('/creditnotes?limit=25&offset=25&credit_note_status=VOIDED')
    // The Customer and Invoice columns read the embedded records.
    expect(new URL(seen[0]!).searchParams.get('expand')).toBe('invoice,customer')
    expect(page.creditNotes.map((n) => n.number)).toEqual(['CN-2'])
    expect(page.total).toBe(40)
    vi.unstubAllGlobals()
  })
})
