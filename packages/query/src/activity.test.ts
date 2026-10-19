import { describe, expect, it } from 'vitest'
import { activityByline, describeActivity } from '@fp/domain'
import { toActivityEntry } from './activity'

describe('toActivityEntry', () => {
  it('keeps the state snapshot the list was expanded with', () => {
    const entry = toActivityEntry({
      id: 'act_1',
      action: 'invoice.finalized',
      occurred_at: '2026-10-01T15:42:00.000Z',
      entity: { type: 'invoice', id: 'inv_1', label: 'INV-9' },
      actor: { type: 'user', id: 'usr_1', label: 'Ada' },
      source: 'dashboard',
      state: { invoice_number: 'INV-9', total: '120.00', currency: 'USD', payment_status: 'UNPAID' },
    })

    expect(entry.entityLabel).toBe('INV-9')
    expect(entry.state).toMatchObject({ total: '120.00' })
    expect(describeActivity(entry)).toEqual({
      record: 'INV-9',
      summary: expect.stringContaining('120'),
    })
    expect(describeActivity(entry).summary).toContain('Unpaid')
  })

  it('shows what was paid and what is still due on an invoice', () => {
    const entry = toActivityEntry({
      id: 'act_pay',
      action: 'invoice.updated',
      entity: { type: 'invoice', id: 'inv_01', label: 'INV-202610-00001' },
      state: {
        currency: 'usd',
        invoice_number: 'INV-202610-00001',
        invoice_status: 'FINALIZED',
        payment_status: 'PENDING',
        total: '2000',
        amount_due: '2000',
        amount_paid: '1000',
        amount_remaining: '1000',
      },
    })

    expect(describeActivity(entry)).toEqual({
      record: 'INV-202610-00001',
      summary: '$2,000.00 · $1,000.00 paid · $1,000.00 due · Finalized',
    })
  })

  it('does not show a zero total or the raw id on a new draft', () => {
    const entry = toActivityEntry({
      id: 'act_draft',
      action: 'invoice.created',
      entity: { type: 'invoice', id: 'inv_01M527' },
      state: {
        currency: 'usd',
        invoice_number: '',
        invoice_status: 'DRAFT',
        total: '0',
        amount_paid: '0',
        amount_remaining: '0',
      },
    })

    expect(describeActivity(entry)).toEqual({ summary: 'Draft' })
  })

  it('describes a customer snapshot without repeating ids', () => {
    const entry = toActivityEntry({
      id: 'act_01',
      action: 'customer.updated',
      occurred_at: '2026-10-16T11:18:55.514Z',
      entity: {
        type: 'customer',
        id: 'cust_01',
        label: 'actlog-read-1791926997-a',
      },
      actor: { type: 'api_key', id: 'secret_01', label: 'activity-log' },
      source: 'api',
      state: {
        address_country: '',
        created_by: 'dde9a118-f186-45a6-969b-a9dab4590a75',
        environment_id: 'env_01',
        external_id: 'actlog-read-1791926997-a',
        id: 'cust_01',
        status: 'published',
        tax_treatment: 'taxable',
        tenant_id: '00000000-0000-0000-0000-000000000000',
        timezone: 'UTC',
      },
    })

    expect(describeActivity(entry)).toEqual({
      record: 'actlog-read-1791926997-a',
      summary: 'Taxable · UTC · Published',
    })
    expect(activityByline(entry)).toBe('activity-log · API key')
  })

  it('reads a wallet balance from balance, not from an invoice total', () => {
    const entry = toActivityEntry({
      id: 'act_2',
      action: 'wallet.credited',
      entity: { type: 'wallet', id: 'wal_1', label: 'Prepaid' },
      state: { balance: '40.00', currency: 'USD', total: '999.00' },
    })

    expect(describeActivity(entry)).toEqual({
      record: 'Prepaid',
      summary: expect.stringContaining('40'),
    })
    expect(describeActivity(entry).summary).not.toContain('999')
  })

  it('leaves the label empty when the API sent only an id', () => {
    const entry = toActivityEntry({
      id: 'act_3',
      action: 'payment.succeeded',
      entity: { id: 'pay_01M527PK3Q8150WXNHNY7H5RT', type: 'payment' },
      state: { amount: '1000', currency: 'usd' },
    })
    expect(entry.entityLabel).toBe('')
    expect(describeActivity(entry).record).toBeUndefined()
    expect(describeActivity(entry).summary).toContain('1,000')
  })
})

describe('activity titles', () => {
  it('reads a succeeded payment as Paid, the word on the invoice', () => {
    expect(toActivityEntry({ id: 'a', action: 'payment.succeeded' }).title).toBe('Paid')
  })

  it('keeps every other action readable from its name', () => {
    expect(toActivityEntry({ id: 'b', action: 'invoice.refunded' }).title).toBe('Invoice refunded')
  })
})
