import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, ErrorKind } from './errors'
import {
  createWebhookEndpoint,
  generateSvixPlayEndpoint,
  listWebhookEndpointMessages,
  patchWebhookEndpointHeaders,
  svixServerURL,
  updateWebhookEndpoint,
} from './webhooks'

const SESSION = { appId: 'app_1', token: 'sk_portal_test.eu' }

function harness(respond: () => Response) {
  const seen: Request[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as RequestInfo, init)
    seen.push(request)
    return respond()
  })
  return { seen }
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('svixServerURL', () => {
  it('routes a regional token to its region, as the svix SDK does', () => {
    expect(svixServerURL('sk_x.eu')).toBe('https://api.eu.svix.com')
    expect(svixServerURL('sk_x.us')).toBe('https://api.us.svix.com')
    expect(svixServerURL('sk_x')).toBe('https://api.svix.com')
    expect(svixServerURL('sk_x.eu', 'https://svix.internal/')).toBe('https://svix.internal')
  })
})

describe('requests', () => {
  it('sends the portal token as a bearer and never in the URL', async () => {
    const { seen } = harness(json({ data: [], iterator: null, done: true }))
    await listWebhookEndpointMessages(SESSION, 'ep_1', { status: 2 })
    const request = seen[0]!
    expect(request.url).toBe(
      'https://api.eu.svix.com/api/v1/app/app_1/endpoint/ep_1/msg?limit=100&status=2&with_content=true',
    )
    expect(request.headers.get('Authorization')).toBe(`Bearer ${SESSION.token}`)
    expect(request.url).not.toContain(SESSION.token)
  })

  it('omits filterTypes on create when every event is wanted', async () => {
    const { seen } = harness(json({ id: 'ep_1' }))
    await createWebhookEndpoint(SESSION, { url: 'https://example.com/hook', filterTypes: [] })
    expect(await seen[0]!.json()).toEqual({ url: 'https://example.com/hook', version: 1 })
  })

  it('sends a full replacement on update, null filterTypes for every event', async () => {
    const { seen } = harness(json({ id: 'ep_1' }))
    await updateWebhookEndpoint(SESSION, 'ep_1', {
      url: 'https://example.com/hook',
      description: 'Prod',
      filterTypes: [],
      rateLimit: 10,
      disabled: true,
    })
    expect(seen[0]!.method).toBe('PUT')
    expect(await seen[0]!.json()).toEqual({
      url: 'https://example.com/hook',
      description: 'Prod',
      filterTypes: null,
      rateLimit: 10,
      disabled: true,
    })
  })

  it('patches headers rather than replacing them', async () => {
    const { seen } = harness(() => new Response(null, { status: 204 }))
    await patchWebhookEndpointHeaders(SESSION, 'ep_1', { headers: {}, deleteHeaders: ['X-Old'] })
    expect(seen[0]!.method).toBe('PATCH')
    expect(await seen[0]!.json()).toEqual({ headers: {}, deleteHeaders: ['X-Old'] })
  })

  it("surfaces Svix's detail as the error message", async () => {
    harness(json({ code: 'missing_schema', detail: 'Event type has no example' }, 400))
    const error = await listWebhookEndpointMessages(SESSION, 'ep_1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).kind).toBe(ErrorKind.Invalid)
    expect((error as ApiError).message).toBe('Event type has no example')
  })

  it('refuses to send without a token', async () => {
    harness(json({}))
    await expect(
      listWebhookEndpointMessages({ appId: 'app_1', token: '' }, 'ep_1'),
    ).rejects.toThrow(/not set up/)
  })
})

describe('generateSvixPlayEndpoint', () => {
  it('turns a Play token into ingest and inspector URLs', async () => {
    harness(json({ token: 'e_abc' }))
    await expect(generateSvixPlayEndpoint()).resolves.toEqual({
      ingestUrl: 'https://play.svix.com/in/e_abc/',
      inspectorUrl: 'https://play.svix.com/#e_abc',
    })
  })

  it('accepts a bare string token', async () => {
    harness(json('e_str'))
    await expect(generateSvixPlayEndpoint()).resolves.toMatchObject({
      ingestUrl: 'https://play.svix.com/in/e_str/',
    })
  })
})
