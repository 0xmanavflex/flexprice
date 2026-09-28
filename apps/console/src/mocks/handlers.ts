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
  search('/prices/units/search', 'priceUnits'),

  list('/payments', 'invoices'),

  // Entities the capture environment had nothing in are deliberately absent.
  // An empty list from a real endpoint is a state worth seeing; a fabricated
  // row is not.
  http.post(`${BASE}/entitlements/search`, () =>
    HttpResponse.json({ items: [], pagination: { total: 0, limit: 25, offset: 0 } }),
  ),
  http.post(`${BASE}/wallets/search`, () =>
    HttpResponse.json({ items: [], pagination: { total: 0, limit: 25, offset: 0 } }),
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
]
