import { afterEach, describe, expect, it, vi } from 'vitest'
import { PASSWORD_ONLY, fetchAuthCapabilities, toAuthCapabilities } from './authCapabilities'

const SERVER = 'https://api.test.flexprice.io/v1'

/**
 * Drives the real module with a stub `fetch`, like `session.test.ts`.
 *
 * What these tests exist to pin is the *direction* this module fails in. Every
 * assertion below that expects `PASSWORD_ONLY` is guarding the same property:
 * no failure, and no malformed answer, may remove a sign-in method that works.
 * Getting that backwards does not produce a visible bug in development — it
 * produces a sign-in screen with no way in, on whichever deployment happens to
 * answer badly.
 */
function harness(respond: (request: Request) => Response | Promise<Response>) {
  const seen: Request[] = []

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as RequestInfo, init)
    seen.push(request)
    return respond(request)
  })

  return { seen }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const FULL = {
  provider: 'supabase',
  password: { enabled: true, min_length: 12 },
  signup: { enabled: false },
  password_reset: { enabled: true },
  saml: { enabled: true },
  oauth: { google: true },
}

describe('fetchAuthCapabilities', () => {
  it('asks the deployment, unauthenticated, at /auth/capabilities', async () => {
    const { seen } = harness(() => Response.json(FULL))

    await fetchAuthCapabilities(SERVER)

    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe(`${SERVER}/auth/capabilities`)
    expect(seen[0]?.method).toBe('GET')
    // No credentials exist yet at this point in the flow; sending one would be
    // a bug, not an optimisation.
    expect(seen[0]?.headers.get('authorization')).toBeNull()
  })

  it('tolerates a trailing slash on the server URL', async () => {
    const { seen } = harness(() => Response.json(FULL))

    await fetchAuthCapabilities(`${SERVER}/`)

    expect(seen[0]?.url).toBe(`${SERVER}/auth/capabilities`)
  })

  it('reports what the deployment answers', async () => {
    harness(() => Response.json(FULL))

    await expect(fetchAuthCapabilities(SERVER)).resolves.toEqual({
      provider: 'supabase',
      password: { enabled: true, minLength: 12 },
      signUp: { enabled: false },
      passwordReset: { enabled: true },
      saml: { enabled: true },
      oauth: { google: true },
    })
  })

  // Each of these is a real deployment state, not a hypothetical: a backend
  // that predates the endpoint answers 404, a load balancer answers HTML 502,
  // and a cross-origin console with no CORS entry rejects before any status.
  it.each([
    ['a 404 from a backend without the endpoint', () => new Response('', { status: 404 })],
    ['a 500', () => new Response('', { status: 500 })],
    ['an HTML error page', () => new Response('<html>502</html>', { status: 502 })],
    [
      'a 200 whose body is not JSON',
      () => new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }),
    ],
    [
      'a transport failure',
      () => {
        throw new TypeError('Failed to fetch')
      },
    ],
  ])('falls back to password-only on %s', async (_label, respond) => {
    harness(respond as () => Response)

    await expect(fetchAuthCapabilities(SERVER)).resolves.toEqual(PASSWORD_ONLY)
  })

  it('never rejects', async () => {
    harness(() => {
      throw new Error('boom')
    })

    // The whole sign-in screen is built on this promise resolving.
    await expect(fetchAuthCapabilities(SERVER)).resolves.toBeDefined()
  })
})

describe('toAuthCapabilities', () => {
  it('defaults an absent section rather than switching it off', () => {
    // An older or partial backend must not read as "signup is disabled".
    expect(toAuthCapabilities({ provider: 'flexprice' })).toEqual(PASSWORD_ONLY)
  })

  it.each([[null], [undefined], ['a string'], [42], [[]]])(
    'reads %p as password-only',
    (body) => {
      expect(toAuthCapabilities(body)).toEqual(PASSWORD_ONLY)
    },
  )

  it('ignores an unrecognised provider instead of trusting it', () => {
    expect(toAuthCapabilities({ provider: 'okta' }).provider).toBe(PASSWORD_ONLY.provider)
  })

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 8.5],
    ['absurd', 1024],
    ['a string', '8'],
  ])('ignores %s min_length and keeps the API minimum', (_label, value) => {
    // A bad minimum from the server must not make the form reject every
    // password a user can type — it would lock out the whole deployment.
    expect(toAuthCapabilities({ password: { min_length: value } }).password.minLength).toBe(8)
  })

  it('honours a real min_length', () => {
    expect(toAuthCapabilities({ password: { min_length: 16 } }).password.minLength).toBe(16)
  })
})
