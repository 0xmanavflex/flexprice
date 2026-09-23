import { describe, expect, it, vi } from 'vitest'
import { createFlexpriceClient, call } from './client'
import { ApiError, ErrorKind } from './errors'

const SERVER = 'https://api.test.flexprice.io/v1'

/**
 * Drives the real SDK with a stub fetcher.
 *
 * Mocking `@flexprice/sdk` itself would test the mock: the thing worth proving
 * is that headers survive the SDK's own request pipeline and reach the wire.
 */
function harness(
  options: {
    token?: string | null
    environmentId?: string | null
    respond?: (request: Request) => Response
    onUnauthorized?: () => void
  } = {},
) {
  const { token = 'jwt-abc', environmentId = 'env_123' } = options
  const seen: Request[] = []

  const client = createFlexpriceClient({
    serverURL: SERVER,
    auth: {
      getToken: async () => token,
      getEnvironmentId: async () => environmentId,
    },
    ...(options.onUnauthorized ? { onUnauthorized: options.onUnauthorized } : {}),
    fetcher: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      seen.push(request)
      return (
        options.respond?.(request) ??
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    },
  })

  return { client, seen }
}

function apiFailure(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createFlexpriceClient', () => {
  it('puts the user JWT and the active environment on the request', async () => {
    const { client, seen } = harness()

    await call(() => client.customers.queryCustomer({}))

    expect(seen).toHaveLength(1)
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer jwt-abc')
    expect(seen[0]?.headers.get('X-Environment-ID')).toBe('env_123')
  })

  // An API key in a browser bundle is a key given to every visitor. The SDK's
  // typed `security` option takes one; this client must never populate it.
  it('never sends an API key', async () => {
    const { client, seen } = harness()

    await call(() => client.customers.queryCustomer({}))

    const headerNames = [...seen[0]!.headers.keys()].map((h) => h.toLowerCase())
    expect(headerNames).not.toContain('x-api-key')
    expect(seen[0]?.headers.get('Authorization')).not.toMatch(/^sk_/)
  })

  // The current-user lookup is what says whose environments to list, so it
  // cannot itself require one. Gating it deadlocks sign-in; the exemption is
  // behaviour, not a detail.
  //
  // The other exempt route, `GET /environments`, has no SDK method to call here
  // — it is absent from the OpenAPI document despite being a live route. See
  // `docs/api-contract-gap.md`.
  it('omits the environment header on the routes that bootstrap a session', async () => {
    const { client, seen } = harness()

    await call(() => client.users.getUserInfo())

    expect(seen[0]?.url).toContain('/users/me')
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer jwt-abc')
    expect(seen[0]?.headers.get('X-Environment-ID')).toBeNull()
  })

  it('sends no Authorization header when signed out', async () => {
    const { client, seen } = harness({ token: null, environmentId: null })

    await call(() => client.users.getUserInfo())

    expect(seen[0]?.headers.get('Authorization')).toBeNull()
  })

  it('re-reads the token per request, so a refresh takes effect without a rebuild', async () => {
    const tokens = ['first', 'second']
    const seen: Request[] = []
    const client = createFlexpriceClient({
      serverURL: SERVER,
      auth: {
        getToken: async () => tokens.shift() ?? null,
        getEnvironmentId: async () => 'env_123',
      },
      fetcher: async (input, init) => {
        seen.push(input instanceof Request ? input : new Request(input, init))
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    })

    await call(() => client.customers.queryCustomer({}))
    await call(() => client.customers.queryCustomer({}))

    expect(seen.map((r) => r.headers.get('Authorization'))).toEqual([
      'Bearer first',
      'Bearer second',
    ])
  })

  it('reports a 401 so the app can end the session in one place', async () => {
    const onUnauthorized = vi.fn()
    const { client } = harness({
      onUnauthorized,
      respond: () => apiFailure(401, { success: false, error: { message: 'token expired' } }),
    })

    await expect(call(() => client.customers.queryCustomer({}))).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})

describe('call', () => {
  it('surfaces the API message rather than the HTTP status text', async () => {
    const { client } = harness({
      respond: () =>
        apiFailure(400, { success: false, error: { message: 'external_id already exists' } }),
    })

    await expect(call(() => client.customers.queryCustomer({}))).rejects.toThrow(
      'external_id already exists',
    )
  })

  it.each([
    [401, ErrorKind.Unauthorized, false],
    [403, ErrorKind.Forbidden, false],
    [404, ErrorKind.NotFound, false],
    [422, ErrorKind.Invalid, false],
    [500, ErrorKind.Server, true],
  ])('maps %i to %s (retryable: %s)', async (status, kind, retryable) => {
    const { client } = harness({
      respond: () => apiFailure(status, { success: false, error: { message: 'nope' } }),
    })

    await expect(call(() => client.customers.queryCustomer({}))).rejects.toMatchObject({
      kind,
      status,
      retryable,
    })
  })

  it('carries field-level details through for form error mapping', async () => {
    const { client } = harness({
      respond: () =>
        apiFailure(422, {
          success: false,
          error: { message: 'validation failed', details: { email: 'invalid' } },
        }),
    })

    await expect(call(() => client.customers.queryCustomer({}))).rejects.toMatchObject({
      details: { email: 'invalid' },
    })
  })

  // A 502 from a load balancer is HTML. Showing a user a fragment of it is
  // worse than showing them the status text.
  it('falls back to status text when the body is not the API error envelope', async () => {
    const { client } = harness({
      respond: () =>
        new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          statusText: 'Bad Gateway',
        }),
    })

    const failure = call(() => client.customers.queryCustomer({}))

    await expect(failure).rejects.toMatchObject({ kind: ErrorKind.Server })
    await expect(failure).rejects.not.toThrow(/<html>/)
  })

  it('treats a transport failure as retryable, not as a bad request', async () => {
    const { client } = harness({
      respond: () => {
        throw new TypeError('Failed to fetch')
      },
    })

    await expect(call(() => client.customers.queryCustomer({}))).rejects.toMatchObject({
      kind: ErrorKind.Network,
      retryable: true,
    })
  })
})
