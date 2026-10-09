import { describe, expect, it } from 'vitest'
import {
  hourlyWindows,
  toWebhookAttempt,
  toWebhookEndpoint,
  toWebhookEndpointMessage,
  toWebhookEventType,
  toWebhookHeaders,
} from './webhooks'

describe('webhook mappers', () => {
  it('maps an endpoint, treating a missing filter as every event', () => {
    expect(
      toWebhookEndpoint({
        id: 'ep_1',
        url: 'https://example.com/hook',
        description: 'Prod',
        filterTypes: null,
        rateLimit: 5,
        disabled: true,
        createdAt: '2026-10-01T10:00:00Z',
      }),
    ).toMatchObject({
      id: 'ep_1',
      filterTypes: [],
      rateLimit: 5,
      disabled: true,
      createdAt: new Date('2026-10-01T10:00:00Z'),
      updatedAt: null,
    })
  })

  it('maps Svix numeric statuses', () => {
    expect(toWebhookEndpointMessage({ id: 'msg_1', status: 0 }).status).toBe('succeeded')
    expect(toWebhookEndpointMessage({ id: 'msg_1', status: 2 }).status).toBe('failed')
    expect(toWebhookEndpointMessage({ id: 'msg_1', status: 3 }).status).toBe('sending')
    expect(toWebhookAttempt({ id: 'atmpt_1', status: 1, triggerType: 1 })).toMatchObject({
      status: 'pending',
      trigger: 'manual',
    })
  })

  it('keeps sensitive headers visible, without a value', () => {
    expect(
      toWebhookHeaders({ headers: { 'X-Team': 'billing' }, sensitive: ['Authorization'] }),
    ).toEqual([
      { name: 'Authorization', value: '', sensitive: true },
      { name: 'X-Team', value: 'billing', sensitive: false },
    ])
  })

  it("reads the latest schema version's first example", () => {
    const eventType = toWebhookEventType({
      name: 'invoice.paid',
      schemas: {
        '1': { examples: [{ v: 1 }] },
        '2': { examples: [{ v: 2 }, { v: 3 }] },
      },
    })
    expect(eventType.example).toEqual({ v: 2 })
    expect(toWebhookEventType({ name: 'x' }).example).toBeNull()
  })
})

describe('hourlyWindows', () => {
  it('builds consecutive hours ending at now, oldest first', () => {
    const windows = hourlyWindows(new Date('2026-07-26T18:00:00.000Z'), 6)
    expect(windows).toHaveLength(6)
    expect(windows[0]?.start.toISOString()).toBe('2026-07-26T12:00:00.000Z')
    expect(windows[5]?.end.toISOString()).toBe('2026-07-26T18:00:00.000Z')
  })
})
