/**
 * The webhook pages' search params. Total, like every codec here: a
 * hand-edited URL lands on the default view rather than an error.
 *
 * `/webhooks?tab=` picks the hub's view (Endpoints, Event catalog, Logs,
 * Activity); `/webhooks/:id?tab=` picks the endpoint's (Overview, Testing,
 * Advanced). `msg` opens one message's sheet over either, so a delivery can be
 * linked to.
 */
export const WEBHOOK_HUB_TABS = ['endpoints', 'catalog', 'logs', 'activity'] as const
export type WebhookHubTab = (typeof WEBHOOK_HUB_TABS)[number]

export const WEBHOOK_ENDPOINT_TABS = ['overview', 'testing', 'advanced'] as const
export type WebhookEndpointTabParam = (typeof WEBHOOK_ENDPOINT_TABS)[number]

/** A message id, or nothing. Svix ids are `msg_` plus a KSUID. */
function messageId(raw: unknown): string | undefined {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : undefined
}

export interface WebhookHubSearch {
  tab: WebhookHubTab
  msg?: string
}

export function parseWebhookHubSearch(raw: Record<string, unknown>): WebhookHubSearch {
  const tab = WEBHOOK_HUB_TABS.find((value) => value === raw['tab']) ?? 'endpoints'
  const msg = messageId(raw['msg'])
  return msg ? { tab, msg } : { tab }
}

export interface WebhookEndpointSearch {
  tab: WebhookEndpointTabParam
  msg?: string
}

export function parseWebhookEndpointSearch(raw: Record<string, unknown>): WebhookEndpointSearch {
  const tab = WEBHOOK_ENDPOINT_TABS.find((value) => value === raw['tab']) ?? 'overview'
  const msg = messageId(raw['msg'])
  return msg ? { tab, msg } : { tab }
}
