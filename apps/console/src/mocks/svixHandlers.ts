import { http, HttpResponse } from 'msw'

/*
 * ---------------------------------------------------------------------------
 * The Svix API, as the webhook portal calls it with the demo app-portal token.
 *
 * `GET /webhooks/dashboard` (see `handlers.ts`) hands out
 * `sk_app_DEMO_not_a_real_token.us`, so the console sends everything below to
 * `https://api.us.svix.com/api/v1/…`. State is in memory and mutable: create
 * an endpoint, rotate its secret, resend a message: so every screen can be
 * driven end to end. Shapes follow the Svix OpenAPI models (camelCase, numeric
 * `status`: 0 success, 1 pending, 2 fail, 3 sending); nothing here was
 * captured from a real tenant.
 * ---------------------------------------------------------------------------
 */
const SVIX = '*/api/v1'

interface SvixEndpointRow {
  id: string
  url: string
  description: string
  filterTypes: string[] | null
  rateLimit: number | null
  disabled: boolean
  version: number
  createdAt: string
  updatedAt: string
}

interface SvixMessageRow {
  id: string
  eventId: string | null
  eventType: string
  payload: Record<string, unknown>
  timestamp: string
}

interface SvixAttemptRow {
  id: string
  msgId: string
  endpointId: string
  url: string
  status: 0 | 1 | 2 | 3
  responseStatusCode: number
  response: string
  responseDurationMs: number
  triggerType: 0 | 1
  timestamp: string
}

const now = Date.now()
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

const EVENT_TYPES: [string, string][] = [
  ['invoice.create.drafted', 'A draft invoice was created.'],
  ['invoice.update.finalized', 'An invoice was finalized and can no longer change.'],
  ['invoice.payment.succeeded', 'A payment against an invoice succeeded.'],
  ['invoice.payment.failed', 'A payment against an invoice failed.'],
  ['subscription.created', 'A subscription was created.'],
  ['subscription.cancelled', 'A subscription was cancelled.'],
  ['customer.created', 'A customer was created.'],
  ['wallet.credit_balance.dropped', "A wallet's balance fell below its alert threshold."],
]

function exampleFor(name: string): Record<string, unknown> {
  return {
    event_type: name,
    tenant_id: 'tenant_01M38QNORTHWIND000000001',
    environment_id: 'env_01M38QPRODUCTION000000001',
    payload: { id: `${name.split('.')[0]}_01M38QDEMO0000000000000001` },
  }
}

const eventTypes = EVENT_TYPES.map(([name, description]) => ({
  name,
  description,
  archived: false,
  deprecated: name === 'subscription.cancelled',
  featureFlag: null,
  groupName: null,
  createdAt: minutesAgo(60 * 24 * 90),
  updatedAt: minutesAgo(60 * 24 * 30),
  // `customer.created` has no example, so the "no example" paths have something to show.
  schemas:
    name === 'customer.created' ? null : { '1': { type: 'object', examples: [exampleFor(name)] } },
}))

const endpoints: SvixEndpointRow[] = [
  {
    id: 'ep_2mVxQ7nB8yL4cZ1kR0aT3sW9',
    url: 'https://api.northwind.dev/webhooks/flexprice',
    description: 'Production billing sync',
    filterTypes: [
      'invoice.update.finalized',
      'invoice.payment.succeeded',
      'invoice.payment.failed',
    ],
    rateLimit: 50,
    disabled: false,
    version: 1,
    createdAt: minutesAgo(60 * 24 * 56),
    updatedAt: minutesAgo(60 * 24 * 7),
  },
  {
    id: 'ep_2mVxS1pD4uJ6eW8hT2bQ5nX7',
    url: 'https://alerts.northwind.dev/flexprice',
    description: 'Finance alerts channel',
    filterTypes: null,
    rateLimit: null,
    disabled: false,
    version: 1,
    createdAt: minutesAgo(60 * 24 * 38),
    updatedAt: minutesAgo(60 * 24 * 38),
  },
  {
    id: 'ep_2mVxU9rF2wH8gY4jV6cS1mZ3',
    url: 'https://staging.northwind.dev/webhooks',
    description: '',
    filterTypes: ['subscription.created'],
    rateLimit: null,
    disabled: true,
    version: 1,
    createdAt: minutesAgo(60 * 24 * 80),
    updatedAt: minutesAgo(60 * 24 * 20),
  },
]

/** Visibly fake, like the portal token: a secret-shaped string nobody would paste anywhere. */
const secrets = new Map<string, string>(
  endpoints.map((endpoint, index) => [endpoint.id, `whsec_DEMO_not_a_real_secret_${index}`]),
)

const headers = new Map<string, { headers: Record<string, string>; sensitive: string[] }>([
  [
    'ep_2mVxQ7nB8yL4cZ1kR0aT3sW9',
    { headers: { 'X-Team': 'billing-platform' }, sensitive: ['Authorization'] },
  ],
])

const messages: SvixMessageRow[] = []
const attempts: SvixAttemptRow[] = []

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
}

function subscribes(endpoint: SvixEndpointRow, eventType: string): boolean {
  return !endpoint.filterTypes || endpoint.filterTypes.length === 0
    ? true
    : endpoint.filterTypes.includes(eventType)
}

function attempt(
  message: SvixMessageRow,
  endpoint: SvixEndpointRow,
  outcome: { ok: boolean; manual?: boolean; at?: string },
): SvixAttemptRow {
  return {
    id: newId('atmpt'),
    msgId: message.id,
    endpointId: endpoint.id,
    url: endpoint.url,
    status: outcome.ok ? 0 : 2,
    responseStatusCode: outcome.ok ? 200 : 500,
    response: outcome.ok ? '{"received":true}' : '{"error":"upstream timeout"}',
    responseDurationMs: outcome.ok ? 96 + (attempts.length % 9) * 31 : 15000,
    triggerType: outcome.manual ? 1 : 0,
    timestamp: outcome.at ?? new Date().toISOString(),
  }
}

// Forty messages over the last ten hours; every seventh delivery fails.
for (let index = 0; index < 40; index += 1) {
  const [name] = EVENT_TYPES[(index * 3) % EVENT_TYPES.length]!
  const message: SvixMessageRow = {
    id: `msg_2mW0${index.toString().padStart(3, '0')}DEMO${(1000 + index).toString(36)}`,
    eventId: index % 5 === 0 ? `evt_demo_${index}` : null,
    eventType: name,
    payload: exampleFor(name),
    timestamp: minutesAgo(index * 15 + 3),
  }
  messages.push(message)
  for (const endpoint of endpoints) {
    if (endpoint.disabled || !subscribes(endpoint, name)) continue
    const at = new Date(new Date(message.timestamp).getTime() + 1500).toISOString()
    attempts.push(attempt(message, endpoint, { ok: attempts.length % 7 !== 3, at }))
  }
}

function page<T>(rows: T[], url: URL) {
  const limit = Number(url.searchParams.get('limit') ?? 50)
  const offset = Number(url.searchParams.get('iterator') ?? 0) || 0
  const done = offset + limit >= rows.length
  return {
    data: rows.slice(offset, offset + limit),
    iterator: done ? null : String(offset + limit),
    prevIterator: null,
    done,
  }
}

function notFound(what: string) {
  return HttpResponse.json({ code: 'not_found', detail: `${what} not found.` }, { status: 404 })
}

function findEndpoint(id: unknown): SvixEndpointRow | undefined {
  return endpoints.find((endpoint) => endpoint.id === id)
}

function latestStatus(msgId: string, endpointId: string): number | null {
  const latest = attempts
    .filter((entry) => entry.msgId === msgId && entry.endpointId === endpointId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
  return latest ? latest.status : null
}

export const svixHandlers = [
  http.get(`${SVIX}/event-type`, ({ request }) =>
    HttpResponse.json(page(eventTypes, new URL(request.url))),
  ),

  http.get(`${SVIX}/app/:appId/endpoint`, ({ request }) =>
    HttpResponse.json(page([...endpoints].reverse(), new URL(request.url))),
  ),
  http.post(`${SVIX}/app/:appId/endpoint`, async ({ request }) => {
    const body = (await request.json()) as Partial<SvixEndpointRow>
    if (!body.url) {
      return HttpResponse.json(
        {
          code: 'validation',
          detail: [{ loc: ['body', 'url'], msg: 'URL is required.', type: 'value_error' }],
        },
        { status: 422 },
      )
    }
    const row: SvixEndpointRow = {
      id: newId('ep'),
      url: body.url,
      description: body.description ?? '',
      filterTypes: body.filterTypes ?? null,
      rateLimit: body.rateLimit ?? null,
      disabled: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    endpoints.push(row)
    secrets.set(row.id, `whsec_DEMO_not_a_real_secret_${endpoints.length}`)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.get(`${SVIX}/app/:appId/endpoint/:endpointId`, ({ params }) => {
    const row = findEndpoint(params['endpointId'])
    return row ? HttpResponse.json(row) : notFound('Endpoint')
  }),
  http.put(`${SVIX}/app/:appId/endpoint/:endpointId`, async ({ params, request }) => {
    const row = findEndpoint(params['endpointId'])
    if (!row) return notFound('Endpoint')
    const body = (await request.json()) as Partial<SvixEndpointRow>
    Object.assign(row, {
      url: body.url ?? row.url,
      description: body.description ?? '',
      filterTypes: body.filterTypes ?? null,
      rateLimit: body.rateLimit ?? null,
      disabled: body.disabled ?? false,
      updatedAt: new Date().toISOString(),
    })
    return HttpResponse.json(row)
  }),
  http.delete(`${SVIX}/app/:appId/endpoint/:endpointId`, ({ params }) => {
    const index = endpoints.findIndex((endpoint) => endpoint.id === params['endpointId'])
    if (index < 0) return notFound('Endpoint')
    endpoints.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${SVIX}/app/:appId/endpoint/:endpointId/secret`, ({ params }) => {
    const key = secrets.get(String(params['endpointId']))
    return key ? HttpResponse.json({ key }) : notFound('Endpoint')
  }),
  http.post(`${SVIX}/app/:appId/endpoint/:endpointId/secret/rotate`, ({ params }) => {
    secrets.set(String(params['endpointId']), `whsec_DEMO_rotated_${Date.now().toString(36)}`)
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${SVIX}/app/:appId/endpoint/:endpointId/stats`, ({ params, request }) => {
    const url = new URL(request.url)
    const since = url.searchParams.get('since')
    const until = url.searchParams.get('until')
    const counts = { success: 0, pending: 0, fail: 0, sending: 0 }
    for (const entry of attempts) {
      if (entry.endpointId !== params['endpointId']) continue
      if (since && entry.timestamp < since) continue
      if (until && entry.timestamp >= until) continue
      if (entry.status === 0) counts.success += 1
      else if (entry.status === 1) counts.pending += 1
      else if (entry.status === 2) counts.fail += 1
      else counts.sending += 1
    }
    return HttpResponse.json(counts)
  }),
  http.get(`${SVIX}/app/:appId/endpoint/:endpointId/headers`, ({ params }) =>
    HttpResponse.json(headers.get(String(params['endpointId'])) ?? { headers: {}, sensitive: [] }),
  ),
  http.patch(`${SVIX}/app/:appId/endpoint/:endpointId/headers`, async ({ params, request }) => {
    const id = String(params['endpointId'])
    const body = (await request.json()) as {
      headers?: Record<string, string>
      deleteHeaders?: string[]
    }
    const removed = body.deleteHeaders ?? []
    const set = body.headers ?? {}
    const current = headers.get(id) ?? { headers: {}, sensitive: [] }
    const next = { ...current.headers, ...set }
    for (const name of removed) delete next[name]
    headers.set(id, {
      headers: next,
      sensitive: current.sensitive.filter((name) => !removed.includes(name) && !(name in set)),
    })
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${SVIX}/app/:appId/endpoint/:endpointId/send-example`, async ({ params, request }) => {
    const endpoint = findEndpoint(params['endpointId'])
    if (!endpoint) return notFound('Endpoint')
    const { eventType } = (await request.json()) as { eventType: string }
    const type = eventTypes.find((entry) => entry.name === eventType)
    const example = type?.schemas?.['1'].examples[0]
    if (!example) {
      return HttpResponse.json(
        { code: 'missing_schema', detail: `Event type ${eventType} has no example to send.` },
        { status: 400 },
      )
    }
    const message: SvixMessageRow = {
      id: newId('msg'),
      eventId: null,
      eventType,
      payload: example,
      timestamp: new Date().toISOString(),
    }
    messages.unshift(message)
    attempts.push(attempt(message, endpoint, { ok: true, manual: true }))
    return HttpResponse.json(message, { status: 202 })
  }),
  http.post(`${SVIX}/app/:appId/endpoint/:endpointId/recover`, () =>
    HttpResponse.json(
      { id: newId('qtask'), status: 'running', task: 'endpoint.recover' },
      { status: 202 },
    ),
  ),
  http.get(`${SVIX}/app/:appId/endpoint/:endpointId/msg`, ({ params, request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const endpointId = String(params['endpointId'])
    const rows = messages
      .map((message) => ({ message, latest: latestStatus(message.id, endpointId) }))
      .filter(({ latest }) => latest !== null && (status === null || String(latest) === status))
      .map(({ message, latest }) => ({ ...message, status: latest, nextAttempt: null }))
    return HttpResponse.json(page(rows, url))
  }),

  http.get(`${SVIX}/app/:appId/msg`, ({ request }) => {
    const url = new URL(request.url)
    const types = url.searchParams.getAll('event_types')
    const rows =
      types.length > 0 ? messages.filter((message) => types.includes(message.eventType)) : messages
    return HttpResponse.json(page(rows, url))
  }),
  http.get(`${SVIX}/app/:appId/msg/:msgId`, ({ params }) => {
    const message = messages.find((entry) => entry.id === params['msgId'])
    return message ? HttpResponse.json(message) : notFound('Message')
  }),
  http.get(`${SVIX}/app/:appId/attempt/msg/:msgId`, ({ params, request }) => {
    const url = new URL(request.url)
    const endpointId = url.searchParams.get('endpoint_id')
    const rows = attempts
      .filter(
        (entry) =>
          entry.msgId === params['msgId'] && (!endpointId || entry.endpointId === endpointId),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    return HttpResponse.json(page(rows, url))
  }),
  http.post(`${SVIX}/app/:appId/msg/:msgId/endpoint/:endpointId/resend`, ({ params }) => {
    const endpoint = findEndpoint(params['endpointId'])
    const message = messages.find((entry) => entry.id === params['msgId'])
    if (!endpoint || !message) return notFound('Message or endpoint')
    attempts.push(attempt(message, endpoint, { ok: true, manual: true }))
    return new HttpResponse(null, { status: 202 })
  }),

  // Svix Play's public token endpoint, behind "Use a Svix Play test URL".
  http.post('https://api.play.svix.com/api/v1/token/generate/', () =>
    HttpResponse.json({ token: `e_demo${Date.now().toString(36)}` }),
  ),
]
