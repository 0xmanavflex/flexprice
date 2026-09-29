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
    const result = page(corpus[key] as Corpus, body)
    return HttpResponse.json(key === 'features' ? applyFeatureExpand(result, body.expand) : result)
  })

const list = (path: string, key: string) =>
  http.get(`${BASE}${path}`, ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json(
      page(corpus[key] as Corpus, {
        limit: Number(url.searchParams.get('limit') ?? 25),
        offset: Number(url.searchParams.get('offset') ?? 0),
      }),
    )
  })

/** Finds one row in a corpus by id — the by-id GET endpoints read it. */
function byId(key: string, id: string): Record<string, unknown> | null {
  return (corpus[key] as Corpus).items.find((row) => readString(row, 'id') === id) ?? null
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

function findIndexById(rows: Record<string, unknown>[], id: string): number {
  return rows.findIndex((row) => readString(row, 'id') === id)
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

  search('/customers/search', 'customers'),
  search('/plans/search', 'plans'),
  search('/features/search', 'features'),
  search('/prices/search', 'prices'),
  search('/invoices/search', 'invoices'),
  search('/subscriptions/search', 'subscriptions'),
  search('/addons/search', 'addons'),
  search('/coupons/search', 'coupons'),
  search('/prices/units/search', 'priceUnits'),

  list('/payments', 'invoices'),

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
    const rows = status ? apiKeys.filter((row) => readString(row, 'status') === status) : apiKeys

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
  http.get(`${BASE}/tenants/billing`, () =>
    HttpResponse.json({
      subscriptions: [],
      usage: { features: [], period: null },
    }),
  ),

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

  // ---- end Settings -----------------------------------------------------

  // Entities the capture environment had nothing in are deliberately absent.
  // An empty list from a real endpoint is a state worth seeing; a fabricated
  // row is not.
  http.post(`${BASE}/wallets/search`, () =>
    HttpResponse.json({ items: [], pagination: { total: 0, limit: 25, offset: 0 } }),
  ),

  // Groups and cost sheets: the capture environment had none, so these return
  // an empty list — a state worth seeing — rather than a fabricated row. They
  // disappear when a captured corpus for each lands.
  http.post(`${BASE}/groups/search`, () =>
    HttpResponse.json({ items: [], pagination: { total: 0, limit: 25, offset: 0 } }),
  ),
  http.post(`${BASE}/costs/search`, () =>
    HttpResponse.json({ items: [], pagination: { total: 0, limit: 25, offset: 0 } }),
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

  // Creating and editing an add-on echo the record back, so the drawer's
  // success path — close, invalidate, refetch — completes end to end.
  http.post(`${BASE}/addons`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { ...body, id: `addon_new_${Date.now()}`, status: 'published' },
      { status: 201 },
    )
  }),
  http.put(`${BASE}/addons/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: params['id'], status: 'published' })
  }),
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
  http.put(`${BASE}/coupons/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    const existing = byId('coupons', String(params['id'])) ?? {}
    return HttpResponse.json({ ...existing, ...body, id: params['id'] })
  }),
  http.delete(`${BASE}/coupons/:id`, ({ params }) =>
    HttpResponse.json({ id: String(params['id']) }),
  ),

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
  http.put(`${BASE}/prices/units/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: params['id'], status: 'published' })
  }),
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
