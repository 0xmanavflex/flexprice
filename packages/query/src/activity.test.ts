import { describe, expect, it } from 'vitest'
import {
  activityActor,
  activityByline,
  activityEntityNoun,
  activityPaymentStatus,
  activityStatus,
  describeActivity,
} from '@fp/domain'
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
      state: {
        invoice_number: 'INV-9',
        total: '120.00',
        currency: 'USD',
        payment_status: 'UNPAID',
      },
    })

    expect(entry.entityLabel).toBe('INV-9')
    expect(entry.state).toMatchObject({ total: '120.00' })
    expect(describeActivity(entry)).toEqual({
      record: 'INV-9',
      fields: [
        { label: 'Total', value: '$120.00' },
        { label: 'Status', value: 'Unpaid' },
      ],
    })
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
      fields: [
        { label: 'Total', value: '$2,000.00' },
        { label: 'Paid', value: '$1,000.00' },
        { label: 'Due', value: '$1,000.00' },
        { label: 'Status', value: 'Finalized' },
      ],
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

    expect(describeActivity(entry)).toEqual({ fields: [{ label: 'Status', value: 'Draft' }] })
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
        name: 'Acme Corp',
        external_id: 'actlog-read-1791926997-a',
        id: 'cust_01',
        status: 'published',
        tax_treatment: 'taxable',
        tenant_id: '00000000-0000-0000-0000-000000000000',
        timezone: 'UTC',
      },
    })

    expect(describeActivity(entry)).toEqual({
      record: 'Acme Corp',
      fields: [
        { label: 'Tax treatment', value: 'Taxable' },
        { label: 'Timezone', value: 'UTC' },
        { label: 'Status', value: 'Active' },
      ],
    })
    expect(describeActivity(entry).record).not.toBe('actlog-read-1791926997-a')
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
      fields: [{ label: 'Balance', value: '$40.00' }],
    })
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
    expect(describeActivity(entry).fields).toEqual([{ label: 'Amount', value: '$1,000.00' }])
  })
})

describe('activity titles', () => {
  it('reads a succeeded payment as Paid, the word on the invoice', () => {
    expect(toActivityEntry({ id: 'a', action: 'payment.succeeded' }).title).toBe('Paid')
  })

  it('keeps every other action readable from its name', () => {
    expect(toActivityEntry({ id: 'b', action: 'invoice.refunded' }).title).toBe('Invoice refunded')
  })

  it('names entities the way the console does', () => {
    expect(toActivityEntry({ id: 'c', action: 'subscription.created' }).title).toBe(
      'Contract created',
    )
    expect(toActivityEntry({ id: 'd', action: 'credit_note.created' }).title).toBe(
      'Credit memo created',
    )
  })
})

describe('the Activity tab fields', () => {
  it('keeps the request metadata the API records', () => {
    const entry = toActivityEntry({
      id: 'act_9',
      action: 'customer.updated',
      entity: { type: 'customer', id: 'cust_1', label: 'acme' },
      actor: { type: 'user', id: 'dde9a118', label: 'Subrat' },
      source: 'dashboard',
      customer_id: 'cust_1',
      request_id: 'req_1',
      ip: '182.76.138.114',
      user_agent: 'Mozilla/5.0',
    })
    expect(entry).toMatchObject({
      customerId: 'cust_1',
      requestId: 'req_1',
      ip: '182.76.138.114',
      userAgent: 'Mozilla/5.0',
    })
  })

  it('always names the actor, separately from the record', () => {
    const base = { id: 'a', action: 'invoice.created', entity: { type: 'invoice', id: 'inv_1' } }
    expect(
      activityActor(toActivityEntry({ ...base, actor: { type: 'user', label: 'Subrat' } })),
    ).toBe('Subrat')
    expect(activityActor(toActivityEntry({ ...base, actor: { type: 'system' } }))).toBe('System')
    expect(activityActor(toActivityEntry({ ...base, actor: { type: 'api_key' } }))).toBe('API key')
  })

  it('reads the status from an allowlist, with an invoice payment status beside it', () => {
    const invoice = toActivityEntry({
      id: 'b',
      action: 'invoice.updated',
      entity: { type: 'invoice', id: 'inv_1' },
      state: { invoice_status: 'FINALIZED', payment_status: 'SUCCEEDED', internal_flag: 'x' },
    })
    expect(activityStatus(invoice)).toBe('Finalized')
    expect(activityPaymentStatus(invoice)).toBe('Succeeded')
    expect(activityEntityNoun('subscription')).toBe('Contract')
    expect(activityEntityNoun('credit_note')).toBe('Credit memo')
  })
})
