import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, ErrorKind } from './errors'
import {
  SettingKey,
  deleteSetting,
  fetchTenantBilling,
  fetchWebhookDashboard,
  getSetting,
  putSetting,
} from './settings'

const SERVER = 'https://api.test.flexprice.io/v1'
const TOKEN = 'jwt-abc'
const ENV = 'env_01TEST'

/**
 * Drives the real module with a stub `fetch`, exactly as `session.test.ts`
 * does — these routes have no SDK to drive, so the global `fetch` the module
 * calls is the seam.
 *
 * Requests are recorded as `Request` objects so a `Headers` instance can
 * answer "was the environment sent?" without the test having to know whether
 * the module passed a literal, an array of pairs or a `Headers` to `fetch`.
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

function failure(status: number, body: unknown, statusText?: string): () => Response {
  return () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      ...(statusText ? { statusText } : {}),
    })
}

/** The envelope every settings route answers with. */
function envelope(key: string, value: unknown, extra: Record<string, unknown> = {}) {
  return {
    id: '',
    key,
    value,
    environment_id: '',
    tenant_id: '',
    status: '',
    created_at: '0001-01-01T00:00:00Z',
    updated_at: '0001-01-01T00:00:00Z',
    created_by: '',
    updated_by: '',
    ...extra,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request shape', () => {
  it('sends the token and the environment on every settings call', async () => {
    const { seen } = harness(ok(envelope('invoice_config', { prefix: 'INV' })))

    await getSetting(SERVER, TOKEN, ENV, SettingKey.InvoiceConfig)

    expect(seen[0]?.method).toBe('GET')
    expect(seen[0]?.url).toBe(`${SERVER}/settings/invoice_config`)
    expect(seen[0]?.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`)
    expect(seen[0]?.headers.get('X-Environment-ID')).toBe(ENV)
  })

  /**
   * The environment is not optional, and the failure is worth being specific
   * about: the API answers a missing header with a 403 reading "Access
   * denied", which describes a console that has not finished choosing an
   * environment as a permissions problem the user cannot fix.
   */
  it('refuses to send a settings request with no environment', async () => {
    const { seen } = harness()

    await expect(getSetting(SERVER, TOKEN, '', SettingKey.InvoiceConfig)).rejects.toMatchObject({
      kind: ErrorKind.Forbidden,
      message: expect.stringContaining('environment'),
    })
    expect(seen).toHaveLength(0)
  })

  it('trims a trailing slash off the server URL rather than doubling it', async () => {
    const { seen } = harness(ok(envelope('invoice_config', {})))

    await getSetting(`${SERVER}/`, TOKEN, ENV, SettingKey.InvoiceConfig)

    expect(seen[0]?.url).toBe(`${SERVER}/settings/invoice_config`)
  })
})

describe('getSetting', () => {
  it('returns the envelope’s value and nothing else', async () => {
    harness(
      ok(
        envelope('subscription_config', { auto_cancellation_enabled: false, grace_period_days: 3 }),
      ),
    )

    await expect(getSetting(SERVER, TOKEN, ENV, SettingKey.SubscriptionConfig)).resolves.toEqual({
      auto_cancellation_enabled: false,
      grace_period_days: 3,
    })
  })

  /**
   * A defaulted key and a stored one are indistinguishable, on purpose.
   *
   * The envelope's `id` is empty on a key that has never been written — and,
   * verified live, intermittently empty on one that has, because replicas
   * disagree about their caches while the value stays consistent. Dropping the
   * envelope here is what stops a screen being built on that field.
   */
  it('reads a stored setting the same way as a defaulted one', async () => {
    harness(
      ok(
        envelope(
          'subscription_config',
          { grace_period_days: 4 },
          { id: 'setting_01', status: 'published' },
        ),
      ),
    )

    await expect(getSetting(SERVER, TOKEN, ENV, SettingKey.SubscriptionConfig)).resolves.toEqual({
      grace_period_days: 4,
    })
  })

  it('passes a body through unchanged when it carries no envelope', async () => {
    harness(ok({ prefix: 'INV' }))

    await expect(getSetting(SERVER, TOKEN, ENV, SettingKey.InvoiceConfig)).resolves.toEqual({
      prefix: 'INV',
    })
  })
})

describe('putSetting', () => {
  it('wraps the value in the envelope the API expects', async () => {
    const { seen } = harness(ok(envelope('subscription_config', { grace_period_days: 4 })))

    await putSetting(SERVER, TOKEN, ENV, SettingKey.SubscriptionConfig, { grace_period_days: 4 })

    expect(seen[0]?.method).toBe('PUT')
    await expect(seen[0]?.json()).resolves.toEqual({ value: { grace_period_days: 4 } })
  })

  /**
   * The response is the answer, not the request.
   *
   * The server normalises what it is given — it lowercases currency codes,
   * coerces an empty threshold type to absolute — and an immediate re-read can
   * be served by a replica that has not seen the write. The write's own
   * response is the only value here that is both current and normalised.
   */
  it('returns what the server saved, not what was sent', async () => {
    harness(ok(envelope('custom_currency_config', { default_fiat_currency: 'usd' })))

    await expect(
      putSetting(SERVER, TOKEN, ENV, SettingKey.CustomCurrencyConfig, {
        default_fiat_currency: 'USD',
      }),
    ).resolves.toEqual({ default_fiat_currency: 'usd' })
  })
})

describe('deleteSetting', () => {
  it('deletes the stored row and reports nothing', async () => {
    // 204, with no body at all — the shape a `Response` refuses to build from
    // an empty string, and the shape this route actually answers with.
    const { seen } = harness(() => new Response(null, { status: 204 }))

    await expect(
      deleteSetting(SERVER, TOKEN, ENV, SettingKey.InvoiceConfig),
    ).resolves.toBeUndefined()
    expect(seen[0]?.method).toBe('DELETE')
  })

  /**
   * A 404 is reported, not swallowed.
   *
   * "Nothing stored means the reset already succeeded" is a statement about
   * the reset flow, and it belongs in the hook that performs one. This layer
   * says what the API said.
   */
  it('reports a 404 rather than deciding it was a success', async () => {
    harness(failure(404, { code: 'not_found', message: 'setting not found' }))

    await expect(deleteSetting(SERVER, TOKEN, ENV, SettingKey.InvoiceConfig)).rejects.toMatchObject(
      {
        kind: ErrorKind.NotFound,
      },
    )
  })
})

describe('failure bodies', () => {
  /**
   * These handlers answer with three different envelopes, and the useful
   * sentence is in a different place in each. `readErrorBody` alone finds it
   * in only one of them, so a flat `message` is preferred here — otherwise the
   * user is shown an HTTP status text instead of "SAML single sign-on is not
   * available on this deployment".
   */
  it.each([
    [
      'the flat not-found shape SAML answers with',
      404,
      { code: 'not_found', message: 'SAML single sign-on is not available on this deployment' },
      ErrorKind.NotFound,
      'SAML single sign-on is not available on this deployment',
    ],
    [
      'the access-denied shape, where `error` is a string',
      403,
      { error: 'Access denied', message: 'Invalid or inaccessible environment' },
      ErrorKind.Forbidden,
      'Invalid or inaccessible environment',
    ],
    [
      'the documented envelope the rest of the API uses',
      400,
      { success: false, error: { message: 'grace_period_days must be positive' } },
      ErrorKind.Invalid,
      'grace_period_days must be positive',
    ],
  ])('reads the message out of %s', async (_name, status, body, kind, message) => {
    harness(failure(status, body))

    await expect(getSetting(SERVER, TOKEN, ENV, SettingKey.SamlConfig)).rejects.toMatchObject({
      kind,
      status,
      message,
    })
  })

  it('falls back to the status text when the body is not JSON at all', async () => {
    harness(failure(502, '<html>Bad Gateway</html>', 'Bad Gateway'))

    await expect(getSetting(SERVER, TOKEN, ENV, SettingKey.InvoiceConfig)).rejects.toMatchObject({
      kind: ErrorKind.Server,
      message: 'Bad Gateway',
    })
  })

  it('reports a transport failure as a network error, with no status to guess at', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })

    const error = await getSetting(SERVER, TOKEN, ENV, SettingKey.InvoiceConfig).catch(
      (cause: unknown) => cause,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: ErrorKind.Network, status: undefined })
  })
})

describe('fetchWebhookDashboard', () => {
  it('reads the portal handoff', async () => {
    harness(
      ok({
        app_id: 'tenant_1_env_1',
        svix_enabled: true,
        token: 'svix-token',
        url: 'https://app.svix.com/login#key=abc',
      }),
    )

    await expect(fetchWebhookDashboard(SERVER, TOKEN, ENV)).resolves.toEqual({
      appId: 'tenant_1_env_1',
      svixEnabled: true,
      token: 'svix-token',
      url: 'https://app.svix.com/login#key=abc',
    })
  })

  /**
   * A deployment without webhooks is an answer, not a failure: `svix_enabled`
   * comes back false with the other fields empty, and a caller renders an
   * unavailable state rather than an iframe pointed at nothing.
   */
  it('reports a deployment with webhooks switched off', async () => {
    harness(ok({ svix_enabled: false }))

    await expect(fetchWebhookDashboard(SERVER, TOKEN, ENV)).resolves.toEqual({
      appId: '',
      svixEnabled: false,
      token: '',
      url: '',
    })
  })

  it('treats a missing `svix_enabled` as off rather than as enabled', async () => {
    harness(ok({ app_id: 'a' }))

    await expect(fetchWebhookDashboard(SERVER, TOKEN, ENV)).resolves.toMatchObject({
      svixEnabled: false,
    })
  })
})

describe('fetchTenantBilling', () => {
  /**
   * The whole reason this function exists: the SDK asks for `/tenant/billing`
   * and gets a 404 from a route that does not exist. The `s` is the fix.
   */
  it('calls the plural path the API actually serves', async () => {
    const { seen } = harness(ok({ subscriptions: [], usage: null }))

    await fetchTenantBilling(SERVER, TOKEN, ENV)

    expect(seen[0]?.url).toBe(`${SERVER}/tenants/billing`)
    expect(seen[0]?.headers.get('X-Environment-ID')).toBe(ENV)
  })

  it('returns the raw body for the mapper above it to normalise', async () => {
    harness(ok({ subscriptions: [{ id: 'subs_1' }], usage: { customer_id: 'cust_1' } }))

    await expect(fetchTenantBilling(SERVER, TOKEN, ENV)).resolves.toEqual({
      subscriptions: [{ id: 'subs_1' }],
      usage: { customer_id: 'cust_1' },
    })
  })
})
