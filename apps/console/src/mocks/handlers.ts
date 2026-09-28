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
