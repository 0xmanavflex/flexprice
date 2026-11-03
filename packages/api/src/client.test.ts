import { describe, expect, it, vi } from 'vitest'
import { createFlexpriceClient, call, callWrite } from './client'
import { ApiError, ErrorKind } from './errors'
import { listCreditNotes } from './creditNotes'

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
    respond?: (request: Request) => Response | Promise<Response>
    onUnauthorized?: () => void
    timeoutMs?: number
    /** Replaces the stub outright, e.g. to hang until aborted. */
    fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
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
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    fetcher:
      options.fetcher ??
      (async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init)
        seen.push(request)
        return (
          (await options.respond?.(request)) ??
          new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }),
  })

  return { client, seen }
}

function apiFailure(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

/** A fetcher that never answers, but honours its signal the way `fetch` does. */
function hangUntilAborted(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal
    if (!signal) return
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
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

describe('deadline and cancellation', () => {
  // A hung connection must become a retryable "took too long", not a skeleton
  // that never resolves and not an "offline" banner.
  it('fails as a Timeout when the API does not answer in time', async () => {
    const { client } = harness({ timeoutMs: 20, fetcher: hangUntilAborted })

    await expect(call(() => client.customers.queryCustomer({}))).rejects.toMatchObject({
      kind: ErrorKind.Timeout,
      retryable: true,
    })
  })

  it('does not time out a request that answers inside the deadline', async () => {
    const { client } = harness({ timeoutMs: 200 })

    await expect(call(() => client.customers.queryCustomer({}))).resolves.toBeDefined()
  })

  // A cancelled query is the user moving on, not something to show.
  it('reports a caller abort as Cancelled, not as a network failure or a timeout', async () => {
    const { client } = harness({ timeoutMs: 5_000, fetcher: hangUntilAborted })
    const controller = new AbortController()

    const pending = call(
      (options) => client.customers.queryCustomer({}, options),
      controller.signal,
    )
    controller.abort()

    await expect(pending).rejects.toMatchObject({ kind: ErrorKind.Cancelled, retryable: false })
  })

  it('rejects at once when the signal was already aborted', async () => {
    const { client, seen } = harness({ fetcher: hangUntilAborted })
    const controller = new AbortController()
    controller.abort()

    await expect(
      call((options) => client.customers.queryCustomer({}, options), controller.signal),
    ).rejects.toMatchObject({ kind: ErrorKind.Cancelled })
    expect(seen).toHaveLength(0)
  })

  it('can switch the deadline off', async () => {
    const { client } = harness({
      timeoutMs: 0,
      respond: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40))
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    })

    await expect(call(() => client.customers.queryCustomer({}))).resolves.toBeDefined()
  })
})

describe('rate limiting', () => {
  it('maps 429 to RateLimited and reads Retry-After in seconds', async () => {
    const { client } = harness({
      respond: () =>
        apiFailure(
          429,
          { success: false, error: { message: 'slow down' } },
          { 'Retry-After': '7' },
        ),
    })

    await expect(call(() => client.customers.queryCustomer({}))).rejects.toMatchObject({
      kind: ErrorKind.RateLimited,
      status: 429,
      retryAfterMs: 7000,
      retryable: false,
    })
  })

  it('reads Retry-After given as an HTTP date', async () => {
    const at = new Date(Date.now() + 10_000).toUTCString()
    const { client } = harness({
      respond: () =>
        apiFailure(429, { success: false, error: { message: 'slow' } }, { 'Retry-After': at }),
    })

    const error = await call(() => client.customers.queryCustomer({})).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).retryAfterMs).toBeGreaterThan(7_000)
    expect((error as ApiError).retryAfterMs).toBeLessThanOrEqual(10_000)
  })

  it('leaves retryAfterMs unset when the header is absent', async () => {
    const { client } = harness({
      respond: () => apiFailure(429, { success: false, error: { message: 'slow' } }),
    })

    const error = await call(() => client.customers.queryCustomer({})).catch((e: unknown) => e)

    expect((error as ApiError).retryAfterMs).toBeUndefined()
  })
})

describe('401 handling', () => {
  // Twelve parallel requests with one dead token must end the session once.
  it('reports a burst of 401s for one credential only once', async () => {
    const onUnauthorized = vi.fn()
    const { client } = harness({
      onUnauthorized,
      respond: () => apiFailure(401, { success: false, error: { message: 'expired' } }),
    })

    await Promise.allSettled(
      Array.from({ length: 6 }, () => call(() => client.customers.queryCustomer({}))),
    )

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('reports again once a different credential is rejected', async () => {
    const onUnauthorized = vi.fn()
    const tokens = ['old', 'old', 'new']
    const client = createFlexpriceClient({
      serverURL: SERVER,
      auth: { getToken: async () => tokens.shift() ?? null, getEnvironmentId: async () => 'env_1' },
      onUnauthorized,
      fetcher: async () => apiFailure(401, { success: false, error: { message: 'expired' } }),
    })

    await Promise.allSettled([
      call(() => client.customers.queryCustomer({})),
      call(() => client.customers.queryCustomer({})),
      call(() => client.customers.queryCustomer({})),
    ])

    expect(onUnauthorized).toHaveBeenCalledTimes(2)
  })
})

describe('a 401 from a raw route', () => {
  it('ends the session once, like an SDK 401', async () => {
    const onUnauthorized = vi.fn()
    createFlexpriceClient({
      serverURL: SERVER,
      auth: { getToken: async () => 'jwt-abc', getEnvironmentId: async () => 'env_123' },
      onUnauthorized,
    })
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }))
    const params = { limit: 10, offset: 0 }

    await expect(listCreditNotes(SERVER, 'jwt-abc', 'env_123', params)).rejects.toMatchObject({
      kind: ErrorKind.Unauthorized,
    })
    await expect(listCreditNotes(SERVER, 'jwt-abc', 'env_123', params)).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('callWrite', () => {
  const draft = {
    entityType: 'customer',
    entityId: 'cust_1',
    taxRateCode: 'gb_vat',
    taxBehavior: 'exclusive',
    priority: 100,
    autoApply: true,
  }

  it('resolves a successful write whose empty body the SDK cannot parse', async () => {
    const { client } = harness({ respond: () => new Response('', { status: 200 }) })
    // The same call through `call` is the version-mismatch error the form showed.
    await expect(
      call(() => client.taxAssociations.createTaxAssociation(draft as never)),
    ).rejects.toMatchObject({ kind: ErrorKind.Unknown })
    await expect(
      callWrite(() => client.taxAssociations.createTaxAssociation(draft as never)),
    ).resolves.toBeUndefined()
  })

  it('resolves a successful write whose body does not match the schema', async () => {
    const { client } = harness({
      respond: () =>
        new Response(JSON.stringify({ tax_behavior: 42 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    })
    await expect(
      call(() => client.taxAssociations.createTaxAssociation(draft as never)),
    ).rejects.toMatchObject({ message: expect.stringMatching(/version mismatch/) })
    await expect(
      callWrite(() => client.taxAssociations.createTaxAssociation(draft as never)),
    ).resolves.toBeUndefined()
  })

  it('still rejects a failed write', async () => {
    const { client } = harness({
      respond: () => apiFailure(400, { error: { message: 'tax rate not found' } }),
    })
    await expect(
      callWrite(() => client.taxAssociations.createTaxAssociation(draft as never)),
    ).rejects.toBeInstanceOf(ApiError)
  })
})
