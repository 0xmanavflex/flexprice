import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as ReactQuery from '@tanstack/react-query'
import {
  AlertCondition,
  AlertThresholdType,
  OnboardingAction,
  OnboardingWalletType,
} from '@fp/domain'
import { queryKeys } from './keys'

/**
 * The settings hooks and their mappers, without a browser.
 *
 * The same harness `session.test.ts` explains at length: this package's vitest
 * environment is `node` and it has no renderer, so the three functions that
 * need React: `useQuery`, `useMutation`, `useQueryClient`: are recorders and
 * everything else is the real thing. What a hook *configures* is what is under
 * test, and it is where these bugs live: a key that forgets the environment, a
 * guard that lets a request fire with no environment to send, a reset that
 * turns "nothing was stored" into an error.
 *
 * Calling a hook outside a render is what `react-hooks/rules-of-hooks` exists
 * to prevent, and it is safe here for the reason the rule is not: React's
 * call-ordering invariant needs a React, and there is none in this process.
 *
 * The network edge is a stubbed global `fetch`, because `@fp/api`'s settings
 * module speaks `fetch` directly: these routes have no SDK.
 */

const SERVER = 'https://api.test.flexprice.io/v1'
const ENV = 'env_sandbox'
const TOKEN = 'jwt-abc'

interface RecordedQuery {
  queryKey: readonly unknown[]
  queryFn: () => Promise<unknown>
  enabled?: boolean
  staleTime?: number
  gcTime?: number
  retry?: boolean
}

interface RecordedMutation {
  mutationFn: (variables: never) => Promise<unknown>
  onSuccess?: (data: unknown) => void
}

const recorded = vi.hoisted(() => ({
  queries: [] as RecordedQuery[],
  mutations: [] as RecordedMutation[],
  cached: [] as { key: unknown; value: unknown }[],
  invalidated: [] as { key: unknown; refetchType?: string | undefined }[],
}))

vi.mock('./provider', () => ({
  useFlexpriceServerURL: () => SERVER,
  useFlexpriceAuth: () => ({
    getToken: async () => TOKEN,
    getEnvironmentId: async () => ENV,
  }),
}))

vi.mock('@tanstack/react-query', () => {
  const useQuery = (options: RecordedQuery) => {
    recorded.queries.push(options)
    return { data: undefined, status: 'pending' }
  }
  const useMutation = (options: RecordedMutation) => {
    recorded.mutations.push(options)
    return { mutate: () => undefined }
  }
  const useQueryClient = () => ({
    setQueryData: (key: unknown, value: unknown) => recorded.cached.push({ key, value }),
    invalidateQueries: (filters: { queryKey: unknown; refetchType?: string }) => {
      recorded.invalidated.push({ key: filters.queryKey, refetchType: filters.refetchType })
      return Promise.resolve()
    },
  })
  return { useQuery, useMutation, useQueryClient } as unknown as typeof ReactQuery
})

import {
  toCustomCurrencyConfig,
  toCustomCurrencyConfigRequest,
  toCustomerOnboarding,
  toCustomerOnboardingRequest,
  toCustomerPortalConfig,
  toCustomerPortalConfigRequest,
  toInvoiceConfig,
  toInvoiceConfigRequest,
  toSamlConfig,
  toSubscriptionConfig,
  toWalletAlertConfig,
  toWalletAlertConfigRequest,
  useCustomerPortalConfig,
  useInvoiceConfig,
  useResetInvoiceConfig,
  useSamlConfig,
  useUpdateInvoiceConfig,
  useWebhookDashboard,
  toTaxConfig,
  toTaxConfigRequest,
} from './settings'

function lastQuery(): RecordedQuery {
  const options = recorded.queries.at(-1)
  if (!options) throw new Error('The hook did not configure a query.')
  return options
}

function lastMutation(): RecordedMutation {
  const options = recorded.mutations.at(-1)
  if (!options) throw new Error('The hook did not configure a mutation.')
  return options
}

/** A stubbed `fetch` that records requests and answers from a queue. */
function stubFetch(...responses: (() => Response)[]) {
  const seen: Request[] = []
  let at = 0

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input as RequestInfo, init))
    const respond = responses[Math.min(at, responses.length - 1)]
    at += 1
    if (!respond) throw new Error('The test ran out of stubbed responses.')
    return respond()
  })

  return seen
}

function value(body: unknown, status = 200): () => Response {
  return () =>
    new Response(JSON.stringify({ id: '', key: 'k', value: body }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
}

function failure(status: number, message = 'nope'): () => Response {
  return () => new Response(JSON.stringify({ code: 'error', message }), { status })
}

afterEach(() => {
  recorded.queries.length = 0
  recorded.mutations.length = 0
  recorded.cached.length = 0
  recorded.invalidated.length = 0
  vi.unstubAllGlobals()
})

/* -------------------------------- mappers -------------------------------- */

describe('toInvoiceConfig', () => {
  it('reads the live default body', () => {
    expect(
      toInvoiceConfig({
        due_date_days: 1,
        finalization_delay_seconds: 7200,
        format: 'YYYYMM',
        prefix: 'INV',
        separator: '-',
        start_sequence: 1,
        suffix_length: 5,
        timezone: 'UTC',
      }),
    ).toEqual({
      prefix: 'INV',
      separator: '-',
      format: 'YYYYMM',
      timezone: 'UTC',
      startSequence: 1,
      suffixLength: 5,
      dueDateDays: 1,
      finalizationDelaySeconds: 7200,
      // Omitted by the API while false, which is how it arrives here.
      autoCompletePurchasedCreditTransaction: false,
    })
  })

  /**
   * An empty separator is a style (INV2026090001), not a missing field.
   * Defaulting it back to "-" would undo the choice on the next save.
   */
  it('keeps an empty separator instead of defaulting it back', () => {
    expect(toInvoiceConfig({ separator: '' }).separator).toBe('')
  })

  it('falls back to the backend’s defaults for anything absent', () => {
    expect(toInvoiceConfig({})).toMatchObject({ prefix: 'INV', suffixLength: 5 })
  })

  it('survives a body that is not an object at all', () => {
    expect(toInvoiceConfig(null)).toMatchObject({ prefix: 'INV' })
  })

  it('round-trips through the request shape in snake_case', () => {
    const wire = toInvoiceConfigRequest(toInvoiceConfig({ prefix: 'ACME', separator: '' }))

    expect(wire).toMatchObject({ prefix: 'ACME', separator: '', suffix_length: 5 })
    expect(wire).toHaveProperty('auto_complete_purchased_credit_transaction', false)
  })
})

describe('toSubscriptionConfig', () => {
  it('reads the live body', () => {
    expect(
      toSubscriptionConfig({ auto_cancellation_enabled: false, grace_period_days: 3 }),
    ).toEqual({ autoCancellationEnabled: false, gracePeriodDays: 3 })
  })
})

describe('toCustomCurrencyConfig', () => {
  it('reads the empty default', () => {
    expect(toCustomCurrencyConfig({ custom_currencies: {}, default_fiat_currency: '' })).toEqual({
      customCurrencies: {},
      defaultFiatCurrency: '',
    })
  })

  /**
   * Rates are decimal strings on the wire, but a legacy or hand-written value
   * can arrive as a number. Parsing to a float and reformatting would lose
   * precision; `String()` on the number does not.
   */
  it('keeps a numeric rate as a string rather than a float', () => {
    const config = toCustomCurrencyConfig({
      default_fiat_currency: 'usd',
      custom_currencies: {
        crd: { name: 'Credits', symbol: 'C', fiat_conversion_factors: { usd: 0.01 } },
      },
    })

    expect(config.customCurrencies['crd']?.fiatConversionFactors['usd']).toBe('0.01')
  })

  it('round-trips to snake_case', () => {
    const wire = toCustomCurrencyConfigRequest({
      defaultFiatCurrency: 'usd',
      customCurrencies: {
        crd: { name: 'Credits', symbol: 'C', fiatConversionFactors: { usd: '0.01' } },
      },
    })

    expect(wire).toEqual({
      default_fiat_currency: 'usd',
      custom_currencies: {
        crd: { name: 'Credits', symbol: 'C', fiat_conversion_factors: { usd: '0.01' } },
      },
    })
  })
})

describe('toCustomerPortalConfig', () => {
  const live = {
    version: '1.0',
    theme: {},
    sections: [
      {
        enabled: true,
        id: 'usage',
        label: 'Usage',
        order: 1,
        tabs: [
          {
            enabled: true,
            id: '1',
            order: 1,
            type: 'metric_cards',
            metric_cards: {
              show_cost_metrics: false,
              show_custom_metrics: true,
              show_revenue_metric: true,
            },
          },
          {
            enabled: true,
            id: '2',
            order: 2,
            type: 'usage_graph',
            usage_graph: {
              allow_custom_date_range: true,
              date_presets: ['today', 'last_7_days'],
              default_preset: 'last_7_days',
              feature_filter_mode: 'inc',
            },
          },
        ],
      },
    ],
  }

  it('reads the tree the API sends, nesting and all', () => {
    const config = toCustomerPortalConfig(live)

    expect(config.version).toBe('1.0')
    expect(config.sections[0]?.tabs[0]?.metricCards).toEqual({
      showCostMetrics: false,
      showCustomMetrics: true,
      showRevenueMetric: true,
    })
    expect(config.sections[0]?.tabs[1]?.usageGraph).toEqual({
      allowCustomDateRange: true,
      datePresets: ['today', 'last_7_days'],
      defaultPreset: 'last_7_days',
      // Kept as sent. The live default stores "inc", which matches none of
      // V1's three declared filter modes.
      featureFilterMode: 'inc',
    })
  })

  it('gives a tab without a payload a null rather than an invented block', () => {
    const config = toCustomerPortalConfig({
      sections: [{ id: 's', tabs: [{ id: '1', type: 'invoices' }] }],
    })

    expect(config.sections[0]?.tabs[0]).toMatchObject({ metricCards: null, usageGraph: null })
  })

  /**
   * The point of modelling the whole tree: what comes back must be what goes
   * out. A projection down to a handful of booleans is a deletion of every
   * label, ordering and preset the portal was configured with.
   */
  it('writes back exactly what it read', () => {
    expect(toCustomerPortalConfigRequest(toCustomerPortalConfig(live))).toEqual({
      ...live,
      // The only difference: an empty theme arrives as `{}` and leaves as
      // three empty strings, which the backend stores identically.
      theme: { primary_color: '', secondary_color: '', tertiary_color: '' },
    })
  })

  it('round-trips the usage properties and leaves them out when never set', () => {
    const stored = {
      ...live,
      analytics_config: {
        usage_properties: { enabled: true, allowed_keys: ['region'], hidden_keys: ['secret'] },
      },
    }
    const config = toCustomerPortalConfig(stored)
    expect(config.usageProperties).toEqual({
      enabled: true,
      allowedKeys: ['region'],
      hiddenKeys: ['secret'],
    })
    expect(toCustomerPortalConfigRequest(config)['analytics_config']).toEqual(
      stored.analytics_config,
    )
    // Never set: omitted, so the write's top-level merge keeps whatever is stored.
    expect(toCustomerPortalConfigRequest(toCustomerPortalConfig(live))).not.toHaveProperty(
      'analytics_config',
    )
  })

  it('omits a payload block a tab never had, rather than sending nulls', () => {
    const wire = toCustomerPortalConfigRequest(
      toCustomerPortalConfig({ sections: [{ id: 's', tabs: [{ id: '1', type: 'invoices' }] }] }),
    )
    const tab = (wire['sections'] as { tabs: Record<string, unknown>[] }[])[0]?.tabs[0]

    expect(tab).not.toHaveProperty('metric_cards')
    expect(tab).not.toHaveProperty('usage_graph')
  })
})

describe('toCustomerOnboarding', () => {
  it('reads the empty default', () => {
    expect(toCustomerOnboarding({ actions: [], workflow_type: 'customer_onboarding' })).toEqual({
      workflowType: 'customer_onboarding',
      actions: [],
    })
  })

  it('reads a wallet step, keeping its amounts as strings', () => {
    const config = toCustomerOnboarding({
      workflow_type: 'customer_onboarding',
      actions: [
        {
          action: 'create_wallet',
          currency: 'USD',
          conversion_rate: '1',
          initial_credits_to_load: '100',
          initial_credits_expiration_duration: 30,
          initial_credits_expiration_duration_unit: 'DAY',
        },
      ],
    })

    expect(config.actions[0]).toEqual({
      action: OnboardingAction.CreateWallet,
      currency: 'USD',
      conversionRate: '1',
      // Defaulted, as the backend does, rather than left blank.
      walletType: OnboardingWalletType.PrePaid,
      initialCreditsToLoad: '100',
      initialCreditsExpirationDuration: 30,
      initialCreditsExpirationDurationUnit: 'DAY',
    })
  })

  /**
   * The backend unmarshals this list as a closed union: an unrecognised
   * `action` fails the whole PUT. Dropping it here would silently delete a
   * step from someone's workflow on the next save; carrying it blindly would
   * fail a save the user cannot connect to anything they touched.
   */
  it('refuses a step it cannot name, instead of dropping it', () => {
    expect(() => toCustomerOnboarding({ actions: [{ action: 'summon_the_kraken' }] })).toThrowError(
      /summon_the_kraken/,
    )
  })

  it('refuses a step with no action at all', () => {
    expect(() => toCustomerOnboarding({ actions: [{}] })).toThrowError(/no action/)
  })

  it('round-trips a subscription step, omitting what was never set', () => {
    const wire = toCustomerOnboardingRequest(
      toCustomerOnboarding({
        workflow_type: 'customer_onboarding',
        actions: [{ action: 'create_subscription', plan_id: 'plan_1' }],
      }),
    )
    const action = (wire['actions'] as Record<string, unknown>[])[0]

    expect(action).toEqual({ action: 'create_subscription', plan_id: 'plan_1' })
  })

  it('keeps a start date as the string it arrived as, offset intact', () => {
    const config = toCustomerOnboarding({
      actions: [
        { action: 'create_subscription', plan_id: 'p', start_date: '2026-09-29T00:00:00+05:30' },
      ],
    })

    expect(config.actions[0]).toMatchObject({ startDate: '2026-09-29T00:00:00+05:30' })
  })
})

describe('toWalletAlertConfig', () => {
  it('reads the live default', () => {
    expect(
      toWalletAlertConfig({
        alert_enabled: false,
        alert_threshold_type: 'absolute',
        critical: { condition: 'below', threshold: '0' },
        info: null,
        warning: null,
      }),
    ).toEqual({
      alertEnabled: false,
      thresholdType: AlertThresholdType.Absolute,
      info: null,
      warning: null,
      critical: { condition: AlertCondition.Below, threshold: '0' },
    })
  })

  it('coerces an empty threshold type to absolute, as the backend does', () => {
    expect(toWalletAlertConfig({ alert_threshold_type: '' }).thresholdType).toBe(
      AlertThresholdType.Absolute,
    )
  })

  /**
   * Nulls are sent, not omitted: `PUT` merges the top level, so an omitted
   * `warning` leaves the stored one in place and "I turned that off" does
   * nothing.
   */
  it('sends a cleared severity as an explicit null', () => {
    expect(
      toWalletAlertConfigRequest({
        alertEnabled: true,
        thresholdType: AlertThresholdType.Percentage,
        info: null,
        warning: null,
        critical: { condition: AlertCondition.Below, threshold: '10' },
      }),
    ).toEqual({
      alert_enabled: true,
      alert_threshold_type: 'percentage',
      info: null,
      warning: null,
      critical: { condition: 'below', threshold: '10' },
    })
  })
})

describe('toSamlConfig', () => {
  it('reads a configuration, approval flag included', () => {
    expect(
      toSamlConfig({
        enabled: true,
        idp_entity_id: 'e',
        idp_sso_url: 'https://idp/sso',
        idp_certificate: 'cert',
        email_attribute: 'email',
        default_role: 'all_writer',
        active: true,
        enforce_sso: true,
      }),
    ).toEqual({
      enabled: true,
      idpEntityId: 'e',
      idpSsoUrl: 'https://idp/sso',
      idpCertificate: 'cert',
      emailAttribute: 'email',
      defaultRole: 'all_writer',
      active: true,
      enforceSso: true,
    })
  })

  it('drops a role the provisioner may not grant', () => {
    expect(toSamlConfig({ default_role: 'super_admin' }).defaultRole).toBe('')
  })
})

/* --------------------------------- hooks --------------------------------- */

describe('useInvoiceConfig', () => {
  it('keys the entry by environment and settings key', () => {
    useInvoiceConfig(ENV)

    expect(lastQuery().queryKey).toEqual(queryKeys.settings.detail(ENV, 'invoice_config'))
  })

  /**
   * Two environments must not share an entry. Invalidating on a switch is not
   * enough: invalidation marks an entry stale, it does not remove it, so a
   * settings screen mounted after a switch renders the previous environment's
   * configuration while the refetch is in flight: into a form whose next
   * save writes it to the wrong environment.
   */
  it('gives two environments two different entries', () => {
    useInvoiceConfig('env_a')
    const first = lastQuery().queryKey
    useInvoiceConfig('env_b')

    expect(lastQuery().queryKey).not.toEqual(first)
  })

  it('stays under the settings prefix, so one invalidation covers them all', () => {
    useInvoiceConfig(ENV)

    const prefix = queryKeys.settings.all()
    expect(lastQuery().queryKey.slice(0, prefix.length)).toEqual([...prefix])
  })

  it.each([
    ['no environment yet', null],
    ['an empty environment id', ''],
  ])('does not fire with %s', (_name, environmentId) => {
    useInvoiceConfig(environmentId)

    expect(lastQuery().enabled).toBe(false)
  })

  it('fires once an environment is chosen', () => {
    useInvoiceConfig(ENV)

    expect(lastQuery().enabled).toBe(true)
  })

  it('sends the token and the environment, and reads the envelope’s value', async () => {
    const seen = stubFetch(value({ prefix: 'ACME' }))
    useInvoiceConfig(ENV)

    await expect(lastQuery().queryFn()).resolves.toMatchObject({ prefix: 'ACME' })

    expect(seen[0]?.url).toBe(`${SERVER}/settings/invoice_config`)
    expect(seen[0]?.headers.get('X-Environment-ID')).toBe(ENV)
    expect(seen[0]?.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`)
  })
})

describe('useUpdateInvoiceConfig', () => {
  it('PUTs the whole record, wrapped in the envelope', async () => {
    const seen = stubFetch(value({ prefix: 'ACME' }))
    useUpdateInvoiceConfig(ENV)

    await lastMutation().mutationFn(toInvoiceConfig({ prefix: 'ACME' }) as never)

    expect(seen[0]?.method).toBe('PUT')
    const body = (await seen[0]?.json()) as { value: Record<string, unknown> }
    expect(body.value).toMatchObject({ prefix: 'ACME', suffix_length: 5 })
  })

  /**
   * Seed the cache from the response, then mark the entry stale *without*
   * refetching. A GET issued immediately after a PUT can be served by a
   * replica that has not seen the write: verified live, a PUT of
   * `grace_period_days: 4` followed by a GET answering 3: so an invalidation
   * that refetches at once can replace the saved value with the old one and
   * make a successful save look like it did nothing.
   */
  it('writes the response into the cache and invalidates without refetching', () => {
    useUpdateInvoiceConfig(ENV)
    const saved = toInvoiceConfig({ prefix: 'ACME' })

    lastMutation().onSuccess?.(saved)

    expect(recorded.cached).toEqual([
      { key: queryKeys.settings.detail(ENV, 'invoice_config'), value: saved },
    ])
    expect(recorded.invalidated).toEqual([
      { key: queryKeys.settings.detail(ENV, 'invoice_config'), refetchType: 'none' },
    ])
  })

  it('refuses to save with no environment, rather than sending a headerless write', async () => {
    const seen = stubFetch(value({}))
    useUpdateInvoiceConfig(null)

    await expect(lastMutation().mutationFn(toInvoiceConfig({}) as never)).rejects.toMatchObject({
      kind: 'forbidden',
    })
    expect(seen).toHaveLength(0)
  })
})

describe('useResetInvoiceConfig', () => {
  it('deletes the stored row, then reads back what the server now says', async () => {
    const seen = stubFetch(() => new Response(null, { status: 204 }), value({ prefix: 'INV' }))
    useResetInvoiceConfig(ENV)

    await expect(lastMutation().mutationFn(undefined as never)).resolves.toMatchObject({
      prefix: 'INV',
    })

    expect(seen.map((request) => request.method)).toEqual(['DELETE', 'GET'])
  })

  /**
   * A 404 on the delete means there was no stored row: this environment was
   * already on the defaults, which is exactly what the caller asked for.
   */
  it('treats a 404 from the delete as success', async () => {
    const seen = stubFetch(failure(404, 'setting not found'), value({ prefix: 'INV' }))
    useResetInvoiceConfig(ENV)

    await expect(lastMutation().mutationFn(undefined as never)).resolves.toMatchObject({
      prefix: 'INV',
    })
    expect(seen).toHaveLength(2)
  })

  it('does not swallow a delete that failed for any other reason', async () => {
    stubFetch(failure(500, 'boom'))
    useResetInvoiceConfig(ENV)

    await expect(lastMutation().mutationFn(undefined as never)).rejects.toMatchObject({
      kind: 'server',
    })
  })
})

describe('useCustomerPortalConfig', () => {
  it('reads the tree, not a projection of it', async () => {
    stubFetch(
      value({
        version: '1.0',
        sections: [{ id: 'usage', label: 'Usage', order: 1, enabled: true, tabs: [] }],
      }),
    )
    useCustomerPortalConfig(ENV)

    await expect(lastQuery().queryFn()).resolves.toMatchObject({
      version: '1.0',
      sections: [{ id: 'usage', label: 'Usage' }],
    })
  })
})

describe('useSamlConfig', () => {
  it('reports a configuration when the deployment has SSO', async () => {
    stubFetch(value({ enabled: true, idp_entity_id: 'e', active: true }))
    useSamlConfig(ENV)

    await expect(lastQuery().queryFn()).resolves.toMatchObject({
      available: true,
      config: { enabled: true, idpEntityId: 'e', active: true },
    })
  })

  /**
   * **Any** read failure means unavailable, not just the 404 the hosted
   * deployment answers. If a 500 rendered the form with its defaults, the
   * screen would be indistinguishable from a tenant that has never configured
   * SSO: and pressing Save would overwrite a live SAML configuration with
   * empty strings, locking every user of that tenant out of the console.
   */
  it.each([
    [
      'the 404 a deployment without SSO answers',
      failure(404, 'SAML single sign-on is not available'),
    ],
    ['a 500 from a handler that broke', failure(500, 'boom')],
    ['a 403 from a reader without permission', failure(403, 'Access denied')],
  ])('reports unavailable on %s', async (_name, respond) => {
    stubFetch(respond)
    useSamlConfig(ENV)

    await expect(lastQuery().queryFn()).resolves.toMatchObject({ available: false })
  })

  it('reports unavailable when the network is gone, too', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    useSamlConfig(ENV)

    await expect(lastQuery().queryFn()).resolves.toMatchObject({ available: false })
  })

  it('does not retry, because a failure is already the answer', () => {
    useSamlConfig(ENV)

    expect(lastQuery().retry).toBe(false)
  })
})

describe('useWebhookDashboard', () => {
  it('keys by environment, under the settings prefix', () => {
    useWebhookDashboard(ENV)

    expect(lastQuery().queryKey).toEqual(queryKeys.settings.webhookDashboard(ENV))
  })

  /**
   * The response holds a Svix app token and a one-time sign-in URL. A short
   * `gcTime` keeps a credential from sitting in the query cache for the rest
   * of the session, and `staleTime: 0` means a screen that comes back asks for
   * a fresh link rather than replaying a spent one.
   */
  it('keeps the credential in memory for as little time as it can', () => {
    useWebhookDashboard(ENV)

    expect(lastQuery().staleTime).toBe(0)
    expect(lastQuery().gcTime).toBe(60_000)
  })

  it('never puts the token in the cache key', () => {
    useWebhookDashboard(ENV)

    expect(JSON.stringify(lastQuery().queryKey)).not.toContain(TOKEN)
  })

  it('does not fire without an environment', () => {
    useWebhookDashboard(null)

    expect(lastQuery().enabled).toBe(false)
  })
})

describe('tax_config', () => {
  it('reads a never-saved key as the native engine, off', () => {
    expect(toTaxConfig({})).toEqual({ enabled: false, provider: '' })
  })
  it('reads Stripe Tax, and an unknown engine as native', () => {
    expect(toTaxConfig({ enabled: true, provider: 'stripe' })).toEqual({
      enabled: true,
      provider: 'stripe',
    })
    expect(toTaxConfig({ enabled: true, provider: 'avalara' })).toEqual({
      enabled: true,
      provider: '',
    })
  })
  it('always sends both fields', () => {
    expect(toTaxConfigRequest({ enabled: false, provider: '' })).toEqual({
      enabled: false,
      provider: '',
    })
  })
})
