import { describe, expect, it } from 'vitest'
import type { ActivityEntry } from '@fp/domain'
import { activityCardActor, activityCompactStamp, toActivityLogEntry } from './activityLog'

const entry = (patch: Partial<ActivityEntry>): ActivityEntry => ({
  id: 'act_1',
  action: 'customer.updated',
  title: 'Customer updated',
  occurredAt: new Date(2026, 9, 24, 18, 3),
  entityType: 'customer',
  entityId: 'cust_1',
  entityLabel: 'cust_1',
  actorType: 'user',
  actorId: 'u1',
  actorLabel: 'Subrat',
  source: 'dashboard',
  ...patch,
})

describe('the Activity card', () => {
  it('times an event at a glance, adding the year only when it is not this one', () => {
    const now = new Date(2026, 9, 26)
    expect(activityCompactStamp(new Date(2026, 9, 24, 18, 3), now)).toBe('24 Oct · 18:03')
    expect(activityCompactStamp(new Date(2025, 9, 24, 18, 3), now)).toBe('24 Oct 2025 · 18:03')
    expect(activityCompactStamp(new Date(2026, 8, 20, 6, 30), now)).toBe('20 Sep · 06:30')
  })

  it('keeps the actor short: person and channel, key and kind, or the system channel', () => {
    expect(activityCardActor(entry({}))).toBe('Subrat · Dashboard')
    expect(
      activityCardActor(entry({ actorType: 'api_key', actorLabel: 'billing prod', source: 'api' })),
    ).toBe('billing prod · API key')
    expect(
      activityCardActor(
        entry({ actorType: 'system', actorLabel: 'StripeInvoiceSyncWorkflow', source: 'workflow' }),
      ),
    ).toBe('Workflow')
  })

  it('sums a customer up in one line of states, with no labels or ids', () => {
    const row = toActivityLogEntry(
      entry({ state: { tax_treatment: 'taxable', timezone: 'UTC', status: 'published' } }),
    )
    expect(row.summary).toBe('Taxable · Published')
    expect(row.fields).toBeUndefined()
    expect(row.by).toBe('Subrat · Dashboard')
  })

  it('names an invoice by number with its status', () => {
    const row = toActivityLogEntry(
      entry({
        action: 'invoice.created',
        title: 'Invoice created',
        entityType: 'invoice',
        entityId: 'inv_1',
        entityLabel: 'INV-202610-00210',
        state: { invoice_number: 'INV-202610-00210', total: '35.00', invoice_status: 'FINALIZED' },
      }),
    )
    expect(row.record).toBe('INV-202610-00210')
    expect(row.summary).toBe('Finalized')
    expect(row.href).toBe('/invoices/inv_1')
  })
})
