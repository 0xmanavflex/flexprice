import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, ErrorKind } from './errors'
import {
  createEnvironment,
  fetchCurrentUser,
  fetchEnvironments,
  signIn,
  signUp,
  updateEnvironment,
} from './session'

const SERVER = 'https://api.test.flexprice.io/v1'
const TOKEN = 'jwt-abc'

/**
 * Drives the real module with a stub `fetch`.
 *
 * `client.test.ts` hands the SDK a stub fetcher rather than mocking the SDK,
 * because the thing worth proving is what reaches the wire. The same applies
 * here with one difference: these four routes have no SDK to drive (they are
 * absent from the OpenAPI document — see `docs/api-contract-gap.md`), so the
 * seam is the global `fetch` the module calls directly.
 *
 * Requests are recorded as `Request` objects for the same reason the SDK test
 * does it: a `Headers` instance answers "was Authorization sent?" without a
 * test having to know whether the module passed a literal, an array of pairs or
 * a `Headers` to `fetch`.
 */
function harness(respond: (request: Request) => Response | Promise<Response> = ok({})) {
  const seen: Request[] = []

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as RequestInfo, init)
    seen.push(request)
    return respond(request)
  })

  return { seen }
}

function ok(body: unknown): () => Response {
  return () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
}

/** The API's own failure envelope — the shape `readErrorBody` digs into. */
function apiFailure(status: number, message: string, statusText?: string): () => Response {
  return () =>
    new Response(JSON.stringify({ success: false, error: { message } }), {
      status,
      ...(statusText ? { statusText } : {}),
      headers: { 'Content-Type': 'application/json' },
    })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request headers', () => {
  it('sends the JSON content type and the credentials, but no Authorization, on login', async () => {
    // Login is the one call with nothing to authorize with. Sending `Bearer
    // null` — or a stale token from a previous session — is how a sign-in
    // starts failing for the one user who needs it most: the one already
    // holding an expired token.
    const { seen } = harness(ok({ token: 't', user_id: 'u', tenant_id: 'tn' }))

    await signIn(SERVER, 'person@example.com', 'hunter2')

    expect(seen).toHaveLength(1)
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.url).toBe(`${SERVER}/auth/login`)
    expect(seen[0]?.headers.get('Authorization')).toBeNull()
    expect(seen[0]?.headers.get('Content-Type')).toBe('application/json')
    await expect(seen[0]?.json()).resolves.toEqual({
      email: 'person@example.com',
      password: 'hunter2',
    })
  })

  it('sends no Authorization on signup either', async () => {
    const { seen } = harness(ok({ token: 't' }))

    await signUp(SERVER, { email: 'new@example.com', password: 'hunter2' })

    expect(seen[0]?.url).toBe(`${SERVER}/auth/signup`)
    expect(seen[0]?.headers.get('Authorization')).toBeNull()
  })

  it('sends the confirmed Supabase token, and no password, on a hosted signup', async () => {
    const { seen } = harness(ok({ token: 't' }))

    await signUp(SERVER, {
      email: 'new@example.com',
      token: 'supabase-access',
      metadata: { signup_method: 'email' },
    })

    await expect(seen[0]?.json()).resolves.toEqual({
      email: 'new@example.com',
      token: 'supabase-access',
      metadata: { signup_method: 'email' },
    })
  })

  it.each([
    ['fetchCurrentUser', '/users/me', (server: string) => fetchCurrentUser(server, TOKEN)],
    ['fetchEnvironments', '/environments', (server: string) => fetchEnvironments(server, TOKEN)],
  ])('bearers the token on %s', async (_name, path, run) => {
    const { seen } = harness(ok({ environments: [] }))

    await run(SERVER)

    expect(seen[0]?.method).toBe('GET')
    expect(seen[0]?.url).toBe(`${SERVER}${path}`)
    expect(seen[0]?.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`)
  })

  // These two are the routes that *decide* the environment, so they cannot
  // require one; `client.test.ts` asserts the same exemption on the SDK path.
  // Here it is structural — nothing in this module can set the header — but a
  // test says so, because "we never added it" is not a guarantee.
  it('never sends X-Environment-ID, which these routes are exempt from', async () => {
    const { seen } = harness(ok({ environments: [] }))

    await fetchEnvironments(SERVER, TOKEN)

    const headerNames = [...seen[0]!.headers.keys()].map((h) => h.toLowerCase())
    expect(headerNames).not.toContain('x-environment-id')
  })

  it('never sends an API key', async () => {
    // A key in a browser bundle is a key given to every visitor. The session
    // routes are the ones a misguided "just use the key" fix would land on.
    const { seen } = harness(ok({}))

    await fetchCurrentUser(SERVER, TOKEN)

    const headerNames = [...seen[0]!.headers.keys()].map((h) => h.toLowerCase())
    expect(headerNames).not.toContain('x-api-key')
  })

  // `VITE_FLEXPRICE_API_URL` is typed by a human into a `.env.local`, so half of
  // them end it with a slash. `//auth/login` is a 404 on most routers, and the
  // resulting "not found" tells the user nothing about the trailing slash.
  it.each([
    ['no slash', 'https://api.test.flexprice.io/v1'],
    ['one trailing slash', 'https://api.test.flexprice.io/v1/'],
    ['several', 'https://api.test.flexprice.io/v1///'],
  ])('normalises a server URL with %s', async (_name, configured) => {
    const { seen } = harness(ok({ token: 't' }))

    await signIn(configured, 'a@b.com', 'x')

    expect(seen[0]?.url).toBe('https://api.test.flexprice.io/v1/auth/login')
  })
})

describe('failures', () => {
  it('turns a 401 into an ApiError carrying the API’s own message', async () => {
    // The message the backend wrote is the one worth showing: "That email and
    // password do not match" beats "Unauthorized", which reads as a system
    // fault rather than a typo.
    harness(apiFailure(401, 'email or password is incorrect', 'Unauthorized'))

    const failure = signIn(SERVER, 'a@b.com', 'wrong')

    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({
      kind: ErrorKind.Unauthorized,
      status: 401,
      retryable: false,
    })
    await expect(failure).rejects.toThrow('email or password is incorrect')
  })

  it('classifies an expired token on a read as unauthorized, not as a bad response', async () => {
    harness(apiFailure(401, 'token expired', 'Unauthorized'))

    await expect(fetchCurrentUser(SERVER, TOKEN)).rejects.toMatchObject({
      kind: ErrorKind.Unauthorized,
      status: 401,
    })
  })

  // A 502 from a load balancer is an HTML page, not the API's envelope. Putting
  // a fragment of it in front of a user is worse than the status text: it looks
  // like the console broke, and it leaks whatever the proxy chose to print.
  it('falls back to status text for an HTML 502 rather than surfacing the page', async () => {
    harness(
      () =>
        new Response('<html><head><title>502</title></head><body>Bad Gateway</body></html>', {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/html' },
        }),
    )

    const failure = fetchEnvironments(SERVER, TOKEN)

    await expect(failure).rejects.toMatchObject({
      kind: ErrorKind.Server,
      status: 502,
      // 5xx is the one class of failure where trying again is reasonable.
      retryable: true,
    })
    await expect(failure).rejects.toThrow('Bad Gateway')
    await expect(failure).rejects.not.toThrow(/<html>/)
  })

  it('still says something when the proxy sends no status text either', async () => {
    // `Response.statusText` is often empty from a raw upstream. An empty
    // message renders as a blank error box, which is indistinguishable from
    // the app having hung.
    harness(() => new Response('', { status: 500, statusText: '' }))

    await expect(fetchCurrentUser(SERVER, TOKEN)).rejects.toThrow('The request failed (500).')
  })

  it('treats a fetch rejection as a retryable network failure', async () => {
    // `fetch` rejects only for transport: offline, DNS, a blocked CORS
    // preflight. There is no status to classify, and calling it "invalid" would
    // tell a user to fix their credentials when their wifi is off.
    harness(() => {
      throw new TypeError('Failed to fetch')
    })

    const failure = signIn(SERVER, 'a@b.com', 'x')

    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({
      kind: ErrorKind.Network,
      retryable: true,
    })
    await expect(failure).rejects.toThrow('Could not reach Flexprice.')
  })

  it('keeps the transport failure as the cause, so a console trace still names CORS', async () => {
    const cause = new TypeError('Failed to fetch')
    harness(() => {
      throw cause
    })

    await expect(signIn(SERVER, 'a@b.com', 'x')).rejects.toMatchObject({ cause })
  })

  it('does not present a 200 whose body is not JSON as a session', async () => {
    // A captive-portal or proxy interstitial answers 200 with HTML. Parsing it
    // must fail loudly rather than yielding `undefined` fields.
    harness(() => new Response('<html>hi</html>', { status: 200 }))

    await expect(signIn(SERVER, 'a@b.com', 'x')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('signIn', () => {
  it('returns the credentials a session is built from', async () => {
    harness(ok({ token: 'jwt-xyz', user_id: 'user_1', tenant_id: 'tenant_1' }))

    await expect(signIn(SERVER, 'a@b.com', 'x')).resolves.toEqual({
      token: 'jwt-xyz',
      userId: 'user_1',
      tenantId: 'tenant_1',
    })
  })

  // A 200 with no token is a backend that changed shape. Storing `undefined`
  // signs someone in to a console where every subsequent call 401s — an app
  // that looks signed in and works nowhere is harder to report than a refusal.
  it.each([
    ['no token field', { user_id: 'u' }],
    ['an empty token', { token: '' }],
    ['a non-string token', { token: 12345 }],
    ['an array instead of an object', []],
    ['null', null],
  ])('refuses to sign in on a 200 with %s', async (_name, body) => {
    harness(ok(body))

    const failure = signIn(SERVER, 'a@b.com', 'x')

    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toThrow('Flexprice did not return a session token.')
  })

  it('tolerates a token with no ids rather than failing the sign-in', async () => {
    // The token is what every later call needs; `user_id` and `tenant_id` are
    // convenience. Refusing a usable session over a missing label would be the
    // wrong trade in the other direction.
    harness(ok({ token: 'jwt-xyz' }))

    await expect(signIn(SERVER, 'a@b.com', 'x')).resolves.toEqual({
      token: 'jwt-xyz',
      userId: '',
      tenantId: '',
    })
  })
})

describe('fetchCurrentUser', () => {
  it('flattens the tenant onto the user a header can render', async () => {
    harness(
      ok({
        id: 'user_1',
        email: 'person@example.com',
        roles: ['admin'],
        tenant: { id: 'tenant_1', name: 'Acme' },
      }),
    )

    await expect(fetchCurrentUser(SERVER, TOKEN)).resolves.toEqual({
      id: 'user_1',
      email: 'person@example.com',
      roles: ['admin'],
      type: 'user',
      tenantId: 'tenant_1',
      tenantName: 'Acme',
    })
  })

  it('keeps the principal type, which picks the role catalogue', async () => {
    harness(ok({ id: 'svc_1', type: 'service_account', roles: ['event_ingestor'] }))

    await expect(fetchCurrentUser(SERVER, TOKEN)).resolves.toMatchObject({
      type: 'service_account',
    })
  })

  it('survives a user with no tenant and no roles', async () => {
    harness(ok({ id: 'user_1', email: 'person@example.com' }))

    await expect(fetchCurrentUser(SERVER, TOKEN)).resolves.toMatchObject({
      roles: [],
      tenantId: '',
      tenantName: '',
    })
  })

  it('drops roles that are not strings rather than putting them in a badge', async () => {
    harness(ok({ roles: ['admin', 42, null, { name: 'editor' }] }))

    await expect(fetchCurrentUser(SERVER, TOKEN)).resolves.toMatchObject({ roles: ['admin'] })
  })

  it('rejects a body that is not an object at all', async () => {
    harness(ok(['not', 'a', 'user']))

    await expect(fetchCurrentUser(SERVER, TOKEN)).rejects.toThrow(
      'Flexprice returned an unrecognised user.',
    )
  })
})

describe('fetchEnvironments', () => {
  it('reads the rows out of the envelope', async () => {
    harness(
      ok({
        environments: [
          { id: 'env_1', name: 'Production', type: 'production' },
          { id: 'env_2', name: 'Sandbox', type: 'development' },
        ],
      }),
    )

    await expect(fetchEnvironments(SERVER, TOKEN)).resolves.toEqual([
      { id: 'env_1', name: 'Production', type: 'production' },
      { id: 'env_2', name: 'Sandbox', type: 'development' },
    ])
  })

  // An empty list is a real answer — a tenant mid-provisioning has one. It is
  // not an error, and the environment switcher is the thing that says so.
  it.each([
    ['an empty list', { environments: [] }],
    ['no envelope key', { total: 0 }],
    ['a null list', { environments: null }],
    ['an object where a list was expected', { environments: { env_1: {} } }],
    ['an empty body', {}],
    ['an array instead of an envelope', []],
  ])('returns no environments for %s rather than throwing', async (_name, body) => {
    harness(ok(body))

    await expect(fetchEnvironments(SERVER, TOKEN)).resolves.toEqual([])
  })

  it('drops rows that are not objects and fills in fields that are missing', async () => {
    // A row with no id cannot be selected, but dropping the whole response over
    // one bad row would empty the switcher and strand the user. The row that
    // survives is the one the console can act on.
    harness(
      ok({
        environments: [
          'env_1',
          null,
          42,
          ['env_2'],
          { id: 'env_3' },
          { id: 'env_4', name: 'Prod', type: 'production' },
        ],
      }),
    )

    await expect(fetchEnvironments(SERVER, TOKEN)).resolves.toEqual([
      { id: 'env_3', name: '', type: '' },
      { id: 'env_4', name: 'Prod', type: 'production' },
    ])
  })

  it('reads a 204 with no body as no environments', async () => {
    // `new Response('', ...)` is rejected by the runtime for a 204, which is
    // itself the point: a 204 carries no body, and the module must not assume
    // one is there to parse.
    harness(() => new Response(null, { status: 204 }))

    await expect(fetchEnvironments(SERVER, TOKEN)).resolves.toEqual([])
  })
})

describe('createEnvironment', () => {
  it('posts the draft and bearers the token', async () => {
    const { seen } = harness(ok({ id: 'env_9', name: 'Staging', type: 'development' }))

    await createEnvironment(SERVER, TOKEN, { name: 'Staging', type: 'development' })

    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.url).toBe(`${SERVER}/environments`)
    expect(seen[0]?.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`)
    await expect(seen[0]?.json()).resolves.toEqual({ name: 'Staging', type: 'development' })
  })

  it('echoes the draft back when the response omits the fields it was sent', async () => {
    // A blank name in the environment switcher is a worse lie than the name we
    // just asked for; the id is the only field only the server can supply.
    harness(ok({ id: 'env_9' }))

    await expect(
      createEnvironment(SERVER, TOKEN, { name: 'Staging', type: 'development' }),
    ).resolves.toEqual({ id: 'env_9', name: 'Staging', type: 'development' })
  })

  // Whether a tenant may create another environment is a server-side quota this
  // package cannot compute. The only honest answer is the API's own sentence.
  it('surfaces the quota message rather than a generic failure', async () => {
    harness(
      apiFailure(
        400,
        'You have reached the maximum limit of 2 development environment(s)',
        'Bad Request',
      ),
    )

    const failure = createEnvironment(SERVER, TOKEN, { name: 'Another', type: 'development' })

    await expect(failure).rejects.toMatchObject({ kind: ErrorKind.Invalid, status: 400 })
    await expect(failure).rejects.toThrow('maximum limit of 2 development environment(s)')
  })
})

describe('updateEnvironment', () => {
  it('puts the new name, and only the name, to the environment', async () => {
    const { seen } = harness(ok({ id: 'env_9', name: 'EU staging', type: 'development' }))

    await expect(
      updateEnvironment(SERVER, TOKEN, 'env_9', { name: 'EU staging' }),
    ).resolves.toEqual({ id: 'env_9', name: 'EU staging', type: 'development' })

    expect(seen[0]?.method).toBe('PUT')
    expect(seen[0]?.url).toBe(`${SERVER}/environments/env_9`)
    expect(seen[0]?.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`)
    // Not a discovery route: without the header the API answers 403
    // "Invalid or inaccessible environment".
    expect(seen[0]?.headers.get('X-Environment-ID')).toBe('env_9')
    // The type is immutable server-side; sending it would only risk a refusal.
    await expect(seen[0]?.json()).resolves.toEqual({ name: 'EU staging' })
  })

  it("reports the API's own sentence, not the status, when refused", async () => {
    harness(
      () =>
        new Response(
          JSON.stringify({
            error: 'Access denied',
            message: 'Invalid or inaccessible environment',
          }),
          { status: 403, statusText: '' },
        ),
    )

    const failure = await updateEnvironment(SERVER, TOKEN, 'env_9', { name: 'QA' }).catch(
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).message).toBe('Invalid or inaccessible environment')
    expect((failure as ApiError).fromServer).toBe(true)
  })

  it('echoes the id and name back when the response omits them', async () => {
    harness(ok({}))

    await expect(updateEnvironment(SERVER, TOKEN, 'env_9', { name: 'QA' })).resolves.toEqual({
      id: 'env_9',
      name: 'QA',
      type: '',
    })
  })
})
