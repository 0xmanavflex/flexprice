import { z } from 'zod'

/**
 * Outbound webhooks, as the Svix consumer app portal models them.
 *
 * Flexprice sends its events through Svix. A tenant's environment is one Svix
 * *application*; each place it wants events delivered is an **endpoint**; each
 * event Flexprice emits is a **message**; and each try at delivering a message
 * to an endpoint is an **attempt**. The **event catalog** is the list of event
 * types an endpoint can subscribe to.
 *
 * Nothing here knows about the wire. `@fp/query` maps Svix's JSON onto these.
 */

/** Where one message stands on one endpoint (or, for an attempt, how that try went). */
export const WebhookDeliveryStatus = {
  Succeeded: 'succeeded',
  Pending: 'pending',
  Failed: 'failed',
  Sending: 'sending',
} as const
export type WebhookDeliveryStatus =
  (typeof WebhookDeliveryStatus)[keyof typeof WebhookDeliveryStatus]

export const WEBHOOK_DELIVERY_STATUS_LABEL: Record<WebhookDeliveryStatus, string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  failed: 'Failed',
  sending: 'Sending',
}

/** The status filter the attempt tables offer. `all` is no filter. */
export type WebhookStatusFilter = 'all' | WebhookDeliveryStatus

export interface WebhookEndpoint {
  id: string
  url: string
  description: string
  /** Event types this endpoint receives. Empty means every event type. */
  filterTypes: string[]
  /** Messages per second; `null` for no limit. */
  rateLimit: number | null
  disabled: boolean
  createdAt: Date | null
  updatedAt: Date | null
}

/** Delivery counts for one endpoint over a window (Svix's default: the last 28 days). */
export interface WebhookEndpointStats {
  succeeded: number
  failed: number
  pending: number
  sending: number
}

/** A custom header sent with every delivery. Sensitive values are withheld by Svix. */
export interface WebhookHeader {
  name: string
  /** Empty when `sensitive`: Svix never hands the value back. */
  value: string
  sensitive: boolean
}

export interface WebhookEventType {
  name: string
  description: string
  /** The first registered example payload, if the event type has one. */
  example: unknown
  /** The JSON schema of the latest version, if one is registered. */
  schema: unknown
  deprecated: boolean
  archived: boolean
}

/** A grouping of the catalog by name prefix: `invoice.payment.succeeded` → `invoice.payment`. */
export interface WebhookEventTypeGroup {
  name: string
  eventTypes: WebhookEventType[]
}

export interface WebhookMessage {
  id: string
  /** The sender's idempotency id, when one was set. */
  eventId: string
  eventType: string
  payload: unknown
  timestamp: Date | null
}

/** A message as one endpoint saw it: the message plus its latest status there. */
export interface WebhookEndpointMessage extends WebhookMessage {
  status: WebhookDeliveryStatus
  nextAttempt: Date | null
}

export interface WebhookAttempt {
  id: string
  messageId: string
  endpointId: string
  url: string
  status: WebhookDeliveryStatus
  /** `0` when the request never got a response (timeout, DNS, TLS). */
  responseStatusCode: number
  /** The response body, as the receiver sent it. */
  response: string
  responseDurationMs: number | null
  /** `scheduled` for the normal retry schedule, `manual` for a resend. */
  trigger: 'scheduled' | 'manual'
  timestamp: Date | null
}

/** One hour of delivery activity across every endpoint. */
export interface WebhookActivityPoint {
  start: Date
  succeeded: number
  failed: number
}

/** How far back "Recover failed messages" reaches, as Svix's own portal offers it. */
export const WEBHOOK_RECOVER_WINDOWS = [
  { value: '1h', label: 'Last hour', hours: 1 },
  { value: '6h', label: 'Last 6 hours', hours: 6 },
  { value: '12h', label: 'Last 12 hours', hours: 12 },
  { value: '1d', label: 'Last day', hours: 24 },
  { value: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { value: '14d', label: 'Last 14 days', hours: 24 * 14 },
] as const
export type WebhookRecoverWindow = (typeof WEBHOOK_RECOVER_WINDOWS)[number]['value']

/** The instant a recover window starts, counted back from `now`. */
export function recoverSince(window: WebhookRecoverWindow, now: Date = new Date()): Date {
  const spec = WEBHOOK_RECOVER_WINDOWS.find((entry) => entry.value === window)
  return new Date(now.getTime() - (spec?.hours ?? 1) * 60 * 60 * 1000)
}

/** Groups event types by everything before the last `.`, groups sorted by name. */
export function groupWebhookEventTypes(eventTypes: WebhookEventType[]): WebhookEventTypeGroup[] {
  const byGroup = new Map<string, WebhookEventType[]>()
  for (const eventType of eventTypes) {
    const group = eventType.name.split('.').slice(0, -1).join('.') || eventType.name
    const list = byGroup.get(group) ?? []
    list.push(eventType)
    byGroup.set(group, list)
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, types]) => ({ name, eventTypes: types }))
}

/** Failed share of finished deliveries, 0–100. `null` when nothing has finished. */
export function webhookErrorRate(stats: WebhookEndpointStats): number | null {
  const finished = stats.succeeded + stats.failed
  return finished === 0 ? null : (stats.failed / finished) * 100
}

/** The create-endpoint form. */
export const createWebhookEndpointSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Enter the URL that should receive events.')
    .refine((value) => {
      try {
        const parsed = new URL(value)
        return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      } catch {
        return false
      }
    }, 'Enter a full URL, starting with https://.'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters.'),
  filterTypes: z.array(z.string()),
})
export type CreateWebhookEndpoint = z.infer<typeof createWebhookEndpointSchema>

export function emptyWebhookEndpoint(): CreateWebhookEndpoint {
  return { url: '', description: '', filterTypes: [] }
}

/** The fields an endpoint update may change. Svix's update replaces, so callers send all of them. */
export interface WebhookEndpointPatch {
  url?: string
  description?: string
  filterTypes?: string[]
  rateLimit?: number | null
  disabled?: boolean
}
