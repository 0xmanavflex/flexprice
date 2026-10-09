import type {
  WebhookActivityPoint,
  WebhookAttempt,
  WebhookEndpoint,
  WebhookEndpointMessage,
  WebhookEndpointStats,
  WebhookEventType,
  WebhookHeader,
} from '@fp/domain'

/** Story data for the webhook pages. Fixed dates so screenshots do not drift. */

const at = (iso: string) => new Date(iso)

export const DEMO_WEBHOOK_ENDPOINTS: WebhookEndpoint[] = [
  {
    id: 'ep_2mVxQ7nB8yL4cZ1kR0aT3sW9',
    url: 'https://api.northwind.dev/webhooks/flexprice',
    description: 'Production billing sync',
    filterTypes: ['invoice.finalized', 'invoice.payment.succeeded', 'invoice.payment.failed'],
    rateLimit: 50,
    disabled: false,
    createdAt: at('2026-08-14T09:12:00Z'),
    updatedAt: at('2026-10-02T15:40:00Z'),
  },
  {
    id: 'ep_2mVxS1pD4uJ6eW8hT2bQ5nX7',
    url: 'https://alerts.northwind.dev/flexprice',
    description: 'Finance alerts channel',
    filterTypes: [],
    rateLimit: null,
    disabled: false,
    createdAt: at('2026-09-01T11:00:00Z'),
    updatedAt: at('2026-09-01T11:00:00Z'),
  },
  {
    id: 'ep_2mVxU9rF2wH8gY4jV6cS1mZ3',
    url: 'https://staging.northwind.dev/webhooks',
    description: '',
    filterTypes: ['subscription.created'],
    rateLimit: null,
    disabled: true,
    createdAt: at('2026-07-20T08:30:00Z'),
    updatedAt: at('2026-09-18T10:05:00Z'),
  },
]

export const DEMO_WEBHOOK_STATS: Record<string, WebhookEndpointStats> = {
  ep_2mVxQ7nB8yL4cZ1kR0aT3sW9: { succeeded: 1284, failed: 17, pending: 2, sending: 0 },
  ep_2mVxS1pD4uJ6eW8hT2bQ5nX7: { succeeded: 312, failed: 0, pending: 0, sending: 1 },
  ep_2mVxU9rF2wH8gY4jV6cS1mZ3: { succeeded: 40, failed: 40, pending: 0, sending: 0 },
}

const invoiceExample = {
  event_type: 'invoice.payment.succeeded',
  invoice: {
    id: 'inv_01J9ZK3Q8F4M2T7V6B5N0C1X9',
    customer_id: 'cust_01J9ZJ8W2E5R7T3Y6U1I4O0P8',
    amount_paid: '1240.00',
    currency: 'usd',
    status: 'paid',
  },
}

export const DEMO_WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  {
    name: 'invoice.finalized',
    description: 'An invoice was finalized and can no longer change.',
    example: { ...invoiceExample, event_type: 'invoice.finalized' },
    schema: null,
    deprecated: false,
    archived: false,
  },
  {
    name: 'invoice.payment.succeeded',
    description: 'A payment against an invoice succeeded.',
    example: invoiceExample,
    schema: null,
    deprecated: false,
    archived: false,
  },
  {
    name: 'invoice.payment.failed',
    description: 'A payment against an invoice failed.',
    example: { ...invoiceExample, event_type: 'invoice.payment.failed' },
    schema: null,
    deprecated: false,
    archived: false,
  },
  {
    name: 'subscription.created',
    description: 'A subscription was created for a customer.',
    example: { event_type: 'subscription.created', subscription: { id: 'subs_01J9' } },
    schema: null,
    deprecated: false,
    archived: false,
  },
  {
    name: 'subscription.cancelled',
    description: 'A subscription was cancelled.',
    example: null,
    schema: null,
    deprecated: true,
    archived: false,
  },
  {
    name: 'wallet.credit_balance.dropped',
    description: "A wallet's credit balance fell below its alert threshold.",
    example: { event_type: 'wallet.credit_balance.dropped', wallet: { id: 'wallet_01J9' } },
    schema: null,
    deprecated: false,
    archived: false,
  },
]

export const DEMO_WEBHOOK_MESSAGES: WebhookEndpointMessage[] = [
  {
    id: 'msg_2mW0A1bC2dE3fG4hI5jK6lM7',
    eventId: '',
    eventType: 'invoice.payment.succeeded',
    payload: invoiceExample,
    timestamp: at('2026-10-09T08:41:12Z'),
    status: 'succeeded',
    nextAttempt: null,
  },
  {
    id: 'msg_2mW0B8nO9pQ0rS1tU2vW3xY4',
    eventId: 'evt_inv_failed_001',
    eventType: 'invoice.payment.failed',
    payload: { ...invoiceExample, event_type: 'invoice.payment.failed' },
    timestamp: at('2026-10-09T08:12:47Z'),
    status: 'failed',
    nextAttempt: at('2026-10-09T10:12:47Z'),
  },
  {
    id: 'msg_2mW0C5zA6bB7cC8dD9eE0fF1',
    eventId: '',
    eventType: 'invoice.finalized',
    payload: { ...invoiceExample, event_type: 'invoice.finalized' },
    timestamp: at('2026-10-09T07:58:03Z'),
    status: 'pending',
    nextAttempt: at('2026-10-09T08:03:03Z'),
  },
]

export const DEMO_WEBHOOK_ATTEMPTS: WebhookAttempt[] = [
  {
    id: 'atmpt_2mW0D2gH3iJ4kL5mN6oP7qR8',
    messageId: 'msg_2mW0B8nO9pQ0rS1tU2vW3xY4',
    endpointId: 'ep_2mVxQ7nB8yL4cZ1kR0aT3sW9',
    url: 'https://api.northwind.dev/webhooks/flexprice',
    status: 'failed',
    responseStatusCode: 500,
    response: '{"error":"database unavailable"}',
    responseDurationMs: 812,
    trigger: 'scheduled',
    timestamp: at('2026-10-09T08:17:47Z'),
  },
  {
    id: 'atmpt_2mW0E9sT0uV1wX2yZ3aB4cD5',
    messageId: 'msg_2mW0B8nO9pQ0rS1tU2vW3xY4',
    endpointId: 'ep_2mVxQ7nB8yL4cZ1kR0aT3sW9',
    url: 'https://api.northwind.dev/webhooks/flexprice',
    status: 'failed',
    responseStatusCode: 0,
    response: '',
    responseDurationMs: 15000,
    trigger: 'scheduled',
    timestamp: at('2026-10-09T08:12:52Z'),
  },
]

export const DEMO_WEBHOOK_HEADERS: WebhookHeader[] = [
  { name: 'Authorization', value: '', sensitive: true },
  { name: 'X-Team', value: 'billing-platform', sensitive: false },
]

export const DEMO_WEBHOOK_ACTIVITY: WebhookActivityPoint[] = [
  { start: at('2026-10-09T03:00:00Z'), succeeded: 42, failed: 1 },
  { start: at('2026-10-09T04:00:00Z'), succeeded: 38, failed: 0 },
  { start: at('2026-10-09T05:00:00Z'), succeeded: 51, failed: 3 },
  { start: at('2026-10-09T06:00:00Z'), succeeded: 64, failed: 2 },
  { start: at('2026-10-09T07:00:00Z'), succeeded: 57, failed: 6 },
  { start: at('2026-10-09T08:00:00Z'), succeeded: 49, failed: 1 },
]
