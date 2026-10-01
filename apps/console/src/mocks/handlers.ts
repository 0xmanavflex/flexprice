import { http, HttpResponse } from 'msw'
import { type Corpus, corpus } from '@fp/query/fixtures'

/**
 * Mock handlers over the captured-and-expanded corpus.
 *
 * These are not stubs that return a fixed array. They implement the paging,
 * sorting and filtering the real endpoints implement, because a grid that
 * always receives the same twenty-five rows cannot demonstrate pagination,
 * cannot show an empty state, and will hide an off-by-one in an offset
 * calculation until production.
 *
 * Everything served here descends from a real API response — same keys, same
 * nesting, same optional-field absences. A mock that gets the *shape* wrong is
 * worse than no mock, because it produces confident, incorrect screens.
 */

const BASE = '*/v1'

/** The filter body the /search endpoints accept, narrowed to what we honour. */
interface SearchBody {
  limit?: number
  offset?: number
  sort?: { field: string; direction: 'asc' | 'desc' }[]
  invoice_status?: string[]
  invoiceStatus?: string[]
  /** A single catalogue status (published/archived) — how the count queries filter. */
  status?: string
  name_contains?: string
  nameContains?: string
  /**
   * The generic filter DSL. Plans, add-ons, coupons and price units have no
   * name-search field, so their search goes through this instead — see
   * `packages/query/src/search.ts`.
   */
  filters?: { field?: string; operator?: string; value?: { string?: string } }[]
  subscription_ids?: string[]
  subscriptionIds?: string[]
  feature_ids?: string[]
  featureIds?: string[]
  /** How the charges/entitlements searches scope to one plan (or add-on). */
  entity_ids?: string[]
  entityIds?: string[]
  entity_type?: string
  entityType?: string
  /** How the plan detail page's subscriptions metric scopes to one plan. */
  plan_id?: string
  planId?: string
  /** How a customer's invoices scope: the list search narrows by external id. */
  external_customer_id?: string
  externalCustomerId?: string
  expand?: string
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Applies paging, sorting and filtering, and reports the total *before* paging.
 *
 * That distinction is the one worth getting right: `pagination.total` drives
 * the grid's page count, so returning the page length here would silently cap
 * every list at one page.
 */
function page(source: Corpus, body: SearchBody) {
  let rows = [...source.items]

  const statuses = body.invoice_status ?? body.invoiceStatus
  if (statuses?.length) {
    rows = rows.filter((row) => statuses.includes(readString(row, 'invoice_status')))
  }

  // A single catalogue status, so a count query for "published" reports the real
  // published total rather than the whole corpus.
  if (body.status) {
    rows = rows.filter((row) => readString(row, 'status') === body.status)
  }

  // A name search arrives one of two ways: `name_contains` (features, which
  // have the field) or a `contains` condition in the filter DSL (plans,
  // add-ons, coupons, price units, which do not). Both are honoured so the mock
  // matches the real API rather than being laxer than it.
  const dsl = body.filters?.find(
    (condition) => condition.field === 'name' && condition.operator === 'contains',
  )
  const search = body.name_contains ?? body.nameContains ?? dsl?.value?.string
  if (search) {
    const needle = search.toLowerCase()
    rows = rows.filter((row) => readString(row, 'name').toLowerCase().includes(needle))
  }

  const subscriptionIds = body.subscription_ids ?? body.subscriptionIds
  if (subscriptionIds?.length)
    rows = rows.filter((row) => subscriptionIds.includes(readString(row, 'id')))

  const ids = body.feature_ids ?? body.featureIds
  if (ids?.length) rows = rows.filter((row) => ids.includes(readString(row, 'id')))

  // Charges and entitlements are searched by the entity they price. Scoping to
  // it here is what makes a plan's detail page show *its* charges, not the whole
  // catalogue's — the bug an unfiltered mock would hide until production.
  const entityType = body.entity_type ?? body.entityType
  if (entityType) rows = rows.filter((row) => readString(row, 'entity_type') === entityType)

  const entityIds = body.entity_ids ?? body.entityIds
  if (entityIds?.length)
    rows = rows.filter((row) => entityIds.includes(readString(row, 'entity_id')))

  // A plan's subscriptions, for the detail page's "active subscriptions" metric.
  // Scoping here is what makes the rail count *this* plan's subscribers rather
  // than the whole book — the bug an unfiltered mock would hide until production.
  const planId = body.plan_id ?? body.planId
  if (planId) rows = rows.filter((row) => readString(row, 'plan_id') === planId)

  // A customer's invoices. The real invoice search narrows by the customer's
  // external id; the corpus links invoices by internal `customer_id`, so the
  // external id is resolved to the customer first, then rows are scoped to it —
  // an unknown external id scopes to nothing rather than the whole book.
  const externalCustomerId = body.external_customer_id ?? body.externalCustomerId
  if (externalCustomerId) {
    const customer = (corpus.customers as Corpus).items.find(
      (row) => readString(row, 'external_id') === externalCustomerId,
    )
    const customerId = customer ? readString(customer, 'id') : ''
    rows = rows.filter((row) => readString(row, 'customer_id') === customerId)
  }

  const sort = body.sort?.[0]
  if (sort) {
    const { field, direction } = sort
    rows.sort((a, b) => {
      const left = readString(a, field)
      const right = readString(b, field)
      return direction === 'desc' ? right.localeCompare(left) : left.localeCompare(right)
    })
  }

  const total = rows.length
  const limit = body.limit ?? 25
  const offset = body.offset ?? 0

  return { items: rows.slice(offset, offset + limit), pagination: { total, limit, offset } }
}

/**
 * Strips the meter unless `expand` asked for it.
 *
 * Reproducing this deliberately: the real API omits the embedded meter unless
 * `expand=meters` is sent, and a mock that always includes it would have hidden
 * the bug that omission caused — which is exactly the bug the captured
 * fixtures found.
 */
function applyFeatureExpand(result: ReturnType<typeof page>, expand: string | undefined) {
  if (expand?.includes('meters')) return result
  return {
    ...result,
    items: result.items.map((row) => {
      const { meter: _meter, ...rest } = row as Record<string, unknown>
      return rest
    }),
  }
}

const search = (path: string, key: string) =>
  http.post(`${BASE}${path}`, async ({ request }) => {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as SearchBody
    if (demoEmpty()) return HttpResponse.json(emptyPage(body))
    const result = page(sourceFor(key), body)
    return HttpResponse.json(key === 'features' ? applyFeatureExpand(result, body.expand) : result)
  })

/** Finds one row in a corpus by id — the by-id GET endpoints read it. */
function byId(key: string, id: string): Record<string, unknown> | null {
  return sourceFor(key).items.find((row) => readString(row, 'id') === id) ?? null
}

/**
 * Authored coupon associations, to shape.
 *
 * The corpus has no subscriptions wired to coupons, so "Where used" would be
 * permanently empty. These rows are authored — matching `CouponAssociationResponse`
 * (snake_case, `start_date`/`end_date` as ISO, an open-ended one omitting the
 * end) — and returned only for the one coupon below, so the surface is
 * demonstrable without pretending every coupon is in use.
 */
const DEMO_ASSOCIATION_COUPON = 'coupon_01M38QAAA0000000000000001'

function couponAssociations(): Record<string, unknown>[] {
  return [
    {
      id: 'cpasc_01M38QASSOC0000000000001',
      coupon_id: DEMO_ASSOCIATION_COUPON,
      subscription_id: 'subs_01M38QSUB00000000000001',
      status: 'published',
      start_date: '2026-02-01T00:00:00Z',
    },
    {
      id: 'cpasc_01M38QASSOC0000000000002',
      coupon_id: DEMO_ASSOCIATION_COUPON,
      subscription_id: 'subs_01M38QSUB00000000000002',
      status: 'published',
      start_date: '2026-03-01T00:00:00Z',
      end_date: '2026-09-01T00:00:00Z',
    },
    {
      id: 'cpasc_01M38QASSOC0000000000003',
      coupon_id: DEMO_ASSOCIATION_COUPON,
      subscription_id: 'subs_01M38QSUB00000000000003',
      status: 'archived',
      start_date: '2025-11-01T00:00:00Z',
      end_date: '2026-01-01T00:00:00Z',
    },
  ]
}

/**
 * The environment list, served rather than hardcoded in the hook.
 *
 * `GET /environments` and `POST /environments` are absent from the OpenAPI
 * document (`docs/api-contract-gap.md`), so `@fp/api` reaches them with
 * `fetch` — but from the console's side they are ordinary endpoints, and
 * mocking them here is what lets `useEnvironments` have exactly one code path
 * instead of a `env.useMocks` branch that only the real build ever exercises.
 *
 * The shape is copied from a live response, keys and all: an `environments`
 * array beside `total`/`offset`/`limit`, `type` as the wire word
 * `development` rather than the product's "sandbox", and the timestamps the
 * API actually sends.
 *
 * Two of them, one of each kind, because the thing worth demonstrating is the
 * switch — and the default-selection rule (prefer the sandbox) has nothing to
 * choose between with a single row.
 */
const environments: Record<string, unknown>[] = [
  {
    id: 'env_01KVSNYVPMAP6JJGDF177V2DE6',
    name: 'Sandbox',
    type: 'development',
    created_at: '2026-06-23T07:26:18Z',
    updated_at: '2026-06-23T07:26:18Z',
  },
  {
    id: 'env_01M020PHF0GF9KP1E9CEVNKJA1',
    name: 'Production',
    type: 'production',
    created_at: '2026-08-15T06:10:42Z',
    updated_at: '2026-08-15T06:11:02Z',
  },
]

/*
 * ---------------------------------------------------------------------------
 * Settings.
 *
 * The capture environment had no people, roles, keys or alert rules in it, so
 * unlike the catalogue corpora these rows are **authored**. They are authored
 * to the wire shapes the generated SDK parses, not to the domain models the
 * hooks return, because MSW sits on the wire: `SecretResponse`, `TenantResponse`
 * and `AlertSettingsResponse` are snake_case and the SDK remaps them to
 * camelCase after parsing, so a camelCase mock here would arrive as a record of
 * undefineds and render a table of dashes that nothing in the type system would
 * catch. `UserResponse` is the exception — it is flat single-word keys with no
 * remapping at all, and it genuinely has **no `created_at` and no `status`**,
 * which is why the members table has no "Joined" column.
 *
 * They are also mutable: invite, rename, role change and delete all write back
 * into these arrays, so a settings screen can be used end to end under mocks
 * rather than merely looked at. Same choice as the environments handler above,
 * for the same reason — a create that only echoes leaves the list disagreeing
 * with what the screen just said happened.
 * ---------------------------------------------------------------------------
 */

const TENANT_ID = 'tenant_demo'
const TENANT_REF = { id: TENANT_ID, name: 'Northwind Systems' }

/** `UserResponse`: flat, single-word keys, no snake_case, no timestamps. */
const users: Record<string, unknown>[] = [
  {
    id: 'user_demo',
    name: 'Dana Whitfield',
    email: 'demo@flexprice.io',
    type: 'user',
    roles: ['super_admin'],
    tenant: TENANT_REF,
  },
  {
    id: 'user_01M38QUSER0000000000002',
    name: 'Amara Osei',
    email: 'amara@northwind.example',
    type: 'user',
    roles: ['all_writer'],
    tenant: TENANT_REF,
  },
  {
    id: 'user_01M38QUSER0000000000003',
    name: 'Tomas Lind',
    email: 'tomas@northwind.example',
    type: 'user',
    roles: ['all_reader', 'event_reader'],
    tenant: TENANT_REF,
  },
  {
    id: 'user_01M38QUSER0000000000004',
    name: '',
    email: 'finance@northwind.example',
    type: 'user',
    roles: ['all_reader'],
    tenant: TENANT_REF,
  },
  {
    id: 'svc_01M38QSVC00000000000001',
    name: 'usage-ingest',
    email: '',
    type: 'service_account',
    roles: ['event_ingestor'],
    tenant: TENANT_REF,
  },
  {
    id: 'svc_01M38QSVC00000000000002',
    name: 'billing-reconciler',
    email: '',
    type: 'service_account',
    roles: ['all_reader'],
    tenant: TENANT_REF,
  },
]

/**
 * `GET /rbac/roles` answers `{ roles: [...] }` — not the `{items, pagination}`
 * envelope every other list uses, and with no total. The route has no response
 * model in the OpenAPI document, so the SDK validates nothing and this shape is
 * the only contract there is. `permissions` is an object keyed by resource, not
 * an array.
 */
const roles: Record<string, unknown>[] = [
  {
    id: 'super_admin',
    name: 'Super admin',
    description: 'Every action on every resource, including managing members.',
    permissions: { '*': ['*'] },
  },
  {
    id: 'all_writer',
    name: 'Writer',
    description: 'Can read and change everything except members and roles.',
    permissions: {
      plan: ['read', 'write'],
      customer: ['read', 'write'],
      invoice: ['read', 'write'],
      subscription: ['read', 'write'],
      event: ['read', 'write'],
    },
  },
  {
    id: 'all_reader',
    name: 'Reader',
    description: 'Can see everything and change nothing.',
    permissions: {
      plan: ['read'],
      customer: ['read'],
      invoice: ['read'],
      subscription: ['read'],
      event: ['read'],
    },
  },
  {
    id: 'event_ingestor',
    name: 'Event ingestor',
    description: 'Can send usage events and nothing else. The right role for a meter.',
    permissions: { event: ['write'] },
  },
  {
    id: 'event_reader',
    name: 'Event reader',
    description: 'Can read raw usage events, to trace a bill back to what caused it.',
    permissions: { event: ['read'] },
  },
]

/**
 * A service account cannot hold every role a person can — `all_writer` is
 * filtered out of the live service-account list. Reproduced, because the Roles
 * tab renders the difference.
 */
const SERVICE_ACCOUNT_ROLE_IDS = ['super_admin', 'all_reader', 'event_ingestor', 'event_reader']

/** `SecretResponse`: snake_case on the wire. `null` means never, not unknown. */
const apiKeys: Record<string, unknown>[] = [
  {
    id: 'key_01M38QKEY00000000000001',
    name: 'Production ingest',
    display_id: 'fp_live_••••4f2a',
    type: 'private_key',
    status: 'published',
    roles: ['event_ingestor'],
    user_id: 'svc_01M38QSVC00000000000001',
    user_type: 'service_account',
    service_account_name: 'usage-ingest',
    provider: 'flexprice',
    created_at: '2026-03-04T09:12:00Z',
    updated_at: '2026-03-04T09:12:00Z',
    expires_at: null,
    last_used_at: '2026-09-28T22:41:07Z',
  },
  {
    id: 'key_01M38QKEY00000000000002',
    name: 'Pricing page',
    display_id: 'fp_pub_••••91c7',
    type: 'publishable_key',
    status: 'published',
    roles: ['all_reader'],
    user_id: 'user_demo',
    user_type: 'user',
    service_account_name: '',
    provider: 'flexprice',
    created_at: '2026-06-19T14:03:00Z',
    updated_at: '2026-06-19T14:03:00Z',
    expires_at: '2027-06-19T00:00:00Z',
    last_used_at: null,
  },
  {
    id: 'key_01M38QKEY00000000000003',
    name: 'Migration script',
    display_id: 'fp_live_••••0dd1',
    type: 'private_key',
    status: 'archived',
    roles: ['all_writer'],
    user_id: 'user_01M38QUSER0000000000002',
    user_type: 'user',
    service_account_name: '',
    provider: 'flexprice',
    created_at: '2025-11-02T08:00:00Z',
    updated_at: '2026-01-15T11:22:00Z',
    expires_at: '2026-02-01T00:00:00Z',
    last_used_at: '2026-01-14T19:55:00Z',
  },
]

/** `TenantResponse`: `billing_details`, and an address whose keys are prefixed. */
const tenant: Record<string, unknown> = {
  id: TENANT_ID,
  name: 'Northwind Systems',
  status: 'published',
  billing_details: {
    email: 'billing@northwind.example',
    help_email: 'support@northwind.example',
    phone: '+1 555 0142',
    address: {
      address_line1: '188 Harborside Way',
      address_line2: 'Floor 4',
      address_city: 'Portland',
      address_state: 'OR',
      address_postal_code: '97209',
      address_country: 'US',
    },
  },
  created_at: '2025-08-11T10:00:00Z',
  updated_at: '2026-09-02T16:30:00Z',
}

/** `AlertSettingsResponse`: per-entity rules, thresholds as decimal strings. */
const alertSettings: Record<string, unknown>[] = [
  {
    id: 'alert_01M38QALERT000000000001',
    entity_id: 'wallet_01M38QWAL00000000000001',
    entity_type: 'wallet',
    parent_entity_id: 'cust_01M38QCUST0000000000001',
    parent_entity_type: 'customer',
    enabled: true,
    status: 'published',
    config: {
      alert_enabled: true,
      alert_threshold_type: 'percentage',
      info: null,
      warning: { condition: 'below', threshold: '25' },
      critical: { condition: 'below', threshold: '10' },
    },
    created_at: '2026-05-20T12:00:00Z',
    updated_at: '2026-08-01T09:30:00Z',
  },
  {
    id: 'alert_01M38QALERT000000000002',
    entity_id: 'feat_01M38QFEAT0000000000001',
    entity_type: 'feature',
    parent_entity_id: '',
    parent_entity_type: '',
    enabled: true,
    status: 'published',
    config: {
      alert_enabled: true,
      alert_threshold_type: 'percentage',
      info: { condition: 'above', threshold: '50' },
      warning: { condition: 'above', threshold: '80' },
      critical: { condition: 'above', threshold: '95' },
    },
    created_at: '2026-06-02T08:15:00Z',
    updated_at: '2026-06-02T08:15:00Z',
  },
  {
    id: 'alert_01M38QALERT000000000003',
    entity_id: 'subs_01M38QSUB00000000000001',
    entity_type: 'subscription',
    parent_entity_id: '',
    parent_entity_type: '',
    enabled: false,
    status: 'published',
    config: {
      alert_enabled: false,
      alert_threshold_type: 'absolute',
      info: null,
      warning: { condition: 'above', threshold: '10000' },
      critical: null,
    },
    created_at: '2026-02-14T17:45:00Z',
    updated_at: '2026-07-19T13:10:00Z',
  },
]

/*
 * ---------------------------------------------------------------------------
 * `GET|PUT|DELETE /settings/:key`.
 *
 * One route, one envelope, several keys. The envelope is the same record every
 * time — `{id, key, value, environment_id, tenant_id, status, created_at,
 * updated_at, created_by, updated_by}` — and the *payload* is `value`. A mock
 * that returned the payload bare would be laxer than the API and would hide
 * the unwrapping every caller has to do.
 *
 * Two tiers, on purpose:
 *
 *   - `SETTINGS_DEFAULTS` is what the backend serves a tenant that has never
 *     written the key. These are the values observed live, unchanged.
 *   - `settingsStore` is what *this* tenant has saved. Seeded with Northwind's
 *     own configuration, because a demo of `{custom_currencies: {}}` or
 *     `{actions: []}` demonstrates nothing.
 *
 * `DELETE` clears the override, so the next `GET` returns the default — which
 * is the behaviour worth being able to try, and it only exists because the two
 * tiers are distinct.
 *
 * `saml_config` is deliberately in neither table. See `SAML_UNAVAILABLE`.
 * ---------------------------------------------------------------------------
 */

/** Settings are stored per environment; Sandbox is what the demo opens in. */
const SETTINGS_ENVIRONMENT_ID = 'env_01KVSNYVPMAP6JJGDF177V2DE6'

type SettingsValue = Record<string, unknown>

/** What a tenant that has never written the key gets back. Observed live. */
const SETTINGS_DEFAULTS: Record<string, SettingsValue> = {
  invoice_config: {
    prefix: 'INV',
    separator: '-',
    format: 'YYYYMM',
    timezone: 'UTC',
    start_sequence: 1,
    suffix_length: 5,
    due_date_days: 1,
    finalization_delay_seconds: 7200,
  },
  subscription_config: {
    auto_cancellation_enabled: false,
    grace_period_days: 3,
  },
  custom_currency_config: {
    custom_currencies: {},
    default_fiat_currency: '',
  },
  customer_portal_config: {
    sections: [],
  },
  customer_onboarding: {
    actions: [],
    workflow_type: 'customer_onboarding',
  },
  wallet_balance_alert_config: {
    alert_enabled: false,
    alert_threshold_type: 'absolute',
    critical: { condition: 'below', threshold: '0' },
    warning: null,
    info: null,
  },
}

/**
 * Northwind's saved settings — what the demo actually shows.
 *
 * Self-consistent with the rest of this file on purpose: the invoice timezone
 * is the tenant's own (the Profile tab puts it in Portland), and the onboarding
 * action subscribes to a plan that exists in the corpus, so the action names
 * something the console can actually open.
 */
const settingsStore: Record<string, SettingsValue> = {
  // Numbers an invoice "NWS-202609-01001", on net-14 terms — which is what the
  // billing contact on the Profile tab collects against.
  invoice_config: {
    prefix: 'NWS',
    separator: '-',
    format: 'YYYYMM',
    timezone: 'America/Los_Angeles',
    start_sequence: 1001,
    suffix_length: 5,
    due_date_days: 14,
    finalization_delay_seconds: 3600,
  },
  subscription_config: {
    auto_cancellation_enabled: true,
    grace_period_days: 7,
  },
  /*
   * A settlement currency and two custom units. `custom_currencies` is a map
   * keyed by the currency code, and each entry carries the descriptive fields a
   * price unit does — `conversion_rate` as a decimal *string*, never a float,
   * so 0.0025 does not arrive as 0.0024999999999998.
   */
  custom_currency_config: {
    custom_currencies: {
      NWC: {
        code: 'NWC',
        name: 'Northwind Credit',
        symbol: '⛁',
        precision: 2,
        conversion_rate: '0.01',
      },
      NWT: {
        code: 'NWT',
        name: 'Northwind Token',
        symbol: '◈',
        precision: 6,
        conversion_rate: '0.0025',
      },
    },
    default_fiat_currency: 'usd',
  },
  /*
   * The portal's information architecture, kept nested as the API sends it.
   * Flattening it to a handful of booleans is the tempting mistake: the
   * ordering and the per-tab metric-card switches *are* the configuration, and
   * a flat mock would make an editor that cannot round-trip look correct.
   *
   * One disabled tab and one disabled section, because "off" is a state the
   * screen has to render and an all-true fixture never shows it.
   */
  customer_portal_config: {
    sections: [
      {
        enabled: true,
        id: 'usage',
        label: 'Usage',
        order: 1,
        tabs: [
          {
            enabled: true,
            id: 'usage_summary',
            order: 1,
            type: 'usage_summary',
            metric_cards: {
              show_cost_metrics: true,
              show_custom_metrics: false,
              show_revenue_metric: true,
            },
          },
          {
            enabled: true,
            id: 'usage_by_feature',
            order: 2,
            type: 'feature_usage',
            metric_cards: {
              show_cost_metrics: true,
              show_custom_metrics: true,
              show_revenue_metric: false,
            },
          },
        ],
      },
      {
        enabled: true,
        id: 'billing',
        label: 'Billing',
        order: 2,
        tabs: [
          {
            enabled: true,
            id: 'invoices',
            order: 1,
            type: 'invoices',
            metric_cards: {
              show_cost_metrics: false,
              show_custom_metrics: false,
              show_revenue_metric: true,
            },
          },
          {
            enabled: false,
            id: 'payment_methods',
            order: 2,
            type: 'payment_methods',
            metric_cards: {
              show_cost_metrics: false,
              show_custom_metrics: false,
              show_revenue_metric: false,
            },
          },
        ],
      },
      {
        enabled: false,
        id: 'wallet',
        label: 'Wallet',
        order: 3,
        tabs: [
          {
            enabled: false,
            id: 'wallet_balance',
            order: 1,
            type: 'wallet',
            metric_cards: {
              show_cost_metrics: false,
              show_custom_metrics: true,
              show_revenue_metric: false,
            },
          },
        ],
      },
    ],
  },
  /*
   * What happens to a customer between signing up and their first invoice.
   *
   * The live value had `actions: []`, so the *element* shape was never
   * observable. These two are authored to the request bodies the wallet and
   * subscription creates take, which is the closest thing to a contract there
   * is, and `plan_id` points at a plan the corpus actually contains.
   */
  customer_onboarding: {
    actions: [
      {
        id: 'onbact_01M38QONB00000000000001',
        type: 'create_wallet',
        enabled: true,
        order: 1,
        config: {
          name: 'Trial credit',
          currency: 'usd',
          wallet_type: 'promotional',
          initial_credits: '25',
          conversion_rate: '1',
          auto_topup_enabled: false,
        },
      },
      {
        id: 'onbact_01M38QONB00000000000002',
        type: 'create_subscription',
        enabled: true,
        order: 2,
        config: {
          plan_id: 'plan_synth_0000',
          currency: 'usd',
          billing_cadence: 'RECURRING',
          billing_period: 'MONTHLY',
          billing_period_count: 1,
          trial_days: 14,
          start_date_offset_days: 0,
        },
      },
    ],
    workflow_type: 'customer_onboarding',
  },
  /*
   * Tenant-wide wallet thresholds, in currency rather than percent — the
   * alert-rules fixture above already demonstrates the percentage form on one
   * wallet, and two fixtures carrying the same numbers teach nothing twice.
   * `info` is null: not every severity is configured, and a panel that assumes
   * three levels breaks on the tenant who set one.
   */
  wallet_balance_alert_config: {
    alert_enabled: true,
    alert_threshold_type: 'absolute',
    critical: { condition: 'below', threshold: '50' },
    warning: { condition: 'below', threshold: '250' },
    info: null,
  },
}

/**
 * The raw event log the Events Debugger reads: sixty events across three
 * customers, three event names and two sources, an hour apart, so paging,
 * every filter and the sort all have something to do. One customer id is not
 * matched to a Flexprice customer, which is a real state worth seeing.
 */
const rawEvents: Record<string, unknown>[] = Array.from({ length: 60 }, (_, index) => {
  const customers = ['acme-corp', 'globex', 'initech']
  const names = ['api_call', 'storage_gb', 'seat_active']
  const externalCustomerId = customers[index % 3]
  return {
    id: `evt_01M38QEVT${String(index).padStart(14, '0')}`,
    event_name: names[index % names.length],
    external_customer_id: externalCustomerId,
    customer_id: externalCustomerId === 'initech' ? '' : `cust_${externalCustomerId}`,
    source: index % 5 === 0 ? 'import' : 'sdk',
    timestamp: new Date(Date.UTC(2026, 8, 1, 0, 0, 0) + index * 3_600_000).toISOString(),
    properties: { units: (index % 7) + 1, region: index % 2 === 0 ? 'us-east-1' : 'eu-west-1' },
  }
})

/**
 * Credit notes, authored to the wire: snake_case, `total_amount` a number, the
 * invoice and customer embedded as `GET /creditnotes` expands them.
 */
const creditNotes: Record<string, unknown>[] = Array.from({ length: 30 }, (_, index) => {
  const statuses = ['FINALIZED', 'DRAFT', 'VOIDED']
  const customers = ['Acme Corp', 'Globex', 'Initech']
  return {
    id: `cnote_01M38Q${String(index).padStart(10, '0')}`,
    credit_note_number: `CN-${String(index + 1).padStart(4, '0')}`,
    credit_note_status: statuses[index % 3],
    credit_note_type: index % 2 === 0 ? 'REFUND' : 'ADJUSTMENT',
    currency: 'usd',
    total_amount: 25 + index * 5,
    invoice_id: `inv_${index}`,
    invoice: { invoice_number: `INV-${1000 + index}` },
    customer: { id: `cust_${index % 3}`, name: customers[index % 3] },
    created_at: new Date(Date.UTC(2026, 8, 1) + index * 86_400_000).toISOString(),
  }
})

/** Usage records, authored to the wire. Every third one has not been synced. */
const usageRecords: Record<string, unknown>[] = Array.from({ length: 30 }, (_, index) => {
  const synced = index % 3 !== 2
  const number = String(index + 1).padStart(2, '0')
  return {
    id: `ur_${number}`,
    customer_id: `cust_${number}`,
    customer_external_id: `customer-${number}`,
    subscription_id: `sub_${number}`,
    plan_id: 'plan_pro',
    quantity: String(100 + index),
    amount: (120 + index * 3).toFixed(2),
    currency: 'usd',
    period_start: '2026-08-01T00:00:00Z',
    period_end: '2026-09-01T00:00:00Z',
    synced,
    syncs: synced
      ? {
          aws_marketplace: {
            agreement_id: `agr_${number}`,
            reporting_id: `rep_${number}`,
            synced_at: '2026-09-02T00:00:00Z',
            connection_id: 'conn_aws',
          },
        }
      : {},
  }
})

/** Workflow runs, authored to the wire: snake_case, times as ISO strings. */
const workflowRuns: Record<string, unknown>[] = Array.from({ length: 30 }, (_, index) => {
  const statuses = ['Completed', 'Failed', 'Running', 'TimedOut', 'Canceled']
  const types = ['PriceSyncV2Workflow', 'ExecuteExportWorkflow', 'ProcessInvoiceWorkflow']
  const status = statuses[index % statuses.length]
  const start = Date.UTC(2026, 8, 1) + index * 3_600_000
  const duration = 800 + index * 1_700
  return {
    workflow_id: `wf-${String(index + 1).padStart(4, '0')}`,
    run_id: `run_${String(index + 1).padStart(6, '0')}`,
    workflow_type: types[index % types.length],
    status,
    task_queue: 'billing',
    start_time: new Date(start).toISOString(),
    close_time: status === 'Running' ? null : new Date(start + duration).toISOString(),
    duration_ms: status === 'Running' ? null : duration,
  }
})

/** Scheduled exports, authored to the wire: snake_case, `job_config` nested. */
const scheduledTasks: Record<string, unknown>[] = [
  ['invoice', 'daily', true, 'acme-billing', 'us-east-1', 'flexprice/invoices/'],
  ['events', 'hourly', true, 'acme-usage', 'us-east-1', 'flexprice/events/'],
  ['credit_usage', 'daily', false, 'acme-warehouse', 'eu-west-1', 'flexprice/credits/'],
  ['usage_analytics', 'daily', true, 'acme-analytics', 'ap-south-1', ''],
].map(([entity, interval, enabled, bucket, region, prefix], index) => ({
  id: `task_${String(index + 1).padStart(4, '0')}`,
  connection_id: 'conn_s3_01',
  entity_type: entity,
  interval,
  enabled,
  status: 'published',
  job_config: { bucket, region, key_prefix: prefix },
  created_at: new Date(Date.UTC(2026, 1, 1 + index)).toISOString(),
}))

/**
 * `GET /taxes/rates`, the one settings panel with no handler at all.
 *
 * Without it the request escaped MSW to `mock.flexprice.test` and failed at
 * DNS, so the Taxes tab sat on "Counting your tax rates…" indefinitely — the
 * most misleading of the failure modes, because an unhandled route looks
 * identical to a slow one.
 *
 * Authored to the wire: `percentage_value` as a decimal *string*, and
 * `tax_rate_type`/`tax_rate_status` present because the response carries them
 * even though the list reads neither.
 *
 * Mind the casing, which is not uniform and is not a typo here. `scope` and
 * `tax_rate_status` are **open** enums in the SDK, upper-case
 * (`EXTERNAL`/`ONETIME`, `ACTIVE`/`INACTIVE`) and tolerant of a value they do
 * not know. `tax_rate_type` is a **closed** one whose sole member is the
 * lower-case `"percentage"` — send `"PERCENTAGE"` and zod rejects the whole
 * page, the SDK raises a `ResponseValidationError`, and the screen shows a
 * permission-shaped error titled "OK" (the status text of the 200 it just
 * refused). That is the exact wrong turn this fixture took first.
 *
 * Northwind sells into four jurisdictions and has one rate it has retired.
 */
/** Tax rates attached to entities, mutated by the association handlers. */
const taxAssociations: Record<string, unknown>[] = []

const taxRates: Record<string, unknown>[] = [
  {
    id: 'tax_01M38QTAX00000000000001',
    name: 'US sales tax — Oregon',
    code: 'US-OR',
    description: 'Oregon levies no state sales tax; the zero rate is recorded so invoices say so.',
    percentage_value: '0',
    tax_rate_type: 'percentage',
    scope: 'EXTERNAL',
    tax_rate_status: 'ACTIVE',
    status: 'published',
    created_at: '2025-08-12T09:14:00Z',
    updated_at: '2025-08-12T09:14:00Z',
  },
  {
    id: 'tax_01M38QTAX00000000000002',
    name: 'UK VAT — standard',
    code: 'GB-VAT-STD',
    description: 'Charged on invoices to UK customers without a validated VAT number.',
    percentage_value: '20',
    tax_rate_type: 'percentage',
    scope: 'EXTERNAL',
    tax_rate_status: 'ACTIVE',
    status: 'published',
    created_at: '2025-10-03T11:42:00Z',
    updated_at: '2026-04-06T08:00:00Z',
  },
  {
    id: 'tax_01M38QTAX00000000000003',
    name: 'EU VAT — reverse charge',
    code: 'EU-RC',
    description: 'Zero-rated; the customer accounts for the VAT in their own member state.',
    percentage_value: '0',
    tax_rate_type: 'percentage',
    scope: 'EXTERNAL',
    tax_rate_status: 'ACTIVE',
    status: 'published',
    created_at: '2026-01-19T14:27:00Z',
    updated_at: '2026-01-19T14:27:00Z',
  },
  {
    id: 'tax_01M38QTAX00000000000004',
    name: 'Canada GST',
    code: 'CA-GST',
    description: 'Federal goods and services tax, applied on top of any provincial rate.',
    percentage_value: '5',
    tax_rate_type: 'percentage',
    scope: 'EXTERNAL',
    tax_rate_status: 'ACTIVE',
    status: 'published',
    created_at: '2026-03-08T10:05:00Z',
    updated_at: '2026-08-21T16:33:00Z',
  },
  {
    // Archived, so the status filter on `/taxes` has something to exclude.
    id: 'tax_01M38QTAX00000000000005',
    name: 'Setup fee levy',
    code: 'ONE-SETUP',
    description: 'Applied to one-off implementation charges. Retired when setup fees were dropped.',
    percentage_value: '7.5',
    tax_rate_type: 'percentage',
    scope: 'ONETIME',
    tax_rate_status: 'INACTIVE',
    status: 'archived',
    created_at: '2025-09-01T08:00:00Z',
    updated_at: '2026-02-11T12:48:00Z',
  },
]

/** Stable identity and authorship per key, so a GET is not a new record each time. */
const SETTINGS_META: Record<
  string,
  { id: string; created_at: string; updated_at: string; created_by: string; updated_by: string }
> = {
  invoice_config: {
    id: 'set_01M38QSET00000000000001',
    created_at: '2025-08-11T10:04:12Z',
    updated_at: '2026-07-22T15:48:03Z',
    created_by: 'user_demo',
    updated_by: 'user_01M38QUSER0000000000002',
  },
  subscription_config: {
    id: 'set_01M38QSET00000000000002',
    created_at: '2025-08-11T10:05:30Z',
    updated_at: '2026-04-09T11:17:44Z',
    created_by: 'user_demo',
    updated_by: 'user_demo',
  },
  custom_currency_config: {
    id: 'set_01M38QSET00000000000003',
    created_at: '2026-01-02T09:20:55Z',
    updated_at: '2026-06-18T08:02:19Z',
    created_by: 'user_01M38QUSER0000000000002',
    updated_by: 'user_01M38QUSER0000000000002',
  },
  customer_portal_config: {
    id: 'set_01M38QSET00000000000004',
    created_at: '2026-02-27T13:41:07Z',
    updated_at: '2026-09-11T10:26:38Z',
    created_by: 'user_demo',
    updated_by: 'user_01M38QUSER0000000000003',
  },
  customer_onboarding: {
    id: 'set_01M38QSET00000000000005',
    created_at: '2026-03-16T16:09:21Z',
    updated_at: '2026-08-30T07:55:12Z',
    created_by: 'user_01M38QUSER0000000000002',
    updated_by: 'user_demo',
  },
  wallet_balance_alert_config: {
    id: 'set_01M38QSET00000000000006',
    created_at: '2026-05-20T12:03:44Z',
    updated_at: '2026-09-24T18:12:50Z',
    created_by: 'user_demo',
    updated_by: 'user_demo',
  },
}

function settingsEnvelope(key: string, value: SettingsValue): Record<string, unknown> {
  const meta = SETTINGS_META[key]
  return {
    id: meta?.id ?? `set_mock_${key}`,
    key,
    value,
    environment_id: SETTINGS_ENVIRONMENT_ID,
    tenant_id: TENANT_ID,
    status: 'published',
    created_at: meta?.created_at ?? '2026-01-01T00:00:00Z',
    updated_at: meta?.updated_at ?? '2026-01-01T00:00:00Z',
    created_by: meta?.created_by ?? 'user_demo',
    updated_by: meta?.updated_by ?? 'user_demo',
  }
}

/**
 * What `/settings/saml_config` answers, on every method, exactly as production
 * does.
 *
 * This deployment has no SAML, and the UI is supposed to notice the 404 and
 * hide the Single sign-on tab. Mocking a working SAML config would make the
 * mocked build the only place that tab ever appears — and would delete the one
 * behaviour in this area worth testing. So the 404 is the fixture.
 */
const SAML_UNAVAILABLE = {
  code: 'not_found',
  message: 'SAML single sign-on is not available on this deployment',
  http_status_code: 404,
}

/** Any key outside the table above. A settings store has no wildcard. */
const SETTING_NOT_FOUND = {
  code: 'not_found',
  message: 'Setting not found',
  http_status_code: 404,
}

/*
 * ---------------------------------------------------------------------------
 * `GET /webhooks/dashboard` — the Svix consumer-portal handoff.
 *
 * The real response carries a **live Svix credential**, which is why the token
 * here is visibly fake. A secret-shaped string in a repository is a secret
 * somebody eventually pastes somewhere, and one that looks real is one nobody
 * checks. `svix_enabled: false` is the other reachable state — a deployment
 * with no Svix configured — but the demo wants the panel populated.
 * ---------------------------------------------------------------------------
 */
const WEBHOOK_DEMO_TOKEN = 'sk_app_DEMO_not_a_real_token.us'

const webhookDashboard = {
  app_id: 'app_01M38QSVIXDEMO0000000001',
  svix_enabled: true,
  token: WEBHOOK_DEMO_TOKEN,
  url: `https://app.svix.com/login#key=${WEBHOOK_DEMO_TOKEN}`,
}

/*
 * ---------------------------------------------------------------------------
 * `GET /tenants/billing` — Flexprice's own bill to Northwind.
 *
 * Note which of these numbers disagree with each other, because that is the
 * point. One entitlement is unlimited (`total_limit: null` — a `?? 0` on it
 * prints "0" as the cap for the most generous plan there is), one sits at 97.4%
 * of its cap so the near-the-limit rendering has something to bite on, and no
 * two rows carry the same figure. Every `usage_percent` is the quotient of the
 * two columns beside it: a fixture whose percentage disagrees with its own
 * usage is how a broken percentage calculation survives review.
 *
 * `sources` is `[]` on every row deliberately — the live response returned it
 * empty, so the element shape was never observed, and this file does not invent
 * records it has not seen.
 * ---------------------------------------------------------------------------
 */
const TENANT_BILLING_PERIOD_START = '2026-09-01T00:00:00Z'
const TENANT_BILLING_PERIOD_END = '2026-10-01T00:00:00Z'

const tenantBilling = {
  usage: {
    customer_id: 'cust_01M38QNWSBILLING00000001',
    features: [
      {
        feature: {
          id: 'feat_01M38QPLATFORM000000001',
          name: 'Events ingested',
          type: 'metered',
          lookup_key: 'events_ingested',
          unit_singular: 'event',
          unit_plural: 'events',
        },
        total_limit: 5000000,
        is_unlimited: false,
        current_usage: '3182455',
        usage_percent: '63.65',
        is_enabled: true,
        is_soft_limit: true,
        next_usage_reset_at: TENANT_BILLING_PERIOD_END,
        sources: [],
      },
      {
        // Near its cap, so the limit column has a row worth warning about.
        feature: {
          id: 'feat_01M38QPLATFORM000000002',
          name: 'Active customers',
          type: 'metered',
          lookup_key: 'active_customers',
          unit_singular: 'customer',
          unit_plural: 'customers',
        },
        total_limit: 500,
        is_unlimited: false,
        current_usage: '487',
        usage_percent: '97.4',
        is_enabled: true,
        is_soft_limit: false,
        next_usage_reset_at: TENANT_BILLING_PERIOD_END,
        sources: [],
      },
      {
        // The unlimited one: `total_limit` is null, not zero and not absent.
        feature: {
          id: 'feat_01M38QPLATFORM000000003',
          name: 'API requests',
          type: 'metered',
          lookup_key: 'api_requests',
          unit_singular: 'request',
          unit_plural: 'requests',
        },
        total_limit: null,
        is_unlimited: true,
        current_usage: '12904331',
        usage_percent: '0',
        is_enabled: true,
        is_soft_limit: false,
        next_usage_reset_at: TENANT_BILLING_PERIOD_END,
        sources: [],
      },
      {
        feature: {
          id: 'feat_01M38QPLATFORM000000004',
          name: 'Invoices generated',
          type: 'metered',
          lookup_key: 'invoices_generated',
          unit_singular: 'invoice',
          unit_plural: 'invoices',
        },
        total_limit: 10000,
        is_unlimited: false,
        current_usage: '1842',
        usage_percent: '18.42',
        is_enabled: true,
        is_soft_limit: true,
        next_usage_reset_at: TENANT_BILLING_PERIOD_END,
        sources: [],
      },
      {
        // A static entitlement: counted, never metered, so it never resets.
        feature: {
          id: 'feat_01M38QPLATFORM000000005',
          name: 'Team members',
          type: 'static',
          lookup_key: 'team_members',
          unit_singular: 'seat',
          unit_plural: 'seats',
        },
        total_limit: 25,
        is_unlimited: false,
        current_usage: '6',
        usage_percent: '24',
        is_enabled: true,
        is_soft_limit: false,
        next_usage_reset_at: null,
        sources: [],
      },
    ],
    // Null here is legitimate: a live tenant on an active monthly plan came
    // back with no period at all, which is why `PlanUsagePanel` omits the line
    // rather than printing an epoch. The demo carries one so the populated
    // branch is the one on screen.
    period: { start_time: TENANT_BILLING_PERIOD_START, end_time: TENANT_BILLING_PERIOD_END },
  },
  subscriptions: [
    {
      id: 'subs_01M38QTENANTSUB00000001',
      customer_id: 'cust_01M38QNWSBILLING00000001',
      plan_id: 'plan_01M38QFPSCALE0000000001',
      plan: { id: 'plan_01M38QFPSCALE0000000001', name: 'Scale' },
      // `subscription_status` is the lifecycle; `status` beside it is the row's
      // archival state. Not the same field, and the panel reads the first.
      subscription_status: 'active',
      status: 'published',
      currency: 'usd',
      billing_period: 'MONTHLY',
      billing_period_count: 1,
      billing_cadence: 'RECURRING',
      start_date: '2025-08-11T10:00:00Z',
      current_period_start: TENANT_BILLING_PERIOD_START,
      current_period_end: TENANT_BILLING_PERIOD_END,
      cancel_at_period_end: false,
      trial_end: null,
    },
  ],
}

/*
 * ---------------------------------------------------------------------------
 * `GET /customers/usage` — one customer's entitlement usage.
 *
 * The same `CustomerUsageSummaryResponse` shape as the `usage` half of
 * `/tenants/billing`, because the API returns literally that model for both.
 * The features are the real ones from the generated features fixture, so a
 * quota card and the feature catalogue name the same things.
 *
 * The rows disagree with each other on purpose, one edge case each:
 *   - API calls      — the ordinary case, comfortably inside its cap.
 *   - Tokens processed — PAST its cap on a soft limit, so the over-quota
 *                        rendering has something to bite on.
 *   - Active users   — unlimited: `total_limit: null`, which a `?? 0` would
 *                      print as "0 of 0" for the most generous grant there is.
 *   - Peak sessions  — nothing used yet: a true zero, not a missing figure.
 *   - Seats          — a `static` entitlement, so `next_usage_reset_at` is
 *                      null and the renewal line has nothing to print.
 *
 * Every `usage_percent` is the real quotient of the two columns beside it — a
 * fixture whose percentage disagrees with its own usage is how a broken
 * percentage survives review. `sources` is `[]` on every row for the reason
 * given on the tenant fixture: the live element shape was never observed.
 * ---------------------------------------------------------------------------
 */
const CUSTOMER_USAGE_PERIOD_START = '2026-09-01T00:00:00Z'
const CUSTOMER_USAGE_PERIOD_END = '2026-10-01T00:00:00Z'

const customerUsage = {
  features: [
    {
      feature: {
        id: 'feat_synth_0000',
        name: 'API calls',
        type: 'metered',
        lookup_key: 'api_calls',
        unit_singular: 'call',
        unit_plural: 'calls',
      },
      total_limit: 250000,
      is_unlimited: false,
      current_usage: '148320',
      usage_percent: '59.328',
      is_enabled: true,
      is_soft_limit: true,
      next_usage_reset_at: CUSTOMER_USAGE_PERIOD_END,
      sources: [],
    },
    {
      // Over the included amount. A soft limit bills the excess rather than
      // blocking it, so the figure past 100% is the one that costs money.
      feature: {
        id: 'feat_synth_0001',
        name: 'Tokens processed',
        type: 'metered',
        lookup_key: 'tokens_processed',
        unit_singular: 'token',
        unit_plural: 'tokens',
      },
      total_limit: 1000000,
      is_unlimited: false,
      current_usage: '1243900',
      usage_percent: '124.39',
      is_enabled: true,
      is_soft_limit: true,
      next_usage_reset_at: CUSTOMER_USAGE_PERIOD_END,
      sources: [],
    },
    {
      // `total_limit` null, not zero and not absent.
      feature: {
        id: 'feat_synth_0003',
        name: 'Active users',
        type: 'metered',
        lookup_key: 'active_users',
        unit_singular: 'user',
        unit_plural: 'users',
      },
      total_limit: null,
      is_unlimited: true,
      current_usage: '3412',
      usage_percent: '0',
      is_enabled: true,
      is_soft_limit: false,
      next_usage_reset_at: CUSTOMER_USAGE_PERIOD_END,
      sources: [],
    },
    {
      feature: {
        id: 'feat_synth_0004',
        name: 'Peak sessions',
        type: 'metered',
        lookup_key: 'peak_sessions',
        unit_singular: 'session',
        unit_plural: 'sessions',
      },
      total_limit: 500,
      is_unlimited: false,
      current_usage: '0',
      usage_percent: '0',
      is_enabled: true,
      is_soft_limit: false,
      next_usage_reset_at: CUSTOMER_USAGE_PERIOD_END,
      sources: [],
    },
    {
      // Static: an allowance that does not meter and never resets.
      feature: {
        id: 'feat_synth_0006',
        name: 'Seats',
        type: 'static',
        lookup_key: 'seats',
        unit_singular: 'seat',
        unit_plural: 'seats',
      },
      total_limit: 25,
      is_unlimited: false,
      current_usage: '18',
      usage_percent: '72',
      is_enabled: true,
      is_soft_limit: false,
      next_usage_reset_at: null,
      sources: [],
    },
  ],
  period: { start_time: CUSTOMER_USAGE_PERIOD_START, end_time: CUSTOMER_USAGE_PERIOD_END },
}

function findIndexById(rows: Record<string, unknown>[], id: string): number {
  return rows.findIndex((row) => readString(row, 'id') === id)
}

/** In-memory stores for the entities whose corpus is empty. */
const costSheetStore: Record<string, unknown>[] = [
  {
    id: 'cost_seed_1',
    name: 'Inference costs',
    lookup_key: 'inference-costs',
    description: 'What each model call costs us.',
    status: 'published',
    prices: [],
    created_at: '2025-01-10T09:00:00Z',
    updated_at: '2025-01-10T09:00:00Z',
  },
]
const groupStore: Record<string, unknown>[] = [
  {
    id: 'grp_seed_1',
    name: 'Core features',
    lookup_key: 'core-features',
    entity_type: 'feature',
    entity_ids: [],
    status: 'published',
    created_at: '2025-01-10T09:00:00Z',
    updated_at: '2025-01-10T09:00:00Z',
  },
]

/**
 * Wallets, authored: the capture had none, so they start empty and hold what
 * this session creates. Wire shape is snake_case, as the live API sends it.
 * The arithmetic here is the mock standing in for the backend, not client logic.
 */
const walletStore: Record<string, unknown>[] = []
/** Payments recorded this session, newest first; the list prepends them. */
const paymentStore: Record<string, unknown>[] = []
const walletTransactionStore: Record<string, unknown>[] = []

function recordWalletCredit(
  wallet: Record<string, unknown>,
  credits: number,
  reason: string,
  description: string,
) {
  const rate = Number(wallet['conversion_rate'] ?? 1)
  const next = Number(wallet['credit_balance'] ?? 0) + credits
  wallet['credit_balance'] = String(next)
  wallet['real_time_credit_balance'] = String(next)
  wallet['balance'] = String(next * rate)
  wallet['real_time_balance'] = String(next * rate)
  walletTransactionStore.unshift({
    id: `wtx_${walletTransactionStore.length + 1}`,
    wallet_id: wallet['id'],
    type: credits < 0 ? 'debit' : 'credit',
    transaction_reason: reason,
    description,
    credit_amount: String(Math.abs(credits)),
    amount: String(Math.abs(credits) * rate),
    currency: wallet['currency'],
    created_at: new Date().toISOString(),
  })
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  return ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
}

function patchRow(rows: Record<string, unknown>[], id: string, patch: Record<string, unknown>) {
  const index = findIndexById(rows, id)
  if (index < 0) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
  rows[index] = { ...rows[index], ...patch, id }
  return HttpResponse.json(rows[index])
}

function removeRow(rows: Record<string, unknown>[], id: string) {
  const index = findIndexById(rows, id)
  if (index >= 0) rows.splice(index, 1)
  return new HttpResponse(null, { status: 204 })
}

/* ---- The overview's demo data ------------------------------------------
 *
 * The Home dashboard reads three things the captured corpus cannot answer as
 * it stands:
 *
 *   - **Usage analytics.** `POST /events/analytics` was never captured, so
 *     there is no fixture for it at all.
 *   - **Recent subscriptions** and **recent invoices.** The capture is months
 *     old. A "last 7 days" window over it is legitimately empty, which makes
 *     the populated design impossible to see under mocks.
 *
 * Both are solved here, in the mock world, rather than by editing the generated
 * fixtures — those descend from real API responses and six other surfaces read
 * them. Everything below is derived from the Northwind corpus (same customers,
 * same plans, same features) and is **self-consistent by construction**: a
 * series sums to its own total, a total is the sum of its parts, and the
 * priced subtotal is computed from the usage it claims to price.
 */

const DAY_MS = 86_400_000

/**
 * Pretend this tenant has only just signed up.
 *
 * A mock-world switch, not app logic: with it set, every list and the analytics
 * endpoint answer "nothing yet", which is the only way to *see* the first-run
 * design end to end in a browser. Handlers run in the page, so reading storage
 * here is safe; it is wrapped because a locked-down context throws on access.
 */
function demoEmpty(): boolean {
  try {
    return globalThis.localStorage?.getItem('fp-demo-empty') === '1'
  } catch {
    return false
  }
}

function emptyPage(body: SearchBody): Corpus {
  return {
    items: [],
    pagination: { total: 0, limit: Number(body.limit ?? 25), offset: Number(body.offset ?? 0) },
  }
}

/** Midnight UTC, `daysAgo` days back — the grid every recent-activity mock sits on. */
function dayStart(daysAgo: number): Date {
  const date = new Date(Date.now() - daysAgo * DAY_MS)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

/**
 * A stable pseudo-random number in [0, 1) for a seed.
 *
 * Deterministic on purpose. A "+12% vs prior week" delta compares two windows
 * of this data, so if the numbers moved between renders the screen would be
 * reporting a trend that is really just the mock reshuffling itself.
 */
function noise(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 100_000) / 100_000
}

/** The five metered features the overview charts, taken from the real corpus. */
const ANALYTICS_FEATURES = (corpus.features as Corpus).items
  .filter((row) => readString(row, 'type') === 'metered')
  .slice(0, 5)
  .map((row, index) => ({
    row,
    id: readString(row, 'id'),
    lookupKey: readString(row, 'lookup_key'),
    eventName: readString(row, 'lookup_key'),
    // Deliberately distinct magnitudes and multipliers, so no two rows on the
    // finished screen can share a number and read as copy-paste.
    eventsPerDay: [428_000, 96_500, 61_200, 18_400, 7_300][index] ?? 5_000,
    multiplier: [1, 18.4, 6.2, 1, 3.5][index] ?? 1,
    rate: [0.00042, 0.0000075, 0.000018, 0.02, 0.006][index] ?? 0.001,
  }))

const WINDOW_MS: Record<string, number> = {
  HOUR: 3_600_000,
  DAY: DAY_MS,
  WEEK: 7 * DAY_MS,
}

/**
 * The analytics response for one window.
 *
 * Each point is the feature's daily rate scaled to the bucket and wobbled by a
 * seeded amount; the item totals are sums of those points, and the subtotal is
 * each item's usage priced at that feature's rate. Nothing is asserted that is
 * not computed from something else here.
 */
function usageAnalytics(startTime: Date, endTime: Date, windowSize: string) {
  const step = WINDOW_MS[windowSize] ?? DAY_MS
  const buckets: number[] = []
  for (
    let cursor = startTime.getTime();
    cursor < endTime.getTime() && buckets.length < 400;
    cursor += step
  ) {
    buckets.push(cursor)
  }

  const items = ANALYTICS_FEATURES.map((feature) => {
    const scale = step / DAY_MS
    const points = buckets.map((bucket) => {
      const wobble = 0.72 + 0.56 * noise(`${feature.lookupKey}:${bucket}`)
      const eventCount = Math.round(feature.eventsPerDay * scale * wobble)
      return {
        timestamp: new Date(bucket).toISOString(),
        event_count: eventCount,
        usage: String(Math.round(eventCount * feature.multiplier)),
      }
    })

    return {
      feature_id: feature.id,
      event_name: feature.eventName,
      feature: feature.row,
      event_count: points.reduce((sum, point) => sum + point.event_count, 0),
      total_usage: String(points.reduce((sum, point) => sum + Number(point.usage), 0)),
      points,
    }
  })

  const subtotal = items.reduce(
    (sum, item, index) => sum + Number(item.total_usage) * (ANALYTICS_FEATURES[index]?.rate ?? 0),
    0,
  )

  return { items, subtotal: subtotal.toFixed(2), total_cost: subtotal.toFixed(2), currency: 'USD' }
}

/**
 * Subscriptions created over the last two weeks, by plan.
 *
 * Two weeks rather than one because the panel shows a change against the prior
 * week, and a delta is only honest if the period it compares against is made of
 * the same kind of rows.
 */
function recentSubscriptionRows(): Record<string, unknown>[] {
  const templates = (corpus.subscriptions as Corpus).items
  const plans = (corpus.plans as Corpus).items.slice(0, 4)
  const rows: Record<string, unknown>[] = []
  let created = 0

  for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
    // Both weeks are drawn from the same distribution, with one extra on the
    // busier recent days. The "vs prior week" change is then a real property of
    // the rows — a modest number nobody chose — rather than a headline figure
    // written into the component and dressed up as a measurement.
    // Seeded on the day of the week, so the two weeks are structurally
    // comparable and the change between them is the lift below rather than the
    // two windows happening to draw different numbers.
    const base = 3 + Math.floor(noise(`subscriptions:${daysAgo % 7}`) * 4)
    const perDay = daysAgo < 7 && noise(`lift:${daysAgo}`) > 0.62 ? base + 1 : base

    for (let index = 0; index < perDay; index += 1) {
      const template = templates[created % templates.length] ?? {}
      const plan = plans[(created + daysAgo) % plans.length] ?? {}
      const at = new Date(dayStart(daysAgo).getTime() + (index + 1) * 3_600_000).toISOString()

      rows.push({
        ...template,
        id: `subs_recent_${daysAgo}_${index}`,
        subscription_status: 'active',
        status: 'published',
        plan_id: readString(plan, 'id'),
        plan,
        start_date: at,
        created_at: at,
        updated_at: at,
      })
      created += 1
    }
  }

  return rows
}

/**
 * How long each customer has to pay.
 *
 * Northwind's own default is net-14 — `settingsStore.invoice_config` sets
 * `due_date_days: 14`, and the Invoice settings tab shows it — but terms are
 * negotiated per account, so this spread is what a real book looks like. It is
 * also what makes an *overdue* invoice reachable inside a seven-day window: on
 * net-14 terms nothing issued this week can be late yet, and a fixture that
 * asserted otherwise (as this one used to, with invoices due four days before
 * they were issued) would be describing an impossible book.
 */
const INVOICE_TERM_DAYS = [14, 21, 7, 1, 3, 30]

/**
 * Nine weeks of finalised invoices.
 *
 * Nine rather than one, and that is the fixture bug this replaces. The old
 * version issued every invoice inside the last seven days and *asserted* the
 * split — 34 paid, 15 open, 7 overdue — which made every window over it the
 * same window: the overview's "last 7 days" and Revenue's "last 30 days" would
 * have quoted an identical 56/34/15/7 at each other as though they were two
 * findings, and Revenue's prior-period change would have had nothing to compare
 * against. Sixty-three days of issuance gives the two surfaces genuinely
 * different measurements of the same book, and gives a 30-day window a 30-day
 * window before it.
 *
 * Nothing about the split is asserted any more. Each row carries an issue date,
 * a term, and whether it has settled; *overdue* then falls out of
 * `deriveInvoiceStatus` reading the due date this file actually wrote, exactly
 * as it does against the live API. Older invoices settle more often than recent
 * ones, which is the only editorial claim here and the one that makes the
 * collections meter move at all.
 */
function recentInvoiceRows(): Record<string, unknown>[] {
  const templates = (corpus.invoices as Corpus).items
  const customers = (corpus.customers as Corpus).items
  const rows: Record<string, unknown>[] = []
  let issued = 0

  // Newest first, so the first page of a newest-first list is the recent world
  // even before the handler sorts it.
  for (let daysAgo = 0; daysAgo < 63; daysAgo += 1) {
    const perDay = 1 + Math.floor(noise(`invoices:${daysAgo}`) * 3)

    for (let index = 0; index < perDay; index += 1) {
      const template = templates[issued % templates.length] ?? {}
      const customer = customers[issued % customers.length] ?? {}
      const at = new Date(dayStart(daysAgo).getTime() + (index + 1) * 3_600_000)
      const termDays = INVOICE_TERM_DAYS[issued % INVOICE_TERM_DAYS.length] ?? 14

      /*
       * Settlement rises with age: about two in five of this week's invoices
       * have been paid, against nine in ten of those from two months ago.
       * Seeded, so the "vs prior period" change on Revenue is a property of
       * the book rather than the mock reshuffling itself between renders.
       *
       * The curve and the term spread above were chosen together, against the
       * two windows that actually read this book: they leave the overview's
       * seven days and Revenue's thirty with six different figures rather than
       * one repeated, and with no two of paid/open/overdue equal in either —
       * the coincidence that looks exactly like a copy-paste bug.
       */
      const settledOdds = 0.42 + (Math.min(daysAgo, 35) / 35) * 0.5
      const settled = noise(`settled:${daysAgo}:${index}`) < settledOdds

      // Clean, plausible amounts — the captured corpus carries some synthesized
      // values in the 1e16 range that would flatten any axis they landed on.
      const total = (185 + ((issued * 53) % 87) * 35).toFixed(2)
      const period = new Date(at.getTime() - 30 * DAY_MS)

      rows.push({
        ...template,
        id: `inv_recent_${daysAgo}_${index}`,
        invoice_status: 'FINALIZED',
        payment_status: settled ? 'SUCCEEDED' : 'PENDING',
        status: 'published',
        currency: 'USD',
        customer_id: readString(customer, 'id'),
        customer,
        subtotal: total,
        total,
        amount_due: total,
        amount_paid: settled ? total : '0.00',
        amount_remaining: settled ? '0.00' : total,
        line_items: [],
        issue_date: at.toISOString(),
        created_at: at.toISOString(),
        updated_at: at.toISOString(),
        period_start: period.toISOString(),
        period_end: at.toISOString(),
        due_date: new Date(at.getTime() + termDays * DAY_MS).toISOString(),
      })
      issued += 1
    }
  }

  /*
   * Numbered the way this tenant's own settings say it numbers invoices:
   * prefix `NWS`, `YYYYMM`, a five-digit suffix from sequence 1001. Assigned
   * oldest-first, because a sequence that ran backwards through time would be
   * the first thing anyone reading the Invoices list noticed.
   */
  const oldestFirst = [...rows].sort((left, right) =>
    readString(left, 'issue_date').localeCompare(readString(right, 'issue_date')),
  )
  oldestFirst.forEach((row, sequence) => {
    const yearMonth = readString(row, 'issue_date').slice(0, 7).replace('-', '')
    row['invoice_number'] = `NWS-${yearMonth}-${String(1001 + sequence).padStart(5, '0')}`
  })

  return rows
}

/**
 * Corpora the dashboard's recent rows are prepended to.
 *
 * Prepended, not replacing: the older captured rows stay exactly where they
 * were, so every other list still shows the world it always showed and only
 * gains some recent activity at the top.
 */
const DASHBOARD_CORPUS: Record<string, Corpus> = {
  subscriptions: (() => {
    const extra = recentSubscriptionRows()
    const base = corpus.subscriptions as Corpus
    return {
      items: [...extra, ...base.items],
      pagination: { ...base.pagination, total: base.pagination.total + extra.length },
    }
  })(),
  invoices: (() => {
    const extra = recentInvoiceRows()
    const base = corpus.invoices as Corpus
    return {
      items: [...extra, ...base.items],
      pagination: { ...base.pagination, total: base.pagination.total + extra.length },
    }
  })(),
}

function sourceFor(key: string): Corpus {
  return DASHBOARD_CORPUS[key] ?? (corpus[key] as Corpus)
}

export const handlers = [
  // Environments. Unlike the create handlers further down — which echo the
  // record back and leave the corpus alone — this one appends, because the
  // console switches to what you just created and then refetches the list. An
  // echo-only mock would switch to an id the next list does not contain, and
  // the hook would correctly treat it as stale and bounce you back out.
  http.get(`${BASE}/environments`, () =>
    HttpResponse.json({
      environments,
      total: environments.length,
      offset: 0,
      limit: 50,
    }),
  ),
  http.post(`${BASE}/environments`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const created = {
      id: `env_mock_${Date.now()}`,
      name: readString(body, 'name'),
      type: readString(body, 'type') || 'development',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    environments.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  // The mock demo login. `POST /auth/login` takes `{ email, password }` and, on
  // the live API, returns `{ token, user_id, tenant_id }` — the snake_case keys
  // `toCredentials` in `@fp/api` reads and maps to `{ token, userId, tenantId }`.
  // The demo account is the only one that succeeds; every other credential gets
  // the API's wrong-password answer, a 403 whose `code`/`message`/`http_status_code`
  // shape `messageForSignInError` collapses to "That email and password do not
  // match." Under mocks the fixtures are served regardless of the bearer token,
  // so any valid session is all the route guard needs — this just mints one.
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      password?: string
    }
    if (body.email === 'demo@flexprice.io' && body.password === 'demo1234') {
      return HttpResponse.json({
        token: 'mock_demo_token',
        user_id: 'user_demo',
        tenant_id: 'tenant_demo',
      })
    }
    return HttpResponse.json(
      { code: 'permission_denied', message: 'Failed to get user', http_status_code: 403 },
      { status: 403 },
    )
  }),

  /*
   * Usage analytics — the overview's event series, revenue and per-feature
   * usage. `POST /events/analytics`, the path `client.events.getUsageAnalytics`
   * posts to. Answers snake_case, as the live API does; the SDK's inbound
   * schema is what turns it camelCase again.
   *
   * An empty tenant answers `items: []` and **no subtotal** — not a zero.
   * "Nothing has been ingested" and "this usage was worth nothing" are
   * different sentences, and the panel renders them differently.
   */
  http.post(`${BASE}/events/analytics`, async ({ request }) => {
    if (demoEmpty()) return HttpResponse.json({ items: [] })

    const body = (await request.json().catch(() => ({}))) as {
      start_time?: string
      end_time?: string
      window_size?: string
    }
    const endTime = body.end_time ? new Date(body.end_time) : new Date()
    const startTime = body.start_time
      ? new Date(body.start_time)
      : new Date(endTime.getTime() - 7 * DAY_MS)

    return HttpResponse.json(usageAnalytics(startTime, endTime, body.window_size ?? 'DAY'))
  }),

  search('/customers/search', 'customers'),

  /*
   * Entitlement usage for one customer.
   *
   * **Must stay above `/customers/:id`** — the customer is a query parameter
   * here, not a path segment, so `:id` would otherwise match the literal
   * "usage" and answer a 404 for it.
   */
  http.get(`${BASE}/customers/usage`, ({ request }) => {
    const customerId = new URL(request.url).searchParams.get('customer_id') ?? ''
    // Unknown customers get an empty summary, not the demo rows: a customer
    // with no entitlements and a customer that does not exist both have no
    // quotas to show, and neither should borrow somebody else's.
    const known = byId('customers', customerId) !== undefined
    return HttpResponse.json({
      ...customerUsage,
      customer_id: customerId,
      ...(known ? {} : { features: [] }),
    })
  }),

  // A single customer, for the detail page. The corpus rows already carry the
  // fuller record (address, timezone, tax treatment, metadata), so the by-id GET
  // just returns the row the SDK then camelCases.
  http.get(`${BASE}/customers/:id`, ({ params }) => {
    const customer = byId('customers', String(params['id']))
    return customer
      ? HttpResponse.json(customer)
      : HttpResponse.json({ message: 'Customer not found' }, { status: 404 })
  }),

  // A customer's subscriptions, keyed by the *external* id (the endpoint the SDK
  // calls). The external id resolves to the internal customer, then the
  // subscriptions are scoped to it — each row keeps its embedded plan and
  // customer, so the table shows plan names rather than ids.
  http.get(`${BASE}/customers/external/:externalId/subscriptions`, ({ params }) => {
    const externalId = String(params['externalId'])
    const customer = (corpus.customers as Corpus).items.find(
      (row) => readString(row, 'external_id') === externalId,
    )
    const customerId = customer ? readString(customer, 'id') : ''
    const items = (corpus.subscriptions as Corpus).items.filter(
      (row) => readString(row, 'customer_id') === customerId,
    )
    return HttpResponse.json({
      items,
      pagination: { total: items.length, limit: items.length, offset: 0 },
    })
  }),

  search('/plans/search', 'plans'),
  search('/features/search', 'features'),
  search('/prices/search', 'prices'),
  search('/invoices/search', 'invoices'),
  search('/subscriptions/search', 'subscriptions'),
  search('/addons/search', 'addons'),
  search('/coupons/search', 'coupons'),
  search('/prices/units/search', 'priceUnits'),

  http.get(`${BASE}/payments`, ({ request }) => {
    const url = new URL(request.url)
    const window = {
      limit: Number(url.searchParams.get('limit') ?? 25),
      offset: Number(url.searchParams.get('offset') ?? 0),
    }
    if (demoEmpty()) return HttpResponse.json(emptyPage(window))
    const base = page(corpus['invoices'] as Corpus, window) as {
      items: Record<string, unknown>[]
      pagination: { total: number }
    }
    return HttpResponse.json({
      ...base,
      items: window.offset === 0 ? [...paymentStore, ...base.items] : base.items,
      pagination: { ...base.pagination, total: base.pagination.total + paymentStore.length },
    })
  }),
  http.post(`${BASE}/payments`, async ({ request }) => {
    const body = await readBody(request)
    const processed = body['process_payment'] === true
    const row = {
      ...body,
      id: `pay_new_${paymentStore.length + 1}_${Date.now()}`,
      payment_status: processed ? 'SUCCEEDED' : 'INITIATED',
      payment_gateway: body['payment_method_type'] === 'OFFLINE' ? undefined : 'stripe',
      created_at: new Date().toISOString(),
      ...(processed ? { succeeded_at: new Date().toISOString() } : {}),
      attempts: processed ? [{ id: 'att_1', attempt_number: 1 }] : [],
    }
    paymentStore.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.get(`${BASE}/payments/:id`, ({ params }) => {
    const id = String(params['id'])
    const stored = paymentStore.find((row) => readString(row, 'id') === id)
    if (stored) return HttpResponse.json(stored)
    const invoice = sourceFor('invoices').items.find((row) => readString(row, 'id') === id)
    return invoice
      ? HttpResponse.json({ ...invoice, destination_type: 'INVOICE', destination_id: id })
      : HttpResponse.json({ message: 'Payment not found' }, { status: 404 })
  }),
  http.post(`${BASE}/payments/:id/process`, ({ params }) => {
    const id = String(params['id'])
    if (!paymentStore.some((row) => readString(row, 'id') === id)) {
      return HttpResponse.json({ message: 'Payment not found' }, { status: 404 })
    }
    return patchRow(paymentStore, id, {
      payment_status: 'SUCCEEDED',
      succeeded_at: new Date().toISOString(),
      attempts: [{ id: 'att_1', attempt_number: 1 }],
    })
  }),
  http.delete(`${BASE}/payments/:id`, ({ params }) => {
    removeRow(paymentStore, String(params['id']))
    return HttpResponse.json({ message: 'Payment deleted' })
  }),

  // Charges and entitlements, scoped by entity — the plan detail page's tabs.
  search('/entitlements/search', 'entitlements'),

  /*
   * ---- Settings ---------------------------------------------------------
   *
   * `/users/me` and `/users/:id` are registered in that order on purpose: MSW
   * matches in registration order, and `:id` would otherwise swallow `me` and
   * try to rename the current user to whatever a role update sent.
   */

  http.get(`${BASE}/users/me`, () => HttpResponse.json(users[0])),

  /*
   * `POST /users/search` honours `type` and the paging window, and **ignores
   * `filters` and `roles`** — because the real endpoint does. Verified live: a
   * `contains` filter came back with a row that cannot match it. Honouring them
   * here would be the laxer-than-reality mock that hides the bug until
   * production, and the Members tab is built around the truth (it narrows the
   * page it received, and says so on screen).
   */
  http.post(`${BASE}/users/search`, async ({ request }) => {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as {
      type?: string
      limit?: number
      offset?: number
    }
    // A missing `type` returns nothing on the live API, rather than everyone.
    const rows = body.type ? users.filter((row) => readString(row, 'type') === body.type) : []
    const offset = body.offset ?? 0
    const limit = body.limit ?? 25

    return HttpResponse.json({
      items: rows.slice(offset, offset + limit),
      pagination: { total: rows.length, limit, offset },
    })
  }),

  http.post(`${BASE}/users`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const type = readString(body, 'type') || 'user'
    const created = {
      id: `${type === 'service_account' ? 'svc' : 'user'}_mock_${Date.now()}`,
      name: readString(body, 'name'),
      email: readString(body, 'email'),
      type,
      roles: Array.isArray(body['roles']) ? body['roles'] : [],
      tenant: TENANT_REF,
    }
    users.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put(`${BASE}/users/me`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const me = users[0]
    if (me) me['name'] = readString(body, 'name')
    return HttpResponse.json(me)
  }),

  http.put(`${BASE}/users/:id/roles`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const index = findIndexById(users, String(params['id']))
    const row = users[index]
    if (!row) return new HttpResponse(null, { status: 404 })
    row['roles'] = Array.isArray(body['roles']) ? body['roles'] : []
    return HttpResponse.json(row)
  }),

  // 204 with an empty body, not a 200 with `{}`: the generated client matches
  // this one on status alone, and a 200 falls through to no matcher at all.
  http.post(`${BASE}/users/:id/remove`, ({ params }) => {
    const index = findIndexById(users, String(params['id']))
    if (index >= 0) users.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.put(`${BASE}/users/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const index = findIndexById(users, String(params['id']))
    const row = users[index]
    if (!row) return new HttpResponse(null, { status: 404 })
    row['name'] = readString(body, 'name')
    return HttpResponse.json(row)
  }),

  http.delete(`${BASE}/users/:id`, ({ params }) => {
    const index = findIndexById(users, String(params['id']))
    if (index >= 0) users.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // RBAC answers `{roles}` / `{role}`, not the `{items, pagination}` envelope.
  http.get(`${BASE}/rbac/roles`, ({ request }) => {
    const audience = new URL(request.url).searchParams.get('user_type')
    const rows =
      audience === 'service_account'
        ? roles.filter((role) => SERVICE_ACCOUNT_ROLE_IDS.includes(readString(role, 'id')))
        : roles
    return HttpResponse.json({ roles: rows })
  }),
  http.get(`${BASE}/rbac/roles/:id`, ({ params }) => {
    const role = roles.find((row) => readString(row, 'id') === String(params['id']))
    return role ? HttpResponse.json({ role }) : new HttpResponse(null, { status: 404 })
  }),

  http.get(`${BASE}/secrets/api/keys`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const all = demoEmpty() ? [] : apiKeys
    const rows = status ? all.filter((row) => readString(row, 'status') === status) : all

    return HttpResponse.json({
      items: rows.slice(offset, offset + limit),
      pagination: { total: rows.length, limit, offset },
    })
  }),

  /*
   * The create response inverts what you would guess: the **secret string** is
   * under `api_key`, and the **key record** is under `secret`. Shaped that way
   * because that is what the API sends, and `toCreatedApiKey` reads it that
   * way. This is the only time the material is ever returned.
   */
  http.post(`${BASE}/secrets/api/keys`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const type = readString(body, 'type') || 'private_key'
    const expiresAt = readString(body, 'expires_at')
    const record = {
      id: `key_mock_${Date.now()}`,
      name: readString(body, 'name'),
      display_id: `fp_${type === 'publishable_key' ? 'pub' : 'live'}_••••${Date.now() % 10000}`,
      type,
      status: 'published',
      roles: [],
      user_id: 'user_demo',
      user_type: 'user',
      service_account_name: '',
      provider: 'flexprice',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: expiresAt || null,
      last_used_at: null,
    }
    apiKeys.unshift(record)

    return HttpResponse.json(
      {
        api_key: `fp_${type === 'publishable_key' ? 'pub' : 'live'}_sk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
        secret: record,
      },
      { status: 201 },
    )
  }),

  http.delete(`${BASE}/secrets/api/keys/:id`, ({ params }) => {
    const index = findIndexById(apiKeys, String(params['id']))
    if (index >= 0) apiKeys.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  /*
   * The tenant billing-usage route, reproduced as it actually behaves.
   *
   * `@flexprice/sdk@2.1.30` requests `GET /v1/tenant/billing` — singular — and
   * the deployed route is `GET /v1/tenants/billing`. So the singular path
   * answers 404 here too, exactly as it does live (same `text/plain` body), and
   * the Plan & usage panel renders the unavailable state naming the typo.
   *
   * Serving the data from the singular path instead would make the mocked build
   * the only place this screen has ever worked, and would quietly delete the
   * one bug this panel exists to report. The plural handler below is where the
   * data lives, ready for the day the OpenAPI path gains its `s` — nothing
   * requests it today.
   */
  http.get(`${BASE}/tenant/billing`, () =>
    HttpResponse.text('404 page not found', { status: 404 }),
  ),
  http.get(`${BASE}/tenants/billing`, () => HttpResponse.json(tenantBilling)),

  http.get(`${BASE}/tenants/:id`, ({ params }) =>
    String(params['id']) === TENANT_ID
      ? HttpResponse.json(tenant)
      : // Asking for anybody else's tenant is a 403 on the live API, not a 404.
        HttpResponse.json(
          { code: 'permission_denied', message: 'Forbidden', http_status_code: 403 },
          { status: 403 },
        ),
  ),

  // Note the path: no id. The tenant being updated is the token's own.
  http.put(`${BASE}/tenants/update`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (typeof body['name'] === 'string') tenant['name'] = body['name']
    if (body['billing_details'] && typeof body['billing_details'] === 'object') {
      tenant['billing_details'] = body['billing_details']
    }
    tenant['updated_at'] = new Date().toISOString()
    return HttpResponse.json(tenant)
  }),

  // `/alerts/setting` — plural noun, singular setting. That is the real path.
  http.post(`${BASE}/alerts/setting/search`, async ({ request }) => {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as {
      entity_type?: string
      entity_id?: string
      enabled?: boolean
      limit?: number
      offset?: number
    }
    let rows = [...alertSettings]
    if (body.entity_type) {
      rows = rows.filter((row) => readString(row, 'entity_type') === body.entity_type)
    }
    if (body.entity_id) {
      rows = rows.filter((row) => readString(row, 'entity_id') === body.entity_id)
    }
    if (body.enabled !== undefined) {
      rows = rows.filter((row) => row['enabled'] === body.enabled)
    }
    const offset = body.offset ?? 0
    const limit = body.limit ?? 25

    return HttpResponse.json({
      items: rows.slice(offset, offset + limit),
      pagination: { total: rows.length, limit, offset },
    })
  }),

  http.post(`${BASE}/alerts/setting`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const created = {
      id: `alert_mock_${Date.now()}`,
      entity_id: readString(body, 'entity_id'),
      entity_type: readString(body, 'entity_type'),
      parent_entity_id: readString(body, 'parent_entity_id'),
      parent_entity_type: readString(body, 'parent_entity_type'),
      enabled: true,
      status: 'published',
      config: body['config'] ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    alertSettings.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.get(`${BASE}/alerts/setting/:id`, ({ params }) => {
    const row = alertSettings.find((entry) => readString(entry, 'id') === String(params['id']))
    return row ? HttpResponse.json(row) : new HttpResponse(null, { status: 404 })
  }),

  /*
   * The update takes `{ config }` and nothing else — no `entity_id`, no
   * `entity_type`. An alert cannot be repointed at a different entity after it
   * is created, which is why the editor shows what it watches as read-only.
   */
  http.put(`${BASE}/alerts/setting/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const index = findIndexById(alertSettings, String(params['id']))
    const row = alertSettings[index]
    if (!row) return new HttpResponse(null, { status: 404 })
    const config = (body['config'] ?? {}) as Record<string, unknown>
    row['config'] = config
    row['enabled'] = config['alert_enabled'] ?? row['enabled']
    row['updated_at'] = new Date().toISOString()
    return HttpResponse.json(row)
  }),

  http.delete(`${BASE}/alerts/setting/:id`, ({ params }) => {
    const index = findIndexById(alertSettings, String(params['id']))
    if (index >= 0) alertSettings.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  /*
   * `GET|PUT|DELETE /settings/:key`.
   *
   * `saml_config` is checked first and on every method, because its 404 is the
   * contract — see `SAML_UNAVAILABLE`. An unrecognised key 404s too: the store
   * holds a fixed set of keys, not anything you name.
   *
   * These three are registered inside the Settings block rather than beside the
   * catalogue routes so `:key` cannot shadow a literal path added later; MSW
   * matches in registration order and `/settings/*` has no siblings.
   */
  http.get(`${BASE}/settings/:key`, ({ params }) => {
    const key = String(params['key'])
    if (key === 'saml_config') return HttpResponse.json(SAML_UNAVAILABLE, { status: 404 })
    const value = settingsStore[key] ?? SETTINGS_DEFAULTS[key]
    if (!value) return HttpResponse.json(SETTING_NOT_FOUND, { status: 404 })
    return HttpResponse.json(settingsEnvelope(key, value))
  }),

  /*
   * The write echoes the `value` it was given back inside the envelope — and
   * keeps it, so the next GET agrees with what the screen just said happened.
   * An echo-only mock leaves a saved form reverting on the next refetch, which
   * looks exactly like a backend that silently dropped the write.
   */
  http.put(`${BASE}/settings/:key`, async ({ request, params }) => {
    const key = String(params['key'])
    if (key === 'saml_config') return HttpResponse.json(SAML_UNAVAILABLE, { status: 404 })
    if (!SETTINGS_DEFAULTS[key]) return HttpResponse.json(SETTING_NOT_FOUND, { status: 404 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    // The body is `{ value: {...} }`; a caller that sends the payload bare is
    // tolerated rather than silently storing `{value: undefined}`.
    const next = (body['value'] ?? body) as SettingsValue
    settingsStore[key] = next
    const meta = SETTINGS_META[key]
    if (meta) meta.updated_at = new Date().toISOString()
    return HttpResponse.json(settingsEnvelope(key, next))
  }),

  /*
   * Delete clears the tenant's override; it does not delete the setting. The
   * next GET returns `SETTINGS_DEFAULTS[key]`, which is the whole reason the
   * defaults are a separate table from the seeded values.
   */
  http.delete(`${BASE}/settings/:key`, ({ params }) => {
    const key = String(params['key'])
    if (key === 'saml_config') return HttpResponse.json(SAML_UNAVAILABLE, { status: 404 })
    if (!SETTINGS_DEFAULTS[key]) return HttpResponse.json(SETTING_NOT_FOUND, { status: 404 })
    delete settingsStore[key]
    return new HttpResponse(null, { status: 204 })
  }),

  // The Svix handoff. The token is visibly fake on purpose — see the fixture.
  http.get(`${BASE}/webhooks/dashboard`, () => HttpResponse.json(webhookDashboard)),

  /*
   * `GET /taxes/rates` — note the path. `@fp/query`'s docstring calls it
   * `/taxrates`, but the generated client puts the request on `/taxes/rates`,
   * and the request is what MSW has to match. Mocking the path the prose
   * describes rather than the one the client sends is how a handler ends up
   * looking correct while every request sails past it; that is exactly what
   * happened here first, and the symptom was the Taxes tab sitting on
   * "Counting your tax rates…" forever, because an unhandled route is
   * indistinguishable from a slow one.
   *
   * Paging only. The request model has `limit`/`offset` and an `order`
   * *direction*, but no sort field and no name search, which is why
   * `fetchTaxRates` filters by status and search on the page. Filtering here
   * would be the laxer-than-reality mock that makes that client-side filter
   * look unnecessary right up until somebody removes it.
   */
  http.get(`${BASE}/taxes/rates`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    return HttpResponse.json({
      items: taxRates.slice(offset, offset + limit),
      pagination: { total: taxRates.length, limit, offset },
    })
  }),

  /*
   * `POST /events/query` — the Events Debugger's list (`client.events.listRawEvents`).
   *
   * Name, customer and source are server-side filters on the real endpoint, so
   * they are applied here too; a mock that ignored them would make the grid's
   * filter chips look wired when they were not. Newest first unless `order` is
   * `asc`. `total_count` is the filtered total, as on the wire.
   */
  http.post(`${BASE}/events/query`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const pageSize = Number(body['page_size'] ?? 50)
    const offset = Number(body['offset'] ?? 0)
    const name = String(body['event_name'] ?? '')
    const customer = String(body['external_customer_id'] ?? '')
    const source = String(body['source'] ?? '')

    const matches = rawEvents
      .filter(
        (event) =>
          (!name || String(event['event_name']).toLowerCase().includes(name.toLowerCase())) &&
          (!customer || event['external_customer_id'] === customer) &&
          (!source || event['source'] === source),
      )
      .sort((a, b) => String(a['timestamp']).localeCompare(String(b['timestamp'])))
    if (body['order'] !== 'asc') matches.reverse()

    return HttpResponse.json({
      events: matches.slice(offset, offset + pageSize),
      total_count: matches.length,
      has_more: offset + pageSize < matches.length,
      offset,
    })
  }),

  /*
   * `GET /creditnotes` — a live route the SDK has no method for, so the app
   * reads it with plain fetch. Status is a server-side filter (repeatable
   * `credit_note_status`), paging is limit/offset, and `pagination.total` is the
   * filtered total.
   */
  http.get(`${BASE}/creditnotes`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const statuses = url.searchParams.getAll('credit_note_status')

    const matches = creditNotes.filter(
      (note) => statuses.length === 0 || statuses.includes(String(note['credit_note_status'])),
    )
    return HttpResponse.json({
      items: matches.slice(offset, offset + limit),
      pagination: { total: matches.length, limit, offset },
    })
  }),

  http.post(`${BASE}/creditnotes`, async ({ request }) => {
    const body = await readBody(request)
    const invoiceId = String(body['invoice_id'] ?? '')
    const invoice = sourceFor('invoices').items.find((row) => readString(row, 'id') === invoiceId)
    const lineItems: Record<string, unknown>[] = (
      (body['line_items'] as Record<string, unknown>[] | undefined) ?? []
    ).map((line, index) => ({ ...line, id: `cnli_${index + 1}`, currency: 'usd' }))
    // The mock stands in for the backend, which owns the total.
    const total = lineItems.reduce((sum, line) => sum + Number(line['amount'] ?? 0), 0)
    const processed = body['process_credit_note'] === true
    const row = {
      id: `cnote_new_${creditNotes.length + 1}`,
      credit_note_number: `CN-NEW-${creditNotes.length + 1}`,
      credit_note_status: processed ? 'FINALIZED' : 'DRAFT',
      credit_note_type: 'ADJUSTMENT',
      currency: 'usd',
      total_amount: String(total),
      invoice_id: invoiceId,
      invoice: {
        invoice_number: invoice ? (readString(invoice, 'invoice_number') ?? invoiceId) : invoiceId,
      },
      customer_id: invoice ? readString(invoice, 'customer_id') : undefined,
      customer: { id: 'cust_0', name: 'Acme Corp' },
      reason: body['reason'],
      memo: body['memo'],
      line_items: lineItems,
      created_at: new Date().toISOString(),
      ...(processed ? { finalized_at: new Date().toISOString() } : {}),
    }
    creditNotes.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.get(`${BASE}/creditnotes/:id`, ({ params }) => {
    const row = creditNotes.find((note) => note['id'] === params['id'])
    if (!row) return HttpResponse.json({ message: 'Credit note not found' }, { status: 404 })
    return HttpResponse.json({ ...row, total_amount: String(row['total_amount']) })
  }),
  http.post(`${BASE}/creditnotes/:id/finalize`, ({ params }) => {
    const id = String(params['id'])
    if (!creditNotes.some((note) => note['id'] === id)) {
      return HttpResponse.json({ message: 'Credit note not found' }, { status: 404 })
    }
    patchRow(creditNotes, id, {
      credit_note_status: 'FINALIZED',
      finalized_at: new Date().toISOString(),
    })
    return HttpResponse.json({
      ...creditNotes.find((note) => note['id'] === id),
      total_amount: String(creditNotes.find((note) => note['id'] === id)?.['total_amount']),
    })
  }),
  http.post(`${BASE}/creditnotes/:id/void`, ({ params }) => {
    const id = String(params['id'])
    if (!creditNotes.some((note) => note['id'] === id)) {
      return HttpResponse.json({ message: 'Credit note not found' }, { status: 404 })
    }
    patchRow(creditNotes, id, {
      credit_note_status: 'VOIDED',
      voided_at: new Date().toISOString(),
    })
    return HttpResponse.json({
      ...creditNotes.find((note) => note['id'] === id),
      total_amount: String(creditNotes.find((note) => note['id'] === id)?.['total_amount']),
    })
  }),

  /*
   * `GET /connections` — which integrations the environment has connected.
   * Stripe is published, QuickBooks has a draft (which must not count).
   */
  http.get(`${BASE}/connections`, () =>
    HttpResponse.json({
      connections: [
        { id: 'conn_stripe', provider_type: 'stripe', connection_status: 'published' },
        { id: 'conn_qb', provider_type: 'quickbooks', connection_status: 'draft' },
      ],
      pagination: { total: 2, limit: 100, offset: 0 },
    }),
  ),

  /*
   * `GET /tasks/scheduled` — the Exports list. `enabled` is the server-side
   * filter this console sends.
   */
  http.get(`${BASE}/tasks/scheduled`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const enabled = url.searchParams.get('enabled')
    const matches = scheduledTasks.filter(
      (task) => enabled === null || String(task['enabled']) === enabled,
    )
    return HttpResponse.json({
      items: matches.slice(offset, offset + limit),
      pagination: { total: matches.length, limit, offset },
    })
  }),

  /*
   * `POST /workflows/search` — the Workflows list. The body is snake_case;
   * `workflow_id` and `workflow_status` are the server-side filters this
   * console sends, and `order` sorts by start time.
   */
  http.post(`${BASE}/workflows/search`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const limit = Number(body['limit'] ?? 25)
    const offset = Number(body['offset'] ?? 0)
    const id = typeof body['workflow_id'] === 'string' ? body['workflow_id'] : ''
    const status = typeof body['workflow_status'] === 'string' ? body['workflow_status'] : ''

    const matches = workflowRuns
      .filter((run) => !id || String(run['workflow_id']).includes(id))
      .filter((run) => !status || run['status'] === status)
      .sort((a, b) =>
        body['order'] === 'asc'
          ? String(a['start_time']).localeCompare(String(b['start_time']))
          : String(b['start_time']).localeCompare(String(a['start_time'])),
      )
    return HttpResponse.json({
      items: matches.slice(offset, offset + limit),
      pagination: { total: matches.length, limit, offset },
    })
  }),

  /*
   * `POST /usage-records/search` — the Usage Syncs list. `synced` is the
   * server-side filter this console sends; the record is authored to the wire
   * with a `syncs` map keyed by marketplace.
   */
  http.post(`${BASE}/usage-records/search`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const limit = Number(body['limit'] ?? 25)
    const offset = Number(body['offset'] ?? 0)
    const synced = typeof body['synced'] === 'boolean' ? body['synced'] : null

    const matches = usageRecords.filter((row) => synced === null || row['synced'] === synced)
    return HttpResponse.json({
      items: matches.slice(offset, offset + limit),
      pagination: { total: matches.length, limit, offset },
    })
  }),

  // ---- end Settings -----------------------------------------------------

  // Entities the capture environment had nothing in are deliberately absent.
  // An empty list from a real endpoint is a state worth seeing; a fabricated
  // row is not.
  http.get(`${BASE}/customers/:id/wallets`, ({ params }) =>
    HttpResponse.json(walletStore.filter((w) => w['customer_id'] === String(params['id']))),
  ),
  http.post(`${BASE}/wallets`, async ({ request }) => {
    const body = await readBody(request)
    const wallet: Record<string, unknown> = {
      id: `wal_new_${walletStore.length + 1}`,
      customer_id: body['customer_id'],
      currency: body['currency'],
      description: body['description'] ?? '',
      conversion_rate: String(body['conversion_rate'] ?? '1'),
      topup_conversion_rate: String(body['conversion_rate'] ?? '1'),
      wallet_status: 'active',
      wallet_type: 'PRE_PAID',
      credit_balance: '0',
      balance: '0',
      real_time_credit_balance: '0',
      real_time_balance: '0',
      created_at: new Date().toISOString(),
    }
    walletStore.push(wallet)
    const initial = Number(body['initial_credits_to_load'] ?? 0)
    if (initial > 0) recordWalletCredit(wallet, initial, 'FREE_CREDIT_GRANT', 'Initial credits')
    return HttpResponse.json(wallet)
  }),
  http.post(`${BASE}/wallets/:id/top-up`, async ({ request, params }) => {
    const wallet = walletStore.find((w) => w['id'] === String(params['id']))
    if (!wallet) return HttpResponse.json({ message: 'Wallet not found' }, { status: 404 })
    const body = await readBody(request)
    recordWalletCredit(
      wallet,
      Number(body['credits_to_add'] ?? 0),
      String(body['transaction_reason'] ?? 'PURCHASED_CREDIT_DIRECT'),
      String(body['description'] ?? ''),
    )
    return HttpResponse.json({ wallet, wallet_transaction: walletTransactionStore[0] })
  }),
  http.post(`${BASE}/wallets/:id/terminate`, ({ params }) => {
    const wallet = walletStore.find((w) => w['id'] === String(params['id']))
    if (!wallet) return HttpResponse.json({ message: 'Wallet not found' }, { status: 404 })
    wallet['wallet_status'] = 'closed'
    return HttpResponse.json(wallet)
  }),
  http.get(`${BASE}/wallets/:id/transactions`, ({ params }) => {
    const items = walletTransactionStore.filter((t) => t['wallet_id'] === String(params['id']))
    return HttpResponse.json({ items, pagination: { total: items.length, limit: 50, offset: 0 } })
  }),
  http.post(`${BASE}/wallets/search`, () =>
    HttpResponse.json({ items: [], pagination: { total: 0, limit: 25, offset: 0 } }),
  ),

  // Groups and cost sheets: the capture environment had none, so they start
  // empty and hold whatever this session creates — a state worth seeing, and
  // enough to run create, rename and delete end to end.
  http.post(`${BASE}/groups/search`, () =>
    HttpResponse.json({
      items: groupStore,
      pagination: { total: groupStore.length, limit: 25, offset: 0 },
    }),
  ),
  http.post(`${BASE}/costs/search`, () =>
    HttpResponse.json({
      items: costSheetStore,
      pagination: { total: costSheetStore.length, limit: 25, offset: 0 },
    }),
  ),

  // Saving a plan's charges. The bulk endpoint echoes each price back with an
  // id, so the editor's success path — close, invalidate, refetch — runs end to
  // end and the Overview tab shows what was just saved.
  http.post(`${BASE}/prices/bulk`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { items?: Record<string, unknown>[] }
    const items = (body.items ?? []).map((item, index) => ({
      ...item,
      id: `price_new_${Date.now()}_${index}`,
      status: 'published',
    }))
    return HttpResponse.json({ items }, { status: 201 })
  }),
  http.put(`${BASE}/prices/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: params['id'], status: 'published' })
  }),
  http.delete(`${BASE}/prices/:id`, ({ params }) =>
    HttpResponse.json({ success: true, id: params['id'] }),
  ),

  // Granting entitlements, the same bulk shape.
  http.post(`${BASE}/entitlements/bulk`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { items?: Record<string, unknown>[] }
    const items = (body.items ?? []).map((item, index) => ({
      ...item,
      id: `ent_new_${Date.now()}_${index}`,
      status: 'published',
    }))
    return HttpResponse.json({ items }, { status: 201 })
  }),
  http.put(`${BASE}/entitlements/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: params['id'], status: 'published' })
  }),
  http.delete(`${BASE}/entitlements/:id`, ({ params }) =>
    HttpResponse.json({ success: true, id: params['id'] }),
  ),

  // Credit grants have no search — only the scoped list endpoints — so the plan
  // and add-on tabs read from these, filtered by the id in the path.
  http.get(`${BASE}/plans/:id/creditgrants`, ({ params }) => {
    const rows = (corpus['creditgrants'] as Corpus).items.filter(
      (row) => readString(row, 'plan_id') === params['id'],
    )
    return HttpResponse.json({
      items: rows,
      pagination: { total: rows.length, limit: 25, offset: 0 },
    })
  }),
  http.get(`${BASE}/addons/:id/creditgrants`, ({ params }) => {
    const rows = (corpus['creditgrants'] as Corpus).items.filter(
      (row) => readString(row, 'addon_id') === params['id'],
    )
    return HttpResponse.json({
      items: rows,
      pagination: { total: rows.length, limit: 25, offset: 0 },
    })
  }),
  http.post(`${BASE}/creditgrants`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { ...body, id: `cg_new_${Date.now()}`, status: 'published' },
      { status: 201 },
    )
  }),
  http.put(`${BASE}/creditgrants/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: params['id'], status: 'published' })
  }),
  http.delete(`${BASE}/creditgrants/:id`, ({ params }) =>
    HttpResponse.json({ success: true, id: params['id'] }),
  ),

  // Creating a feature echoes it back, so the form's success path completes.
  http.post(`${BASE}/features`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { ...body, id: `feat_new_${Date.now()}`, status: 'published' },
      { status: 201 },
    )
  }),

  // Editing, cloning and deleting a feature echo back, so the dialogs' success
  // paths — close, invalidate, refetch — complete end to end.
  http.put(`${BASE}/features/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: params['id'], status: 'published' })
  }),
  http.post(`${BASE}/features/:id/clone`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json(
      { ...body, id: `feat_clone_${Date.now()}`, status: 'published' },
      { status: 201 },
    )
  }),
  http.delete(`${BASE}/features/:id`, ({ params }) =>
    HttpResponse.json({ success: true, id: params['id'] }),
  ),

  // Creating and editing an add-on echo the record back, so the drawer's
  // success path — close, invalidate, refetch — completes end to end.
  http.post(`${BASE}/addons`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { ...body, id: `addon_new_${Date.now()}`, status: 'published' },
      { status: 201 },
    )
  }),
  http.put(`${BASE}/addons/:id`, async ({ request, params }) =>
    patchRow((corpus['addons'] as Corpus).items, String(params['id']), await readBody(request)),
  ),
  // One add-on, by id — the detail page on a direct navigation, from the same
  // corpus the list reads.
  http.get(`${BASE}/addons/:id`, ({ params }) => {
    const addon = byId('addons', String(params['id']))
    return addon ? HttpResponse.json(addon) : new HttpResponse(null, { status: 404 })
  }),

  // Plans, the same way: create and edit echo the record back so the drawer's
  // success path runs end to end.
  http.post(`${BASE}/plans`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { ...body, id: `plan_new_${Date.now()}`, status: 'published' },
      { status: 201 },
    )
  }),
  http.put(`${BASE}/plans/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: params['id'], status: 'published' })
  }),

  // A coupon's detail page: where-used, fetch by id, rename, archive.
  //
  // `/coupons/associations` is registered before `/coupons/:id`, so the literal
  // path is not swallowed by the `:id` param (MSW matches in order).
  http.get(`${BASE}/coupons/associations`, ({ request }) => {
    const url = new URL(request.url)
    const couponIds = url.searchParams.getAll('coupon_ids').flatMap((value) => value.split(','))
    const items = couponIds.includes(DEMO_ASSOCIATION_COUPON) ? couponAssociations() : []
    return HttpResponse.json({ items, pagination: { total: items.length, limit: 100, offset: 0 } })
  }),
  http.get(`${BASE}/coupons/:id`, ({ params }) => {
    const coupon = byId('coupons', String(params['id']))
    return coupon ? HttpResponse.json(coupon) : new HttpResponse(null, { status: 404 })
  }),
  http.put(`${BASE}/coupons/:id`, async ({ request, params }) =>
    patchRow((corpus['coupons'] as Corpus).items, String(params['id']), await readBody(request)),
  ),
  http.delete(`${BASE}/coupons/:id`, ({ params }) =>
    HttpResponse.json({ id: String(params['id']) }),
  ),
  http.post(`${BASE}/coupons`, async ({ request }) => {
    const body = await readBody(request)
    const row = { ...body, id: `coupon_new_${Date.now()}`, status: 'published' }
    ;(corpus['coupons'] as Corpus).items.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),

  // Cost sheets, groups, customers and tax rates: create, update and delete
  // mutate an in-memory store (or the corpus the list reads), so the list a
  // mutation invalidates comes back showing the change.
  http.post(`${BASE}/costs`, async ({ request }) => {
    const body = await readBody(request)
    const row = { ...body, id: `cost_new_${Date.now()}`, status: 'published', prices: [] }
    costSheetStore.unshift(row)
    return HttpResponse.json({ costsheet: row }, { status: 201 })
  }),
  http.get(`${BASE}/costs/:id`, ({ params }) => {
    const row = costSheetStore.find((item) => item['id'] === params['id'])
    return row
      ? HttpResponse.json({ costsheet: row })
      : HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
  }),
  http.put(`${BASE}/costs/:id`, async ({ request, params }) =>
    patchRow(costSheetStore, String(params['id']), await readBody(request)),
  ),
  http.delete(`${BASE}/costs/:id`, ({ params }) => {
    removeRow(costSheetStore, String(params['id']))
    return HttpResponse.json({ message: 'Cost sheet deleted' })
  }),

  http.post(`${BASE}/groups`, async ({ request }) => {
    const body = await readBody(request)
    const row = { ...body, id: `grp_new_${Date.now()}`, status: 'published', entity_ids: [] }
    groupStore.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.delete(`${BASE}/groups/:id`, ({ params }) => removeRow(groupStore, String(params['id']))),

  http.post(`${BASE}/customers`, async ({ request }) => {
    const body = await readBody(request)
    const row = { ...body, id: `cust_new_${Date.now()}`, status: 'published' }
    ;(corpus['customers'] as Corpus).items.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.get(`${BASE}/invoices/:id`, ({ params }) => {
    const id = String(params['id'])
    const invoice =
      byId('invoices', id) ??
      sourceFor('invoices').items.find((row) => readString(row, 'id') === id)
    if (!invoice) return HttpResponse.json({ message: 'Invoice not found' }, { status: 404 })
    // Generated invoices carry no lines; give the detail one so line-level actions have a target.
    const lines = invoice['line_items']
    if (Array.isArray(lines) && lines.length > 0) return HttpResponse.json(invoice)
    return HttpResponse.json({
      ...invoice,
      line_items: [
        {
          id: `${id}_line_1`,
          display_name: 'Platform subscription',
          amount: String(invoice['total'] ?? '0'),
          currency: 'usd',
        },
      ],
    })
  }),
  http.post(`${BASE}/invoices/:id/finalize`, ({ params }) => {
    patchRow(sourceFor('invoices').items, String(params['id']), {
      invoice_status: 'FINALIZED',
      finalized_at: new Date().toISOString(),
    })
    return HttpResponse.json({ message: 'ok' })
  }),
  http.post(`${BASE}/invoices/:id/void`, ({ params }) => {
    patchRow(sourceFor('invoices').items, String(params['id']), {
      invoice_status: 'VOIDED',
      voided_at: new Date().toISOString(),
    })
    return HttpResponse.json({ message: 'ok' })
  }),
  http.post(`${BASE}/invoices/:id/payment/attempt`, () => HttpResponse.json({ message: 'ok' })),
  http.post(`${BASE}/invoices`, async ({ request }) => {
    const body = await readBody(request)
    const total = String(body['total'] ?? '0')
    const row = {
      payment_status: 'PENDING',
      amount_paid: '0',
      amount_remaining: total,
      issue_date: new Date().toISOString(),
      ...body,
      id: `inv_new_${Date.now()}`,
      status: 'published',
    }
    sourceFor('invoices').items.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.get(`${BASE}/subscriptions/:id/entitlements`, () =>
    HttpResponse.json({
      features: [
        {
          feature: { id: 'feat_api_calls', name: 'API calls' },
          entitlement: {
            is_enabled: true,
            is_soft_limit: false,
            usage_limit: 100000,
            usage_reset_period: 'MONTHLY',
          },
        },
        {
          feature: { id: 'feat_sso', name: 'Single sign-on' },
          entitlement: { is_enabled: true },
        },
      ],
    }),
  ),
  http.get(`${BASE}/subscriptions/:id`, ({ params }) => {
    const row = sourceFor('subscriptions').items.find(
      (item) => readString(item, 'id') === params['id'],
    )
    if (!row) return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
    const currency = String(row['currency'] ?? 'USD')
    return HttpResponse.json({
      ...row,
      line_items: [
        {
          id: `${String(row['id'])}_line_1`,
          display_name: 'Platform fee',
          price_type: 'FIXED',
          quantity: '1',
          billing_period: 'MONTHLY',
          currency,
          price: { amount: '99.00', currency },
        },
        {
          id: `${String(row['id'])}_line_2`,
          display_name: 'API usage',
          price_type: 'USAGE',
          quantity: '0',
          billing_period: 'MONTHLY',
          currency,
          price: { amount: '0.002', currency },
        },
      ],
    })
  }),
  http.post(`${BASE}/subscriptions/:id/cancel`, async ({ request, params }) => {
    const body = await readBody(request)
    const immediate = body['cancellation_type'] === 'immediate'
    const patch = immediate
      ? { subscription_status: 'cancelled', cancelled_at: new Date().toISOString() }
      : { cancel_at_period_end: true }
    patchRow(sourceFor('subscriptions').items, String(params['id']), patch)
    return HttpResponse.json({ subscription_id: params['id'], ...patch })
  }),
  http.post(`${BASE}/subscriptions/:id/activate`, async ({ request, params }) => {
    const body = await readBody(request)
    return patchRow(sourceFor('subscriptions').items, String(params['id']), {
      subscription_status: 'active',
      start_date: body['start_date'],
    })
  }),
  http.post(`${BASE}/subscriptions`, async ({ request }) => {
    const body = await readBody(request)
    return HttpResponse.json(
      { ...body, id: `sub_new_${Date.now()}`, subscription_status: 'active' },
      { status: 201 },
    )
  }),
  http.put(`${BASE}/customers`, async ({ request }) =>
    patchRow(
      (corpus['customers'] as Corpus).items,
      new URL(request.url).searchParams.get('id') ?? '',
      await readBody(request),
    ),
  ),
  http.put(`${BASE}/customers/:id`, async ({ request, params }) =>
    patchRow((corpus['customers'] as Corpus).items, String(params['id']), await readBody(request)),
  ),
  http.delete(`${BASE}/customers/:id`, ({ params }) =>
    removeRow((corpus['customers'] as Corpus).items, String(params['id'])),
  ),

  http.get(`${BASE}/taxes/associations`, ({ request }) => {
    const url = new URL(request.url)
    const entityId = url.searchParams.get('entity_id')
    const items = taxAssociations.filter((row) => !entityId || row['entity_id'] === entityId)
    return HttpResponse.json({ items, pagination: { total: items.length, limit: 50, offset: 0 } })
  }),
  http.post(`${BASE}/taxes/associations`, async ({ request }) => {
    const body = await readBody(request)
    const rate = taxRates.find((row) => row['code'] === body['tax_rate_code'])
    if (!rate) return HttpResponse.json({ message: 'Tax rate not found' }, { status: 404 })
    const row = {
      id: `taxassoc_new_${taxAssociations.length + 1}`,
      entity_type: body['entity_type'],
      entity_id: body['entity_id'],
      tax_rate_id: rate['id'],
      tax_rate: rate,
      tax_behavior: body['tax_behavior'],
      priority: body['priority'],
      auto_apply: body['auto_apply'],
      status: 'published',
    }
    taxAssociations.push(row)
    return HttpResponse.json(row)
  }),
  http.put(`${BASE}/taxes/associations/:id`, async ({ request, params }) => {
    const id = String(params['id'])
    patchRow(taxAssociations, id, await readBody(request))
    const row = taxAssociations.find((item) => item['id'] === id)
    return row
      ? HttpResponse.json(row)
      : HttpResponse.json({ message: 'Tax association not found' }, { status: 404 })
  }),
  http.delete(`${BASE}/taxes/associations/:id`, ({ params }) => {
    const id = String(params['id'])
    const index = taxAssociations.findIndex((item) => item['id'] === id)
    if (index < 0)
      return HttpResponse.json({ message: 'Tax association not found' }, { status: 404 })
    const [row] = taxAssociations.splice(index, 1)
    return HttpResponse.json(row)
  }),
  http.post(`${BASE}/taxes/rates`, async ({ request }) => {
    const body = await readBody(request)
    const row = {
      ...body,
      id: `tax_new_${Date.now()}`,
      tax_rate_type: 'percentage',
      tax_rate_status: 'ACTIVE',
      status: 'published',
    }
    taxRates.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.put(`${BASE}/taxes/rates/:id`, async ({ request, params }) =>
    patchRow(taxRates, String(params['id']), await readBody(request)),
  ),
  http.delete(`${BASE}/taxes/rates/:id`, ({ params }) => removeRow(taxRates, String(params['id']))),

  // Price units, the same way: create echoes the record back, and update — which
  // sends only the name — echoes it beside a fixed identity, so the drawer's
  // success path (close, invalidate, refetch) runs end to end. The base path is
  // registered after `/prices/units/search` above so the search POST is not
  // shadowed.
  http.post(`${BASE}/prices/units`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { ...body, id: `pu_new_${Date.now()}`, status: 'published' },
      { status: 201 },
    )
  }),
  http.put(`${BASE}/prices/units/:id`, async ({ request, params }) =>
    patchRow((corpus['priceUnits'] as Corpus).items, String(params['id']), await readBody(request)),
  ),
  // One price unit, by id — the detail page on a direct navigation.
  http.get(`${BASE}/prices/units/:id`, ({ params }) => {
    const unit = byId('priceUnits', String(params['id']))
    return unit ? HttpResponse.json(unit) : new HttpResponse(null, { status: 404 })
  }),

  // One plan, by id — what the detail page loads on a direct navigation. Served
  // from the same corpus the list reads, so the two never disagree; a plan a
  // create just echoed (no corpus row yet) degrades to a minimal record rather
  // than a 404, so the just-created detail page still renders.
  http.get(`${BASE}/plans/:id`, ({ params }) => {
    const id = String(params['id'])
    const found = (corpus['plans'] as Corpus).items.find((row) => readString(row, 'id') === id)
    return HttpResponse.json(found ?? { id, name: 'New plan', status: 'published', prices: [] })
  }),

  // Duplicate and sync, so the detail page's header actions complete.
  http.post(`${BASE}/plans/:id/clone`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json(
      { ...body, id: `plan_clone_${Date.now()}`, status: 'published' },
      { status: 201 },
    )
  }),
  http.post(`${BASE}/plans/:id/sync/subscriptions`, ({ params }) =>
    HttpResponse.json({
      workflow_id: `wf_${Date.now()}`,
      status: 'Running',
      plan_id: params['id'],
    }),
  ),
  http.delete(`${BASE}/plans/:id`, ({ params }) =>
    HttpResponse.json({ success: true, id: params['id'] }),
  ),
]
