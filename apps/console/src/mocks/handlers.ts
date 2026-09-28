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
  feature_ids?: string[]
  featureIds?: string[]
  /** How the charges/entitlements searches scope to one plan (or add-on). */
  entity_ids?: string[]
  entityIds?: string[]
  entity_type?: string
  entityType?: string
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

  const search = body.name_contains ?? body.nameContains
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
  if (entityIds?.length) rows = rows.filter((row) => entityIds.includes(readString(row, 'entity_id')))

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
    return HttpResponse.json(
      key === 'features' ? applyFeatureExpand(result, body.expand) : result,
    )
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

export const handlers = [
  search('/customers/search', 'customers'),
  search('/plans/search', 'plans'),
  search('/features/search', 'features'),
  search('/prices/search', 'prices'),
  search('/invoices/search', 'invoices'),
  search('/subscriptions/search', 'subscriptions'),
  search('/addons/search', 'addons'),
  search('/coupons/search', 'coupons'),

  list('/payments', 'invoices'),

  // Charges and entitlements, scoped by entity — the plan detail page's tabs.
  search('/entitlements/search', 'entitlements'),

  // Entities the capture environment had nothing in are deliberately absent.
  // An empty list from a real endpoint is a state worth seeing; a fabricated
  // row is not.
  http.post(`${BASE}/wallets/search`, () =>
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
    return HttpResponse.json({ items: rows, pagination: { total: rows.length, limit: 25, offset: 0 } })
  }),
  http.get(`${BASE}/addons/:id/creditgrants`, ({ params }) => {
    const rows = (corpus['creditgrants'] as Corpus).items.filter(
      (row) => readString(row, 'addon_id') === params['id'],
    )
    return HttpResponse.json({ items: rows, pagination: { total: rows.length, limit: 25, offset: 0 } })
  }),
  http.post(`${BASE}/creditgrants`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: `cg_new_${Date.now()}`, status: 'published' }, { status: 201 })
  }),
  http.delete(`${BASE}/creditgrants/:id`, ({ params }) =>
    HttpResponse.json({ success: true, id: params['id'] }),
  ),

  // Creating a feature echoes it back, so the form's success path completes.
  http.post(`${BASE}/features`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: `feat_new_${Date.now()}`, status: 'published' }, { status: 201 })
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
    HttpResponse.json({ workflow_id: `wf_${Date.now()}`, status: 'Running', plan_id: params['id'] }),
  ),
  http.delete(`${BASE}/plans/:id`, ({ params }) =>
    HttpResponse.json({ success: true, id: params['id'] }),
  ),
]
