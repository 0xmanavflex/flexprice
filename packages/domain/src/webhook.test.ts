import { describe, expect, it } from 'vitest'
import {
  createWebhookEndpointSchema,
  groupWebhookEventTypes,
  recoverSince,
  webhookErrorRate,
  type WebhookEventType,
} from './webhook'

const type = (name: string): WebhookEventType => ({
  name,
  description: '',
  example: null,
  schema: null,
  deprecated: false,
  archived: false,
})

describe('groupWebhookEventTypes', () => {
  it('groups by everything before the last dot, sorted', () => {
    const groups = groupWebhookEventTypes([
      type('subscription.created'),
      type('invoice.payment.succeeded'),
      type('invoice.payment.failed'),
      type('ping'),
    ])
    expect(groups.map((group) => [group.name, group.eventTypes.length])).toEqual([
      ['invoice.payment', 2],
      ['ping', 1],
      ['subscription', 1],
    ])
  })
})

describe('webhookErrorRate', () => {
  it('is the failed share of finished deliveries', () => {
    expect(webhookErrorRate({ succeeded: 3, failed: 1, pending: 9, sending: 0 })).toBe(25)
    expect(webhookErrorRate({ succeeded: 0, failed: 0, pending: 2, sending: 0 })).toBeNull()
  })
})

describe('recoverSince', () => {
  it('counts the window back from now', () => {
    const now = new Date('2026-10-09T12:00:00Z')
    expect(recoverSince('6h', now).toISOString()).toBe('2026-10-09T06:00:00.000Z')
    expect(recoverSince('7d', now).toISOString()).toBe('2026-10-02T12:00:00.000Z')
  })
})

describe('createWebhookEndpointSchema', () => {
  it('needs a full http(s) URL', () => {
    const base = { description: '', filterTypes: [] }
    expect(createWebhookEndpointSchema.safeParse({ ...base, url: 'example.com' }).success).toBe(
      false,
    )
    expect(
      createWebhookEndpointSchema.safeParse({ ...base, url: 'https://example.com/hook' }).success,
    ).toBe(true)
  })
})
