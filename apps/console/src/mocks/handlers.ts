import { http, HttpResponse } from 'msw'
import { type Corpus, corpus } from '@fp/query/fixtures'
import { selfBillingHandlers } from './selfBillingHandlers'
import { mockAccountState } from './selfBillingState'
import { svixHandlers } from './svixHandlers'

/**
 * Mock handlers over the captured-and-expanded corpus.
 *
 * These are not stubs that return a fixed array. They implement the paging,
 * sorting and filtering the real endpoints implement, because a grid that
 * always receives the same twenty-five rows cannot demonstrate pagination,
 * cannot show an empty state, and will hide an off-by-one in an offset
 * calculation until production.
 *
 * Everything served here descends from a real API response: same keys, same
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
  /** Subscription lifecycle statuses: `/subscriptions/search` narrows to these when sent. */
  subscription_status?: string[]
  /** A single catalogue status (published/archived): how the count queries filter. */
  status?: string
  name_contains?: string
  nameContains?: string
  /**
   * The generic filter DSL. Plans, add-ons, coupons and price units have no
   * name-search field, so their search goes through this instead: see
   * `packages/query/src/search.ts`.
   */
  filters?: {
    field?: string
    operator?: string
    data_type?: string
    value?: { string?: string; number?: number; date?: string; array?: string[] }
  }[]
  subscription_ids?: string[]
  subscriptionIds?: string[]
  /** A group's price members, read back by id. */
  price_ids?: string[]
  priceIds?: string[]
  /** The customer list's contract counts: every contract of these customers. */
  customer_ids?: string[]
  customerIds?: string[]
  /** How the contract detail page scopes the invoice search to one contract. */
  subscription_id?: string
  subscriptionId?: string
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
  /** A customer's contracts and invoices, by internal id (works for archived customers). */
  customer_id?: string
  customerId?: string
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
/** One filter-DSL condition against a corpus row. Unknown operators match everything. */
function matchesCondition(
  row: Record<string, unknown>,
  condition: NonNullable<SearchBody['filters']>[number],
): boolean {
  const field = condition.field ?? ''
  const raw = row[field]
  const value = condition.value ?? {}
  const text = raw === undefined || raw === null ? '' : String(raw)
  switch (condition.operator) {
    case 'contains':
      return text.toLowerCase().includes((value.string ?? '').toLowerCase())
    case 'not_contains':
      return !text.toLowerCase().includes((value.string ?? '').toLowerCase())
    case 'eq':
      return value.number !== undefined
        ? Number(raw) === value.number
        : text.toLowerCase() === (value.string ?? '').toLowerCase()
    case 'gt':
      return Number(raw) > (value.number ?? Number.NaN)
    case 'lt':
      return Number(raw) < (value.number ?? Number.NaN)
    case 'in':
      return (value.array ?? []).includes(text)
    case 'not_in':
      return !(value.array ?? []).includes(text)
    case 'before':
      return text !== '' && new Date(text) < new Date(value.date ?? '')
    case 'after':
      return text !== '' && new Date(text) > new Date(value.date ?? '')
    default:
      return true
  }
}

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
  const search = body.name_contains ?? body.nameContains
  if (search) {
    const needle = search.toLowerCase()
    rows = rows.filter((row) => readString(row, 'name').toLowerCase().includes(needle))
  }

  // The generic filter DSL, evaluated the way the backend does: every
  // condition must hold (AND), on the row's snake_case field.
  for (const condition of body.filters ?? []) {
    rows = rows.filter((row) => matchesCondition(row, condition))
  }

  const subscriptionIds = body.subscription_ids ?? body.subscriptionIds
  if (subscriptionIds?.length)
    rows = rows.filter((row) => subscriptionIds.includes(readString(row, 'id')))

  const customerIds = body.customer_ids ?? body.customerIds
  if (customerIds?.length)
    rows = rows.filter((row) => customerIds.includes(readString(row, 'customer_id')))

  const priceIds = body.price_ids ?? body.priceIds
  if (priceIds?.length) rows = rows.filter((row) => priceIds.includes(readString(row, 'id')))

  const ids = body.feature_ids ?? body.featureIds
  if (ids?.length) rows = rows.filter((row) => ids.includes(readString(row, 'id')))

  // Features by their meter, as the API's `meter_ids`.
  const meterIds =
    (body as { meter_ids?: string[]; meterIds?: string[] }).meter_ids ??
    (body as { meterIds?: string[] }).meterIds
  if (meterIds?.length) rows = rows.filter((row) => meterIds.includes(readString(row, 'meter_id')))

  // Charges and entitlements are searched by the entity they price. Scoping to
  // it here is what makes a plan's detail page show *its* charges, not the whole
  // catalogue's: the bug an unfiltered mock would hide until production.
  const entityType = body.entity_type ?? body.entityType
  if (entityType) rows = rows.filter((row) => readString(row, 'entity_type') === entityType)

  const entityIds = body.entity_ids ?? body.entityIds
  if (entityIds?.length)
    rows = rows.filter((row) => entityIds.includes(readString(row, 'entity_id')))

  // A plan's subscriptions, for the detail page's "active subscriptions" metric.
  // Scoping here is what makes the rail count *this* plan's subscribers rather
  // than the whole book: the bug an unfiltered mock would hide until production.
  const planId = body.plan_id ?? body.planId
  if (planId) rows = rows.filter((row) => readString(row, 'plan_id') === planId)

  // A customer's invoices. The real invoice search narrows by the customer's
  // external id; the corpus links invoices by internal `customer_id`, so the
  // external id is resolved to the customer first, then rows are scoped to it:
  // an unknown external id scopes to nothing rather than the whole book.
  const externalCustomerId = body.external_customer_id ?? body.externalCustomerId
  if (externalCustomerId) {
    // As the API: an external id resolves to a published customer only, so an
    // archived customer's external id finds nothing (the API answers 404).
    const customer = (corpus.customers as Corpus).items.find(
      (row) =>
        readString(row, 'external_id') === externalCustomerId &&
        readString(row, 'status') !== 'archived',
    )
    const customerId = customer ? readString(customer, 'id') : ''
    rows = rows.filter((row) => readString(row, 'customer_id') === customerId)
  }

  // A customer's contracts or invoices by internal id, as the customer page
  // reads them: unlike the external id, it still resolves once archived.
  const scopedCustomerId = body.customer_id ?? body.customerId
  if (scopedCustomerId)
    rows = rows.filter((row) => readString(row, 'customer_id') === scopedCustomerId)

  // A contract's invoices. The captured invoices point at the captured
  // subscriptions, not the synthetic ones the console lists, so a row also
  // counts when it belongs to the contract's customer: the mock stays scoped
  // (an unknown contract scopes to nothing) and the tab has rows to show.
  const subscriptionId = body.subscription_id ?? body.subscriptionId
  if (subscriptionId) {
    const subscription = (corpus.subscriptions as Corpus).items.find(
      (row) => readString(row, 'id') === subscriptionId,
    )
    const customerId = subscription ? readString(subscription, 'customer_id') : ''
    rows = rows.filter(
      (row) =>
        readString(row, 'subscription_id') === subscriptionId ||
        (customerId !== '' && readString(row, 'customer_id') === customerId),
    )
  }

  /*
   * Every sort entry, not just the first.
   *
   * The console sends a tie-break after the primary key (`sortWithTieBreak`),
   * because sorting on a timestamp alone is not a total order and the real API
   * is free to return tied rows in any order. A mock that read `sort[0]` and
   * stopped would sort tied rows by corpus position instead: stable, so the
   * tests would pass, and the one thing the tie-break exists to prevent would
   * be the one thing they could never catch.
   */
  const sorts = body.sort ?? []
  if (sorts.length > 0) {
    rows.sort((a, b) => {
      for (const { field, direction } of sorts) {
        const left = readString(a, field)
        const right = readString(b, field)
        const order = direction === 'desc' ? right.localeCompare(left) : left.localeCompare(right)
        if (order !== 0) return order
      }
      return 0
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
 * the bug that omission caused: which is exactly the bug the captured
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

/**
 * The environment's connections. Mutable so the integrations page can connect,
 * edit and disconnect, and so customers pick the change up: a customer shows a
 * provider only while that provider has a published connection. QuickBooks has
 * a draft, which must not count.
 */
const connectionRows: Record<string, unknown>[] = [
  {
    id: 'conn_stripe',
    name: 'Stripe',
    provider_type: 'stripe',
    connection_status: 'published',
    metadata: {},
    sync_config: {
      customer: { outbound: true },
      invoice: { outbound: true },
      payment: { inbound: true },
    },
    created_at: '2026-08-12T09:30:00Z',
  },
  { id: 'conn_qb', name: 'QuickBooks', provider_type: 'quickbooks', connection_status: 'draft' },
  // Export destinations. Storage is not a billing provider, so customers never show it.
  {
    id: 'conn_s3_01',
    name: 'Acme data lake',
    provider_type: 's3',
    connection_status: 'published',
    metadata: {},
    sync_config: { s3: { is_flexprice_managed: false } },
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'conn_s3_02',
    name: 'Flexprice-managed bucket',
    provider_type: 's3',
    connection_status: 'published',
    metadata: {},
    sync_config: { s3: { is_flexprice_managed: true } },
    created_at: '2026-03-02T10:00:00Z',
  },
]
const STORAGE_PROVIDERS = new Set(['s3', 'gcs'])
let connectionSeq = 0
const pendingOAuth = new Map<string, { name: unknown; provider: string; metadata: unknown }>()

function publishedProviders(): string[] {
  return connectionRows
    .filter((row) => row['connection_status'] === 'published')
    .filter((row) => !STORAGE_PROVIDERS.has(String(row['provider_type'])))
    .map((row) => String(row['provider_type']))
}

/**
 * Per-customer provider mappings once someone has linked or unlinked one.
 * Until then a customer's mappings are the demo slice below; the first write
 * freezes that slice into this map so the list marks, the contract header and
 * the link/unlink calls all read the same rows.
 */
const customerMappings = new Map<string, Record<string, unknown>[]>()

function demoMappingRows(customerId: string): Record<string, unknown>[] {
  const row = (corpus['customers'] as Corpus).items.find(
    (item) => readString(item, 'id') === customerId,
  )
  const demo: Record<string, unknown> = seedDemoIntegrations({ id: customerId, ...(row ?? {}) })
  const integrations = (demo['integrations'] as Record<string, unknown>[] | undefined) ?? []
  return integrations.map((integration) => ({
    id: `intmap_${customerId}_${String(integration['provider_type'])}`,
    entity_id: customerId,
    entity_type: 'customer',
    status: 'published',
    created_at: '2026-08-12T09:45:00Z',
    updated_at: '2026-09-02T14:10:00Z',
    ...integration,
  }))
}

const otherEntityMappings = new Map<string, Record<string, unknown>[]>()
function mappingsForEntity(type: string, id: string): Record<string, unknown>[] {
  if (type === 'customer') return mappingsFor(id)
  const key = `${type}:${id}`
  if (!otherEntityMappings.has(key)) otherEntityMappings.set(key, [])
  return otherEntityMappings.get(key)!
}

function mappingsFor(customerId: string): Record<string, unknown>[] {
  const existing = customerMappings.get(customerId)
  if (existing) return existing
  const rows = demoMappingRows(customerId)
  customerMappings.set(customerId, rows)
  return rows
}

/**
 * The corpus has no per-customer integration mappings. A stable slice of the
 * connected providers is attached so the list column and the detail page can
 * show the same marks the integrations page uses. Rows that already carry
 * mappings are left alone.
 */
function withDemoIntegrations<T extends Record<string, unknown>>(row: T): T {
  const edited = customerMappings.get(typeof row['id'] === 'string' ? row['id'] : '')
  return edited ? { ...row, integrations: edited } : seedDemoIntegrations(row)
}

function seedDemoIntegrations<T extends Record<string, unknown>>(row: T): T {
  const id = typeof row['id'] === 'string' ? row['id'] : ''
  if (Array.isArray(row['integrations'])) return row
  let hash = 0
  for (const char of id) hash += char.charCodeAt(0)
  // Provider ids differ per customer, as the real mappings do.
  const suffix = id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-14)
    .toLowerCase()
  const prefix: Record<string, string> = { stripe: 'cus_', quickbooks: 'qb_', hubspot: 'hs_' }
  const integrations = publishedProviders()
    .filter((_, index) => (hash + index) % 3 !== 2)
    .map((provider) => ({
      provider_type: provider,
      status: 'published',
      provider_entity_id: `${prefix[provider] ?? `${provider}_`}${suffix}`,
    }))
  return integrations.length > 0 ? { ...row, integrations } : row
}

/**
 * The payment an invoice's `amount_paid` stands for: one card payment, taken
 * through Stripe when the invoice was issued. Unpaid invoices have none.
 */
function invoicePayments(invoiceId: string): Record<string, unknown>[] {
  const invoice = sourceFor('invoices').items.find((row) => readString(row, 'id') === invoiceId)
  if (!invoice) return []
  // Payments recorded in this session already stand for what has been paid.
  if (paymentStore.some((row) => readString(row, 'destination_id') === invoiceId)) return []
  const paid = Number(readString(invoice, 'amount_paid') || 0)
  if (!(paid > 0)) return []
  const at = readString(invoice, 'issue_date') || readString(invoice, 'created_at')
  return [
    {
      id: `pay_${invoiceId}`,
      destination_id: invoiceId,
      destination_type: 'INVOICE',
      invoice_number: readString(invoice, 'invoice_number'),
      amount: readString(invoice, 'amount_paid'),
      currency: readString(invoice, 'currency') || 'USD',
      payment_status: 'SUCCEEDED',
      payment_method_type: 'CARD',
      payment_gateway: 'stripe',
      created_at: at,
      succeeded_at: at,
    },
  ]
}

/**
 * A succeeded payment against an invoice pays it down, as the API does: the
 * invoice's paid and remaining amounts move, and it reads Succeeded once the
 * balance is cleared.
 */
function applyPaymentToInvoice(payment: Record<string, unknown>) {
  if (readString(payment, 'destination_type') !== 'INVOICE') return
  const id = readString(payment, 'destination_id')
  const invoice = sourceFor('invoices').items.find((row) => readString(row, 'id') === id)
  if (!invoice) return
  const due = Number(readString(invoice, 'amount_due') || readString(invoice, 'total') || 0)
  const paid =
    Number(readString(invoice, 'amount_paid') || 0) + Number(readString(payment, 'amount') || 0)
  const remaining = Math.max(0, due - paid)
  patchRow(sourceFor('invoices').items, id, {
    amount_paid: String(paid),
    amount_remaining: String(remaining),
    payment_status: remaining === 0 ? 'SUCCEEDED' : 'PENDING',
  })
}

/*
 * The expands a route will refuse, as the live API refuses them.
 *
 * Only `/prices/search` is listed, and only because it was checked against
 * production: it answers `400 validation_error` naming the field. That is how
 * `plan,addon,meter` shipped: the values are plural, `addons` and `meters`,
 * and a mock that accepted anything could not say so.
 *
 * Other routes are deliberately absent rather than guessed at. `/entitlements/search`
 * accepts an unknown expand and quietly ignores it (checked: `plan,addon`
 * returns 200 and changes nothing), and the live-API audit found the same of
 * `/subscriptions/search`. Enforcing a stricter rule here than the API has
 * would fail CI for a request production would accept, which is the same
 * class of lie as the laxness it replaced: just pointing the other way.
 */
const ALLOWED_EXPANDS: Record<string, string[]> = {
  prices: ['meters', 'priceunit', 'plan', 'addons', 'groups', 'features'],
}

/** The API's own refusal, for an expand the route does not offer. */
function rejectUnknownExpand(key: string, expand: string | undefined) {
  const allowed = ALLOWED_EXPANDS[key]
  if (!allowed || !expand) return null
  const bad = expand
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && !allowed.includes(f))
  if (bad.length === 0) return null
  return HttpResponse.json(
    {
      code: 'validation_error',
      message: 'Field is not allowed to be expanded',
      http_status_code: 400,
      details: { field: bad[0] },
    },
    { status: 400 },
  )
}

const search = (path: string, key: string) =>
  http.post(`${BASE}${path}`, async ({ request }) => {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as SearchBody
    const refused = rejectUnknownExpand(key, body.expand)
    if (refused) return refused
    if (demoEmpty()) return HttpResponse.json(emptyPage(body))
    const source = sourceFor(key)
    // The API's rule: a subscription search that names no status answers active only.
    const wanted =
      key === 'subscriptions'
        ? body.subscription_status?.length
          ? body.subscription_status
          : ['active']
        : undefined
    // As the API: a `metadata` map keeps the rows whose metadata holds every pair.
    const metadata = (body as { metadata?: Record<string, string> }).metadata
    const pairs = metadata ? Object.entries(metadata) : []
    const matching = source.items.filter((row) => {
      if (wanted?.length && !wanted.includes(readString(row, 'subscription_status'))) return false
      if (pairs.length === 0) return true
      const held = (row['metadata'] ?? {}) as Record<string, unknown>
      return pairs.every(([k, v]) => held[k] === v)
    })
    const result = page(
      wanted?.length || pairs.length > 0 ? { ...source, items: matching } : source,
      body,
    )
    const payload =
      key === 'features'
        ? applyFeatureExpand(result, body.expand)
        : key === 'customers'
          ? { ...result, items: result.items.map(withDemoIntegrations) }
          : result
    return HttpResponse.json(payload)
  })

/** Finds one row in a corpus by id: the by-id GET endpoints read it. */
function byId(key: string, id: string): Record<string, unknown> | null {
  return sourceFor(key).items.find((row) => readString(row, 'id') === id) ?? null
}

/**
 * Authored coupon associations, to shape.
 *
 * The corpus has no subscriptions wired to coupons, so "Where used" would be
 * permanently empty. These rows are authored: matching `CouponAssociationResponse`
 * (snake_case, `start_date`/`end_date` as ISO, an open-ended one omitting the
 * end): and returned only for the one coupon below, so the surface is
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
 * `fetch`: but from the console's side they are ordinary endpoints, and
 * mocking them here is what lets `useEnvironments` have exactly one code path
 * instead of a `env.useMocks` branch that only the real build ever exercises.
 *
 * The shape is copied from a live response, keys and all: an `environments`
 * array beside `total`/`offset`/`limit`, `type` as the wire word
 * `development` rather than the product's "sandbox", and the timestamps the
 * API actually sends.
 *
 * Two of them, one of each kind, because the thing worth demonstrating is the
 * switch: and the default-selection rule (prefer the sandbox) has nothing to
 * choose between with a single row.
 */
const PRODUCTION_ENVIRONMENT_ID = 'env_01M020PHF0GF9KP1E9CEVNKJA1'
/** An invoice only Production has (see `GET /invoices/:id`). */
export const PRODUCTION_ONLY_INVOICE = 'inv_01PRODUCTIONONLYDEMO000001'

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
 * catch. `UserResponse` is the exception: it is flat single-word keys with no
 * remapping at all, and it genuinely has **no `created_at` and no `status`**,
 * which is why the members table has no "Joined" column.
 *
 * They are also mutable: invite, rename, role change and delete all write back
 * into these arrays, so a settings screen can be used end to end under mocks
 * rather than merely looked at. Same choice as the environments handler above,
 * for the same reason: a create that only echoes leaves the list disagreeing
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
 * `GET /rbac/roles` answers `{ roles: [...] }`: not the `{items, pagination}`
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
    // Every resource, read and write. Super-admin-only screens (members' roles,
    // tenant settings) still refuse it, as the console's checks do.
    permissions: { '*': ['read', 'write'] },
  },
  {
    id: 'all_reader',
    name: 'Reader',
    description: 'Can see everything and change nothing.',
    permissions: { '*': ['read'] },
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
 * A service account cannot hold every role a person can: `all_writer` is
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
  // Onboarded, as every demo tenant is: Home sends a tenant without this flag to
  // `/onboarding`, which would turn every journey and screenshot into the form.
  metadata: { onboarding_completed: 'true' },
  created_at: '2025-08-11T10:00:00Z',
  updated_at: '2026-09-02T16:30:00Z',
}

/**
 * `localStorage['flexprice.mock.notOnboarded'] = 'true'` plays a brand-new
 * tenant: its metadata reads empty until onboarding saves the flag, so Home
 * sends it to `/onboarding`. Used by `e2e/onboarding.spec.ts`.
 */
const NOT_ONBOARDED_KEY = 'flexprice.mock.notOnboarded'
let onboardedThisSession = false

function tenantAsSeen(): Record<string, unknown> {
  let fresh = false
  try {
    fresh = localStorage.getItem(NOT_ONBOARDED_KEY) === 'true'
  } catch {
    /* no storage: the onboarded demo tenant */
  }
  return fresh && !onboardedThisSession ? { ...tenant, metadata: {} } : tenant
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
 * time: `{id, key, value, environment_id, tenant_id, status, created_at,
 * updated_at, created_by, updated_by}`: and the *payload* is `value`. A mock
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
 * `DELETE` clears the override, so the next `GET` returns the default: which
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
  // `{}`: Flexprice's native engine, off.
  tax_config: {},
  // Off, no slabs: purchased top-ups earn no bonus until slabs are set.
  bonus_credits_topup_config: { enabled: false, slabs: [] },
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
 * Northwind's saved settings: what the demo actually shows.
 *
 * Self-consistent with the rest of this file on purpose: the invoice timezone
 * is the tenant's own (the Profile tab puts it in Portland), and the onboarding
 * action subscribes to a plan that exists in the corpus, so the action names
 * something the console can actually open.
 */
const settingsStore: Record<string, SettingsValue> = {
  // Numbers an invoice "NWS-202609-01001", on net-14 terms: which is what the
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
   * price unit does: `conversion_rate` as a decimal *string*, never a float,
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
        action: 'create_wallet',
        currency: 'usd',
        wallet_type: 'PRE_PAID',
        conversion_rate: '1',
        initial_credits_to_load: '25',
      },
      {
        action: 'create_subscription',
        plan_id: 'plan_synth_0000',
        billing_cycle: 'anniversary',
      },
    ],
    workflow_type: 'customer_onboarding',
  },
  /*
   * Tenant-wide wallet thresholds, in currency rather than percent: the
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
  const customers = ['Northwind Logistics', 'Lumen Analytics', 'Brightpath Health']
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

/** A price sync as the mock runs it: done at once, recorded where the search finds it. */
function startPriceSync(workflowId: string) {
  const runId = `run_${Date.now()}`
  const now = new Date().toISOString()
  workflowRuns.unshift({
    workflow_id: workflowId,
    run_id: runId,
    workflow_type: 'PriceSyncV2Workflow',
    status: 'Completed',
    task_queue: 'billing',
    start_time: now,
    close_time: now,
    duration_ms: 0,
  })
  return {
    message: 'price sync workflow started successfully',
    workflow_id: workflowId,
    run_id: runId,
  }
}

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
  job_config: {
    bucket,
    region,
    key_prefix: prefix,
    compression: index % 2 ? 'gzip' : 'none',
    encryption: 'AES256',
    ...(entity === 'credit_usage'
      ? { export_metadata_fields: [{ entity_type: 'customer', field_key: 'account_manager' }] }
      : {}),
  },
  created_at: new Date(Date.UTC(2026, 1, 1 + index)).toISOString(),
  updated_at: new Date(Date.UTC(2026, 1, 3 + index)).toISOString(),
}))
let scheduledTaskSeq = scheduledTasks.length

/** Each export's runs, newest first: hourly windows for hourly exports, days for daily. */
function exportRuns(task: Record<string, unknown>): Record<string, unknown>[] {
  const hourly = task['interval'] === 'hourly'
  const step = hourly ? 3_600_000 : 86_400_000
  const end = Date.UTC(2026, 9, 20, 0)
  return Array.from({ length: 23 }, (_, index) => {
    const windowEnd = end - index * step
    const status = index === 0 ? 'PROCESSING' : index === 4 ? 'FAILED' : 'COMPLETED'
    return {
      id: `run_${String(task['id'])}_${String(index + 1).padStart(3, '0')}`,
      task_type: 'EXPORT',
      entity_type: task['entity_type'],
      scheduled_task_id: task['id'],
      task_status: status,
      file_url: status === 'COMPLETED' ? `s3://export/${String(task['id'])}/${index}.csv` : '',
      total_records: status === 'COMPLETED' ? 1200 + ((index * 137) % 900) : 0,
      error_summary: status === 'FAILED' ? 'Access denied writing to the bucket' : '',
      metadata: {
        start_time: new Date(windowEnd - step).toISOString(),
        end_time: new Date(windowEnd).toISOString(),
      },
      started_at: new Date(windowEnd + 60_000).toISOString(),
      created_at: new Date(windowEnd + 60_000).toISOString(),
      status: 'published',
    }
  })
}
const manualRuns = new Map<string, Record<string, unknown>[]>()

/**
 * `GET /taxes/rates`, the one settings panel with no handler at all.
 *
 * Without it the request escaped MSW to `mock.flexprice.test` and failed at
 * DNS, so the Taxes tab sat on "Counting your tax rates…" indefinitely: the
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
 * lower-case `"percentage"`: send `"PERCENTAGE"` and zod rejects the whole
 * page, the SDK raises a `ResponseValidationError`, and the screen shows a
 * permission-shaped error titled "OK" (the status text of the 200 it just
 * refused). That is the exact wrong turn this fixture took first.
 *
 * Northwind sells into four jurisdictions and has one rate it has retired.
 */
/** Tax rates attached to entities, mutated by the association handlers. */
/** Forex rates: a global USD → INR and EUR → USD, and one customer override. */
/** Connection keys the API holds but never returns, by connection id. */
const connectionSecrets = new Map<string, Record<string, string>>()

const fxRates: Record<string, unknown>[] = [
  {
    id: 'fxrate_usd_inr',
    scope: 'tenant',
    from_currency: 'usd',
    to_currency: 'inr',
    rate: '83.25',
    source: 'fixed',
    status: 'published',
    updated_at: '2026-10-01T09:00:00Z',
  },
  {
    id: 'fxrate_eur_usd',
    scope: 'tenant',
    from_currency: 'eur',
    to_currency: 'usd',
    rate: '1.08',
    source: 'fixed',
    status: 'published',
    updated_at: '2026-09-12T09:00:00Z',
  },
]

/** Whether an override's window meets another live override for its owner and pair ([start, end), open ends). */
function fxOverlaps(rate: Record<string, unknown>, live: Record<string, unknown>[]) {
  const time = (value: unknown) => (value ? new Date(String(value)).getTime() : undefined)
  const [aStart, aEnd] = [time(rate['start_date']), time(rate['end_date'])]
  return live.some((row) => {
    if (
      row['scope'] !== rate['scope'] ||
      row['scope_id'] !== rate['scope_id'] ||
      row['from_currency'] !== rate['from_currency'] ||
      row['to_currency'] !== rate['to_currency']
    )
      return false
    const [bStart, bEnd] = [time(row['start_date']), time(row['end_date'])]
    if (aStart !== undefined && bEnd !== undefined && aStart >= bEnd) return false
    if (bStart !== undefined && aEnd !== undefined && bStart >= aEnd) return false
    return true
  })
}

/** A refusal in the API's envelope, its hint as the message. */
function fxRefusal(message: string) {
  return HttpResponse.json({ success: false, error: { message } }, { status: 400 })
}

const taxAssociations: Record<string, unknown>[] = []

/**
 * What the contract page's "add" dialogs have created, per subscription, so the
 * tabs show the new row on the refetch. Entitlements and grants are the wire
 * rows the dialogs posted; add-ons and coupons are the association rows the
 * contract page reads back.
 */
const contractAdditions = {
  entitlements: new Map<string, Record<string, unknown>[]>(),
  grants: new Map<string, Record<string, unknown>[]>(),
  addons: new Map<string, Record<string, unknown>[]>(),
  coupons: new Map<string, Record<string, unknown>[]>(),
}

function additionsFor(
  kind: keyof typeof contractAdditions,
  subscriptionId: string,
): Record<string, unknown>[] {
  const rows = contractAdditions[kind].get(subscriptionId) ?? []
  contractAdditions[kind].set(subscriptionId, rows)
  return rows
}

const taxRates: Record<string, unknown>[] = [
  {
    id: 'tax_01M38QTAX00000000000001',
    name: 'US sales tax: Oregon',
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
    name: 'UK VAT: standard',
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
    name: 'EU VAT: reverse charge',
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
 * mocked build the only place that tab ever appears: and would delete the one
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
 * `GET /webhooks/dashboard`: the Svix consumer-portal handoff.
 *
 * The real response carries a **live Svix credential**, which is why the token
 * here is visibly fake. A secret-shaped string in a repository is a secret
 * somebody eventually pastes somewhere, and one that looks real is one nobody
 * checks. `svix_enabled: false` is the other reachable state: a deployment
 * with no Svix configured: but the demo wants the panel populated.
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
 * `GET /tenants/billing`: Flexprice's own bill to Northwind.
 *
 * Note which of these numbers disagree with each other, because that is the
 * point. One entitlement is unlimited (`total_limit: null`: a `?? 0` on it
 * prints "0" as the cap for the most generous plan there is), one sits at 97.4%
 * of its cap so the near-the-limit rendering has something to bite on, and no
 * two rows carry the same figure. Every `usage_percent` is the quotient of the
 * two columns beside it: a fixture whose percentage disagrees with its own
 * usage is how a broken percentage calculation survives review.
 *
 * `sources` is `[]` on every row deliberately: the live response returned it
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
    // back with no period at all, so a reader must omit the line rather than
    // print an epoch. The demo carries one so the populated
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
 * `GET /customers/usage`: one customer's entitlement usage.
 *
 * The same `CustomerUsageSummaryResponse` shape as the `usage` half of
 * `/tenants/billing`, because the API returns literally that model for both.
 * The features are the real ones from the generated features fixture, so a
 * quota card and the feature catalogue name the same things.
 *
 * The rows disagree with each other on purpose, one edge case each:
 *   - API calls     : the ordinary case, comfortably inside its cap.
 *   - Tokens processed: PAST its cap on a soft limit, so the over-quota
 *                        rendering has something to bite on.
 *   - Active users  : unlimited: `total_limit: null`, which a `?? 0` would
 *                      print as "0 of 0" for the most generous grant there is.
 *   - Peak sessions : nothing used yet: a true zero, not a missing figure.
 *   - Seats         : a `static` entitlement, so `next_usage_reset_at` is
 *                      null and the renewal line has nothing to print.
 *
 * Every `usage_percent` is the real quotient of the two columns beside it: a
 * fixture whose percentage disagrees with its own usage is how a broken
 * percentage survives review. `sources` is filled in by the handler from the
 * customer's own contracts, so each row names a real plan and contract.
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
    // A fresh credit is wholly unspent; a debit has nothing left to spend.
    credits_available: credits < 0 ? '0' : String(credits),
    created_at: new Date().toISOString(),
  })
}

/**
 * One wallet with history, authored for the second customer so the first stays
 * empty (the wallet e2e starts from "No wallet yet"). It shows every column of
 * the top-ups table: spent-down credits, ones that never expire, and one that
 * lapses in five days. The API sends no per-product breakdown, so none is seeded.
 */
{
  const day = 86_400_000
  const ago = (days: number) => new Date(Date.now() - days * day).toISOString()
  const ahead = (days: number) => new Date(Date.now() + days * day).toISOString()
  walletStore.push({
    id: 'wal_demo_01',
    customer_id: 'cus_synth_0001',
    currency: 'usd',
    description: 'Prepaid credits',
    conversion_rate: '0.01',
    topup_conversion_rate: '0.009',
    wallet_status: 'active',
    wallet_type: 'PRE_PAID',
    credit_balance: '126000',
    balance: '1260',
    real_time_credit_balance: '118000',
    real_time_balance: '1180',
    auto_topup: { enabled: true, threshold: 20000, amount: 100000, invoicing: true },
    created_at: ago(90),
  })
  const topUp = (
    id: string,
    reason: string,
    description: string,
    credits: number,
    available: number,
    createdDaysAgo: number,
    expiresInDays: number | null,
  ) => ({
    id,
    wallet_id: 'wal_demo_01',
    type: 'credit',
    transaction_reason: reason,
    description,
    credit_amount: String(credits),
    credits_available: String(available),
    amount: String(credits * 0.01),
    currency: 'usd',
    created_at: ago(createdDaysAgo),
    ...(expiresInDays === null ? {} : { expiry_date: ahead(expiresInDays) }),
  })
  walletTransactionStore.push(
    topUp('wtx_demo_4', 'FREE_CREDIT_GRANT', 'Launch promotion', 25000, 25000, 3, 5),
    topUp('wtx_demo_3', 'PURCHASED_CREDIT_INVOICED', 'Invoice INV-0042', 100000, 93000, 12, null),
    topUp('wtx_demo_2', 'SUBSCRIPTION_CREDIT_GRANT', 'Annual commit', 100000, 8000, 45, 60),
    topUp('wtx_demo_1', 'CREDIT_NOTE', 'Billing correction', 20000, 0, 80, null),
  )
}

const contractLineStore = new Map<string, Record<string, unknown>[]>()

/** Per-contract line items the detail mock serves, so charge edits stick until reload. */
function contractLines(id: string, row: Record<string, unknown>): Record<string, unknown>[] {
  const existing = contractLineStore.get(id)
  if (existing) return existing
  const currency = String(row['currency'] ?? 'USD')
  // A real meter from the corpus, so the usage line can be edited like a live one.
  const meterId =
    (corpus['features'] as Corpus).items
      .map((feature) => readString(feature, 'meter_id'))
      .find(Boolean) ?? ''
  const lines: Record<string, unknown>[] = [
    {
      id: `${id}_line_1`,
      display_name: 'Platform fee',
      price_type: 'FIXED',
      entity_type: 'plan',
      quantity: '1',
      billing_period: 'MONTHLY',
      currency,
      price_id: `${id}_price_1`,
      price: { id: `${id}_price_1`, amount: '99.00', currency, billing_model: 'FLAT_FEE' },
      // The real API emits Go's zero time for an open-ended line.
      end_date: '0001-01-01T00:00:00Z',
    },
    {
      id: `${id}_line_2`,
      display_name: 'API usage',
      price_type: 'USAGE',
      entity_type: 'plan',
      quantity: '0',
      billing_period: 'MONTHLY',
      currency,
      price_id: `${id}_price_2`,
      meter_id: meterId,
      price: {
        id: `${id}_price_2`,
        meter_id: meterId,
        type: 'USAGE',
        amount: '0.002',
        currency,
        billing_model: 'FLAT_FEE',
        billing_period: 'MONTHLY',
        invoice_cadence: 'ARREAR',
      },
      end_date: '0001-01-01T00:00:00Z',
    },
  ]
  contractLineStore.set(id, lines)
  return lines
}

/** A line still billing: open-ended (Go's zero time) or ending in the future. */
function lineIsActive(line: Record<string, unknown>): boolean {
  const end = typeof line['end_date'] === 'string' ? Date.parse(line['end_date']) : NaN
  return Number.isNaN(end) || end <= 0 || end > Date.now()
}

const COMMITMENT_KEYS = [
  'commitment_type',
  'commitment_amount',
  'commitment_quantity',
  'commitment_windowed',
  'commitment_overage_factor',
  'commitment_true_up_enabled',
] as const

/** The commitment fields of a line-item request, as the line reports them back. */
function commitmentOf(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    COMMITMENT_KEYS.filter((key) => body[key] !== undefined).map((key) => [
      key,
      typeof body[key] === 'number' ? String(body[key]) : body[key],
    ]),
  )
}

function findContractLine(lineId: string): Record<string, unknown> | undefined {
  for (const lines of contractLineStore.values()) {
    const found = lines.find((line) => line['id'] === lineId)
    if (found) return found
  }
  return undefined
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

/**
 * An invoice as the edit routes see it: its lines materialised (generated rows
 * carry none, and the detail read invents one), and: like the backend: a
 * finalized invoice voided and replaced by a draft copy before it is changed.
 */
function invoiceForEdit(id: string): Record<string, unknown> | null {
  const rows = sourceFor('invoices').items
  const invoice = rows.find((row) => readString(row, 'id') === id)
  if (!invoice) return null
  if (!Array.isArray(invoice['line_items']) || (invoice['line_items'] as unknown[]).length === 0) {
    invoice['line_items'] = [
      {
        id: `${id}_line_1`,
        display_name: 'Platform subscription',
        amount: String(invoice['total'] ?? '0'),
        quantity: '1',
        currency: 'usd',
      },
    ]
  }
  if (readString(invoice, 'invoice_status') !== 'FINALIZED') return invoice
  invoice['invoice_status'] = 'VOIDED'
  const copy = {
    ...invoice,
    id: `${id}_draft`,
    invoice_status: 'DRAFT',
    invoice_number: '',
    line_items: (invoice['line_items'] as Record<string, unknown>[]).map((line, index) => ({
      ...line,
      id: `${id}_draft_line_${index + 1}`,
    })),
  }
  invoice['recalculated_invoice_id'] = copy.id
  rows.unshift(copy)
  return copy
}

/** Totals from what the lines now charge, as the backend recomputes them. */
function recomputeInvoice(invoice: Record<string, unknown>) {
  const lines = (invoice['line_items'] as Record<string, unknown>[] | undefined) ?? []
  const total = lines.reduce((sum, line) => sum + Number(readString(line, 'amount') || '0'), 0)
  const paid = Number(readString(invoice, 'amount_paid') || '0')
  invoice['subtotal'] = total.toFixed(2)
  invoice['total'] = total.toFixed(2)
  invoice['amount_due'] = total.toFixed(2)
  invoice['amount_remaining'] = Math.max(0, total - paid).toFixed(2)
}

/** The embedded meter a usage price carries under `expand=meters`, from the features that own it. */
function meterOf(meterId: string): Record<string, unknown> | null {
  for (const feature of (corpus['features'] as Corpus).items) {
    const meter = (feature as Record<string, unknown>)['meter'] as
      Record<string, unknown> | undefined
    if (meter && readString(meter, 'id') === meterId) return meter
  }
  return null
}

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) return amount
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(value)
  } catch {
    return amount
  }
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
 * fixtures: those descend from real API responses and six other surfaces read
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

/** Midnight UTC, `daysAgo` days back: the grid every recent-activity mock sits on. */
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
 * Billed revenue for the overview: each of the first few customers bills a
 * fixed fee spread evenly over the days and a wobbling usage amount per day,
 * in USD. Both revenue routes read this one generator, so the dashboard's
 * totals and the daily series always agree.
 */
const REVENUE_CUSTOMERS = 6

function revenueDays(start: Date, end: Date) {
  const customers = (corpus['customers'] as Corpus).items.slice(0, REVENUE_CUSTOMERS)
  const days: { day: string; customer: Record<string, unknown>; fixed: number; usage: number }[] =
    []
  const first = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  for (let cursor = first; cursor < end.getTime() && days.length < 4000; cursor += DAY_MS) {
    const day = new Date(cursor).toISOString().slice(0, 10)
    customers.forEach((customer, index) => {
      const fixed = Math.round(((200 + index * 150) / 30) * 100) / 100
      const usage =
        Math.round((40 + index * 25) * (0.6 + 0.8 * noise(`rev:${index}:${day}`)) * 100) / 100
      days.push({ day, customer, fixed, usage })
    })
  }
  return days
}

const cents = (value: number) => (Math.round(value * 100) / 100).toFixed(2)

/**
 * The analytics response for one window.
 *
 * Each point is the feature's daily rate scaled to the bucket and wobbled by a
 * seeded amount; the item totals are sums of those points, and the subtotal is
 * each item's usage priced at that feature's rate. Nothing is asserted that is
 * not computed from something else here.
 */
function usageAnalytics(
  startTime: Date,
  endTime: Date,
  windowSize: string,
  featureIds: readonly string[] = [],
) {
  const step = WINDOW_MS[windowSize] ?? DAY_MS
  const buckets: number[] = []
  for (
    let cursor = startTime.getTime();
    cursor < endTime.getTime() && buckets.length < 400;
    cursor += step
  ) {
    buckets.push(cursor)
  }

  const chosen = ANALYTICS_FEATURES.filter(
    (feature) => featureIds.length === 0 || featureIds.includes(feature.id),
  )
  const items = chosen.map((feature) => {
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

    const totalUsage = points.reduce((sum, point) => sum + Number(point.usage), 0)
    // The item's own price: what this usage bills at, as the API reports it.
    const billed = (totalUsage * feature.rate).toFixed(2)
    return {
      feature_id: feature.id,
      meter_id: `meter_${feature.id}`,
      event_name: feature.eventName,
      feature: feature.row,
      event_count: points.reduce((sum, point) => sum + point.event_count, 0),
      total_usage: String(totalUsage),
      subtotal: billed,
      total_cost: billed,
      currency: 'USD',
      points,
    }
  })

  const subtotal = items.reduce((sum, item) => sum + Number(item.total_cost), 0)

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
    // the rows: a modest number nobody chose: rather than a headline figure
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
 * Northwind's own default is net-14: `settingsStore.invoice_config` sets
 * `due_date_days: 14`, and the Invoice settings tab shows it: but terms are
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
 * split: 34 paid, 15 open, 7 overdue: which made every window over it the
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
       * one repeated, and with no two of paid/open/overdue equal in either:
       * the coincidence that looks exactly like a copy-paste bug.
       */
      const settledOdds = 0.42 + (Math.min(daysAgo, 35) / 35) * 0.5
      const settled = noise(`settled:${daysAgo}:${index}`) < settledOdds

      // Clean, plausible amounts: the captured corpus carries some synthesized
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
/**
 * The contract-level commitment the first captured contract carries, so the
 * detail page has one to show: $250 a month, a 1.2× overage premium, true-up on.
 * The captured corpus has none, and the usage mock reads it from here.
 */
const COMMITTED_SUBSCRIPTION_ID = 'subs_synth_0000'
const CONTRACT_COMMITMENT = {
  commitment_amount: '250',
  commitment_duration: 'MONTHLY',
  overage_factor: '1.2',
  enable_true_up: true,
}

/** The mock's trialing contract; see the subscriptions corpus below. */
const TRIALING_SUBSCRIPTION_ID = 'subs_01MOCKTRIALING0000000001'

/** Each report's seeded figure for the mock report library. */
const REPORT_BASE: Record<string, number> = {
  invoice_total: 412_000,
  invoice_total_issued: 409_000,
  net_billing: 399_000,
  net_billing_issued: 397_000,
  total_receivables: 121_460,
  receivables_aging: 60_000,
  days_to_pay: 16.4,
  active_customers: 172,
  arpu: 2_630,
  arpu_paid: 2_410,
  credit_consumption: 52_000,
  credit_topups: 61_000,
  events_volume: 18_400_000,
}
/** Reports the API compares with the previous period. */
const REPORT_COMPARES = new Set([
  'invoice_total',
  'invoice_total_issued',
  'days_to_pay',
  'arpu',
  'arpu_paid',
  'credit_topups',
])

const DASHBOARD_CORPUS: Record<string, Corpus> = {
  subscriptions: (() => {
    const extra = recentSubscriptionRows()
    const base = corpus.subscriptions as Corpus
    const items = base.items.map((item) =>
      readString(item, 'id') === COMMITTED_SUBSCRIPTION_ID
        ? { ...item, ...CONTRACT_COMMITMENT }
        : item,
    )
    // One trialing contract, so a search that forgets subscription_status (the
    // API then answers active only) loses it here as it does live.
    const first = items[0]
    const trialing = first
      ? [
          {
            ...first,
            id: TRIALING_SUBSCRIPTION_ID,
            subscription_status: 'trialing',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ]
      : []
    return {
      items: [...extra, ...items, ...trialing],
      pagination: {
        ...base.pagination,
        total: base.pagination.total + extra.length + trialing.length,
      },
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

/**
 * Prices, held as a mutable copy of the corpus.
 *
 * A plan's Charges tab refetches the prices search after every add, edit and
 * terminate. If the mutations only echoed, the list would not change and the
 * flow would look broken in mock mode; so they write here and the search reads
 * from here.
 */
const priceCorpus: Corpus = (() => {
  const base = corpus.prices as Corpus
  return { items: [...base.items], pagination: { ...base.pagination } }
})()

function sourceFor(key: string): Corpus {
  if (key === 'prices') return priceCorpus
  return DASHBOARD_CORPUS[key] ?? (corpus[key] as Corpus)
}

export const handlers = [
  // Price sync: starts a workflow and answers its handle, as the API does. The
  // run lands in the workflow search already finished, so the console's watch
  // sees it complete on its first read.
  http.post(`${BASE}/plans/:id/sync/subscriptions`, ({ params }) =>
    HttpResponse.json(startPriceSync(`sync-plan-${String(params['id'])}`)),
  ),
  http.post(`${BASE}/addons/:id/sync/subscriptions`, ({ params }) =>
    HttpResponse.json(startPriceSync(`sync-addon-${String(params['id'])}`)),
  ),
  // The Svix API behind the webhook portal: see `svixHandlers.ts`.
  ...svixHandlers,
  // Self-billing, off unless a mock account state is picked: see `selfBillingHandlers.ts`.
  ...selfBillingHandlers,

  // Sample events: the backend accepts the request and streams later. The
  // console only waits for this 200.
  http.post(`${BASE}/portal/onboarding/events`, () => HttpResponse.json({})),

  // Environments. Unlike the create handlers further down: which echo the
  // record back and leave the corpus alone: this one appends, because the
  // console switches to what you just created and then refetches the list. An
  // echo-only mock would switch to an id the next list does not contain, and
  // the hook would correctly treat it as stale and bounce you back out.
  http.get(`${BASE}/environments`, () => {
    // A self-billing trial (or a locked one) has no production yet: paying
    // creates it, as the API does on activation. Self-billing off, or live,
    // lists everything.
    const state = mockAccountState()
    const preProduction = state !== null && state !== 'active' && state !== 'due'
    const listed = preProduction
      ? environments.filter((environment) => environment['type'] !== 'production')
      : environments
    return HttpResponse.json({
      environments: listed,
      total: listed.length,
      offset: 0,
      limit: 50,
    })
  }),
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
  // Copy environment: the API queues a workflow and answers 202. Into a new
  // environment it creates that first, so the mock does too.
  http.post(`${BASE}/environments/:id/clone`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const source = environments.find((environment) => environment['id'] === params['id'])
    if (!source) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const target = readString(body, 'target_environment_id')
    if (target) {
      if (target === params['id']) {
        return HttpResponse.json(
          { code: 'validation_error', message: 'target environment cannot be the source' },
          { status: 400 },
        )
      }
    } else {
      const name = readString(body, 'name')
      if (!name) {
        return HttpResponse.json(
          { code: 'validation_error', message: 'name is required' },
          { status: 400 },
        )
      }
      environments.push({
        id: `env_mock_${Date.now()}`,
        name,
        type: readString(body, 'type') || 'development',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    return HttpResponse.json(
      { workflow_id: `env-clone-${Date.now()}`, run_id: 'run_mock' },
      { status: 202 },
    )
  }),
  // Rename, from the switcher. Mutates in place for the same reason create
  // appends: the console refetches the list straight after.
  http.put(`${BASE}/environments/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const row = environments.find((environment) => environment['id'] === params['id'])
    if (!row) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const name = readString(body, 'name')
    if (name) row['name'] = name
    row['updated_at'] = new Date().toISOString()
    return HttpResponse.json(row)
  }),

  // The mock demo login. `POST /auth/login` takes `{ email, password }` and, on
  // the live API, returns `{ token, user_id, tenant_id }`: the snake_case keys
  // `toCredentials` in `@fp/api` reads and maps to `{ token, userId, tenantId }`.
  // The demo account is the only one that succeeds; every other credential gets
  // the API's wrong-password answer, a 403 whose `code`/`message`/`http_status_code`
  // shape `messageForSignInError` collapses to "That email and password do not
  // match." Under mocks the fixtures are served regardless of the bearer token,
  // so any valid session is all the route guard needs: this just mints one.
  /*
   * `GET /auth/capabilities`: what this deployment offers at sign-in.
   *
   * The fixture answers password-only, which is also what `fetchAuthCapabilities`
   * falls back to when the call fails. The two agreeing is deliberate: the mock
   * build and a live backend that has not shipped the endpoint yet must show the
   * same sign-in screen, or the fixtures would be demonstrating a console nobody
   * can actually run.
   */
  http.get(`${BASE}/auth/capabilities`, () =>
    HttpResponse.json({
      provider: 'flexprice',
      password: { enabled: true, min_length: 8 },
      signup: { enabled: true },
      password_reset: { enabled: false },
      saml: { enabled: false },
      oauth: { google: false },
    }),
  ),

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

  // Sign-up mints the same demo session, so a new account lands in the fixtures.
  // The demo address is taken, which is how the "already exists" answer is reached.
  http.post(`${BASE}/auth/signup`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    if (body.email === 'demo@flexprice.io') {
      return HttpResponse.json({ error: { message: 'user already exists' } }, { status: 409 })
    }
    return HttpResponse.json({
      token: 'mock_demo_token',
      user_id: 'user_demo',
      tenant_id: 'tenant_demo',
    })
  }),

  /*
   * Billed revenue: `POST /dashboard/revenue-dashboard` (totals per currency
   * and customer) and `POST /analytics/revenue` (net revenue per day, grouped
   * by currency), both read from `revenueDays`.
   */
  /*
   * The analytics report library: `POST /analytics/reports/{key}/query`.
   * Answers in the API's table form: a `bucket` (timeseries) or dimension
   * column, `currency`, the metric named after the report, and `{key}_prev` /
   * `{key}_change_pct` when compared. Figures are seeded per report and
   * bucket, and customers are real ones from the corpus so names resolve.
   */
  http.post(`${BASE}/analytics/reports/:key/query`, async ({ params, request }) => {
    const key = String(params['key'])
    const body = (await request.json().catch(() => ({}))) as {
      shape?: string
      range?: string
      dimensions?: string[]
      grain?: string
      currency?: string
      compare?: string
      limit?: number
      offset?: number
    }
    const base = REPORT_BASE[key]
    if (base === undefined) {
      return HttpResponse.json({ message: `report "${key}" not found` }, { status: 404 })
    }
    const compare = Boolean(body.compare) && REPORT_COMPARES.has(key)
    const metric = [
      { name: key, type: 'decimal', role: 'metric' },
      ...(compare
        ? [
            { name: `${key}_prev`, type: 'decimal', role: 'metric' },
            { name: `${key}_change_pct`, type: 'decimal', role: 'metric' },
          ]
        : []),
    ]
    const values = (now: number, before: number) =>
      compare
        ? [
            now.toFixed(2),
            before.toFixed(2),
            before === 0 ? '' : (((now - before) / before) * 100).toFixed(1),
          ]
        : [now.toFixed(2)]
    const currencyCol =
      key === 'events_volume' ? [] : [{ name: 'currency', type: 'string', role: 'dimension' }]
    const currency = key === 'events_volume' ? [] : [body.currency || 'usd']
    const [from, to] = (body.range ?? '').split('..')
    const start = from ? new Date(`${from}T00:00:00Z`) : new Date(Date.now() - 90 * DAY_MS)
    const end = to ? new Date(`${to}T00:00:00Z`) : new Date()
    const meta = { query_source: 'mock', from: start.toISOString(), to: end.toISOString() }
    // The API's `max_range_days`: the events report answers a week at most.
    if (key === 'events_volume' && (end.getTime() - start.getTime()) / DAY_MS > 7) {
      return HttpResponse.json(
        {
          code: 'validation_error',
          message: 'range exceeds 7 days for this report',
          http_status_code: 400,
        },
        { status: 400 },
      )
    }

    if (body.shape === 'timeseries') {
      const step =
        body.grain === 'month' ? 30 * DAY_MS : body.grain === 'week' ? 7 * DAY_MS : DAY_MS
      const rows: string[][] = []
      for (let t = start.getTime(); t < end.getTime() && rows.length < 400; t += step) {
        // A ratio (days to pay, ARPU) is the same size per bucket; a flow scales with its width.
        const ratio = key === 'days_to_pay' || key === 'arpu' || key === 'arpu_paid'
        const now =
          (ratio ? base : (base / 30) * (step / DAY_MS)) * (0.75 + 0.5 * noise(`${key}:${t}`))
        const before = now * (0.85 + 0.2 * noise(`${key}:prev:${t}`))
        rows.push([new Date(t).toISOString(), ...currency, ...values(now, before)])
      }
      return HttpResponse.json({
        columns: [
          { name: 'bucket', type: 'datetime', role: 'dimension' },
          ...currencyCol,
          ...metric,
        ],
        rows,
        meta,
      })
    }

    if (body.shape === 'breakdown') {
      const dims = body.dimensions?.length ? body.dimensions : ['customer_id']
      // The customers the customer search answers with, so their names resolve.
      const pagedCustomers = key === 'invoice_total' && dims.join() === 'customer_id'
      const customers = sourceFor('customers')
        .items.slice(0, pagedCustomers ? 60 : 8)
        .map((row) => readString(row, 'id'))
      const labels: Record<string, string[]> = {
        customer_id: customers,
        aging_bucket: ['Current', '1-30', '31-60', '61-90', '90+'],
        invoice_type: ['SUBSCRIPTION', 'ONE_OFF'],
        meter_id: ['meter_api', 'meter_storage'],
        credit_type: ['paid', 'free'],
        transaction_reason: ['PURCHASED_CREDIT_DIRECT', 'FREE_CREDIT_GRANT'],
      }
      const combos = dims.reduce<string[][]>(
        (acc, dim) => acc.flatMap((prefix) => (labels[dim] ?? ['a']).map((v) => [...prefix, v])),
        [[]],
      )
      // Shares of the report's total, so the parts add up to the whole.
      const weights = combos.map(
        (combo, i) => (1 / (i + 1)) * (0.6 + 0.8 * noise(`${key}:${combo.join('|')}`)),
      )
      const sum = weights.reduce((total, weight) => total + weight, 0) || 1
      const rows = combos
        .map((combo, i) => {
          // A ratio (days to pay) is per row, not a share of a total.
          const now =
            key === 'days_to_pay'
              ? base * (0.6 + 0.8 * noise(`${key}:${combo.join('|')}`))
              : (base * (weights[i] ?? 0)) / sum
          return { now, row: [...combo, ...currency, ...values(now, now * 0.9)] }
        })
        .sort((a, b) => b.now - a.now)
        .slice(body.offset ?? 0, (body.offset ?? 0) + (body.limit ?? 500))
        .map((entry) => entry.row)
      return HttpResponse.json({
        columns: [
          ...dims.map((name) => ({ name, type: 'string', role: 'dimension' })),
          ...currencyCol,
          ...metric,
        ],
        rows,
        meta,
      })
    }

    // Scalar: one row per currency when none was asked for, the one asked for otherwise.
    const rows = body.currency
      ? [[body.currency, ...values(base, base * 0.91)]]
      : [
          ['usd', ...values(base, base * 0.91)],
          ['eur', ...values(base * 0.18, base * 0.2)],
        ]
    return HttpResponse.json({ columns: [...currencyCol, ...metric], rows, meta })
  }),

  http.post(`${BASE}/dashboard/revenue-dashboard`, async ({ request }) => {
    if (demoEmpty()) return HttpResponse.json({ summaries: {}, items: [] })
    const body = (await request.json().catch(() => ({}))) as {
      period_start?: string
      period_end?: string
    }
    const days = revenueDays(
      new Date(body.period_start ?? Date.now() - 7 * DAY_MS),
      new Date(body.period_end ?? Date.now()),
    )
    const byCustomer = new Map<
      string,
      { customer: Record<string, unknown>; fixed: number; usage: number }
    >()
    for (const row of days) {
      const id = readString(row.customer, 'id')
      const entry = byCustomer.get(id) ?? { customer: row.customer, fixed: 0, usage: 0 }
      entry.fixed += row.fixed
      entry.usage += row.usage
      byCustomer.set(id, entry)
    }
    const items = [...byCustomer.values()].map(({ customer, fixed, usage }) => ({
      customer_id: readString(customer, 'id'),
      customer_name: readString(customer, 'name'),
      external_customer_id: readString(customer, 'external_id'),
      currency: 'usd',
      total_revenue: cents(fixed + usage),
      total_usage_revenue: cents(usage),
      total_fixed_revenue: cents(fixed),
    }))
    const fixed = [...byCustomer.values()].reduce((sum, entry) => sum + entry.fixed, 0)
    const usage = [...byCustomer.values()].reduce((sum, entry) => sum + entry.usage, 0)
    return HttpResponse.json({
      summaries:
        items.length > 0
          ? {
              usd: {
                total_revenue: cents(fixed + usage),
                total_usage_revenue: cents(usage),
                total_fixed_revenue: cents(fixed),
              },
            }
          : {},
      items,
    })
  }),
  http.post(`${BASE}/analytics/revenue`, async ({ request }) => {
    if (demoEmpty()) return HttpResponse.json({ rows: [] })
    const body = (await request.json().catch(() => ({}))) as {
      start_time?: string
      end_time?: string
    }
    const days = revenueDays(
      new Date(body.start_time ?? Date.now() - 7 * DAY_MS),
      new Date(body.end_time ?? Date.now()),
    )
    const byDay = new Map<string, number>()
    for (const row of days) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.fixed + row.usage)
    return HttpResponse.json({
      rows: [...byDay.entries()].map(([day, amount]) => ({
        day,
        group: { currency: 'usd', revenue_source: 'all' },
        net_amount: Math.round(amount * 100) / 100,
      })),
    })
  }),

  /*
   * Usage analytics: the overview's event series, revenue and per-feature
   * usage. `POST /events/analytics`, the path `client.events.getUsageAnalytics`
   * posts to. Answers snake_case, as the live API does; the SDK's inbound
   * schema is what turns it camelCase again.
   *
   * An empty tenant answers `items: []` and **no subtotal**: not a zero.
   * "Nothing has been ingested" and "this usage was worth nothing" are
   * different sentences, and the panel renders them differently.
   */
  http.post(`${BASE}/events/analytics`, async ({ request }) => {
    if (demoEmpty()) return HttpResponse.json({ items: [] })

    const body = (await request.json().catch(() => ({}))) as {
      start_time?: string
      end_time?: string
      window_size?: string
      feature_ids?: string[]
    }
    const endTime = body.end_time ? new Date(body.end_time) : new Date()
    const startTime = body.start_time
      ? new Date(body.start_time)
      : new Date(endTime.getTime() - 7 * DAY_MS)

    return HttpResponse.json(
      usageAnalytics(startTime, endTime, body.window_size ?? 'DAY', body.feature_ids ?? []),
    )
  }),

  /*
   * Cost analytics: revenue against what the usage cost to serve, from the
   * cost sheet. `POST /costs/analytics`. Built from the same usage the usage
   * analytics answers, with each meter costing a fixed share of what it bills,
   * so the two reads agree.
   */
  http.post(`${BASE}/costs/analytics`, async ({ request }) => {
    if (demoEmpty()) return HttpResponse.json({ cost_analytics: [] })
    const body = (await request.json().catch(() => ({}))) as {
      start_time?: string
      end_time?: string
      feature_ids?: string[]
    }
    const endTime = body.end_time ? new Date(body.end_time) : new Date()
    const startTime = body.start_time
      ? new Date(body.start_time)
      : new Date(endTime.getTime() - 7 * DAY_MS)
    const usage = usageAnalytics(startTime, endTime, 'DAY', body.feature_ids ?? [])
    const costAnalytics = usage.items.map((item, index) => ({
      meter_id: item.meter_id,
      total_cost: (Number(item.total_cost) * [0.42, 0.35, 0.5, 0.28][index % 4]!).toFixed(2),
      total_quantity: item.total_usage,
      total_events: item.event_count,
      currency: 'USD',
    }))
    const totalCost = costAnalytics.reduce((sum, item) => sum + Number(item.total_cost), 0)
    const revenue = Number(usage.subtotal)
    const margin = revenue - totalCost
    return HttpResponse.json({
      currency: 'USD',
      total_revenue: revenue.toFixed(2),
      total_cost: totalCost.toFixed(2),
      margin: margin.toFixed(2),
      margin_percent: revenue > 0 ? ((margin / revenue) * 100).toFixed(2) : '0',
      cost_analytics: costAnalytics,
    })
  }),

  search('/customers/search', 'customers'),

  /*
   * Entitlement usage for one customer.
   *
   * **Must stay above `/customers/:id`**: the customer is a query parameter
   * here, not a path segment, so `:id` would otherwise match the literal
   * "usage" and answer a 404 for it.
   */
  http.get(`${BASE}/customers/usage`, ({ request }) => {
    const params = new URL(request.url).searchParams
    const customerId = params.get('customer_id') ?? ''
    // `subscription_ids` narrows to those contracts' grants, however the
    // client spells an array: repeated keys or one comma-separated value.
    const subscriptionIds = params
      .getAll('subscription_ids')
      .flatMap((value) => value.split(','))
      .filter(Boolean)
    // Unknown customers get an empty summary, not the demo rows: a customer
    // with no entitlements and a customer that does not exist both have no
    // quotas to show, and neither should borrow somebody else's.
    const known = byId('customers', customerId) !== null
    // Each row is granted by the plan of one of the customer's contracts, so
    // the Source column names a real plan and links to a real contract.
    const contracts = sourceFor('subscriptions').items.filter(
      (row) =>
        readString(row, 'customer_id') === customerId &&
        (subscriptionIds.length === 0 || subscriptionIds.includes(readString(row, 'id'))),
    )
    const features =
      known && contracts.length > 0
        ? customerUsage.features.map((feature, index) => {
            const contract = contracts[index % contracts.length]!
            const plan = (contract['plan'] ?? {}) as Record<string, unknown>
            return {
              ...feature,
              sources: [
                {
                  subscription_id: readString(contract, 'id'),
                  entity_id: readString(contract, 'plan_id'),
                  entity_type: 'plan',
                  entity_name: readString(plan, 'name') || readString(contract, 'plan_id'),
                  usage_reset_period: feature.next_usage_reset_at ? 'MONTHLY' : 'NEVER',
                  is_enabled: true,
                },
              ],
            }
          })
        : []
    return HttpResponse.json({ ...customerUsage, customer_id: customerId, features })
  }),

  // A single customer, for the detail page. The corpus rows already carry the
  // fuller record (address, timezone, tax treatment, metadata), so the by-id GET
  // just returns the row the SDK then camelCases.
  // The audit trail (`POST /activity`). The corpus keeps no log, so each record
  // in scope contributes its creation, newest first. Without a handler the
  // request fell through to the network and the rail sat on "Loading
  // activity…" until the retries gave up: and the failure re-rendered the page.
  http.post(`${BASE}/activity`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      customer_id?: string
      entity_type?: string
      entity_id?: string
      start_time?: string
      end_time?: string
      actor_types?: string[]
      actions?: string[]
      request_id?: string
      cursor?: string
      limit?: number
    }
    // As the API: at most 50 with state, and an unknown action is refused.
    const limit = Math.min(body.limit ?? 20, 50)
    if ((body.actions ?? []).some((action) => !/^[a-z_]+\.[a-z_]+$/.test(action))) {
      return HttpResponse.json(
        { code: 'validation_error', message: 'Unknown action.' },
        { status: 400 },
      )
    }
    const records: { type: string; row: Record<string, unknown>; label: string }[] = []
    const add = (type: string, row: Record<string, unknown> | undefined | null, label: string) => {
      if (row) records.push({ type, row, label: label || readString(row, 'id') })
    }
    const subscriptionRows = sourceFor('subscriptions').items
    const invoiceRows = sourceFor('invoices').items
    if (body.customer_id) {
      const customer = byId('customers', body.customer_id)
      add('customer', customer, customer ? readString(customer, 'name') : '')
      for (const row of subscriptionRows.filter(
        (r) => readString(r, 'customer_id') === body.customer_id,
      )) {
        add('subscription', row, readString(row, 'id'))
      }
      for (const row of invoiceRows.filter(
        (r) => readString(r, 'customer_id') === body.customer_id,
      )) {
        add('invoice', row, readString(row, 'invoice_number'))
      }
    } else if (body.entity_type && body.entity_id) {
      const id = body.entity_id
      const row =
        body.entity_type === 'subscription'
          ? subscriptionRows.find((r) => readString(r, 'id') === id)
          : body.entity_type === 'invoice'
            ? (byId('invoices', id) ?? invoiceRows.find((r) => readString(r, 'id') === id))
            : body.entity_type === 'customer'
              ? byId('customers', id)
              : undefined
      add(
        body.entity_type,
        row,
        row ? readString(row, body.entity_type === 'invoice' ? 'invoice_number' : 'name') : '',
      )
    }
    // Who made each change, as the real log records it: a person in the
    // dashboard for a customer, the billing workflow for an invoice, the
    // system for anything else.
    const actorFor = (type: string) =>
      type === 'customer'
        ? {
            actor: { type: 'user', id: 'user_demo', label: 'demo@flexprice.io' },
            source: 'dashboard',
          }
        : type === 'invoice'
          ? {
              actor: { type: 'system', id: 'billing', label: 'Billing workflow' },
              source: 'workflow',
            }
          : { actor: { type: 'system' }, source: 'dashboard' }
    const from = body.start_time ? Date.parse(body.start_time) : Number.NEGATIVE_INFINITY
    const to = body.end_time ? Date.parse(body.end_time) : Number.POSITIVE_INFINITY
    const all = records
      .filter(({ row }) => readString(row, 'created_at') !== '')
      .map(({ type, row, label }) => {
        const id = readString(row, 'id')
        const { actor, source } = actorFor(type)
        return {
          id: `act_${type}_${id}`,
          action: `${type}.created`,
          occurred_at: readString(row, 'created_at'),
          source,
          entity: { id, type, label },
          ...(body.customer_id ? { customer_id: body.customer_id } : {}),
          actor,
          ...(source === 'dashboard' && actor.type === 'user'
            ? {
                request_id: `req_${id.slice(-12)}`,
                ip: '203.0.113.24',
                user_agent:
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
              }
            : {}),
          state: row,
        }
      })
      .filter((item) => {
        const at = Date.parse(item.occurred_at)
        return (
          at >= from &&
          at < to &&
          (!body.actions?.length || body.actions.includes(item.action)) &&
          (!body.actor_types?.length || body.actor_types.includes(item.actor.type)) &&
          (!body.request_id || ('request_id' in item && item.request_id === body.request_id))
        )
      })
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || a.id.localeCompare(b.id))
    // An opaque cursor, as the API's: here, the offset of the next page.
    const offset = body.cursor ? Number(atob(body.cursor)) || 0 : 0
    const items = all.slice(offset, offset + limit)
    const hasMore = offset + limit < all.length
    return HttpResponse.json({
      items,
      pagination: {
        limit,
        next_cursor: hasMore ? btoa(String(offset + limit)) : null,
        has_more: hasMore,
      },
    })
  }),

  /*
   * `GET /customers/portal/{external_id}`: a portal session. The token is
   * what the portal mocks accept (anything but "expired"), so "Open customer
   * portal" lands on a working portal.
   */
  http.get(`${BASE}/customers/portal/:externalId`, ({ params }) =>
    HttpResponse.json({
      url: `https://portal.example/?token=demo-${String(params['externalId'])}`,
      token: `demo-${String(params['externalId'])}`,
      expires_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    }),
  ),
  http.get(`${BASE}/customers/:id`, ({ params }) => {
    const customer = byId('customers', String(params['id']))
    return customer
      ? HttpResponse.json(withDemoIntegrations(customer))
      : HttpResponse.json({ message: 'Customer not found' }, { status: 404 })
  }),

  // A customer's subscriptions, keyed by the *external* id (the endpoint the SDK
  // calls). The external id resolves to the internal customer, then the
  // subscriptions are scoped to it: each row keeps its embedded plan and
  // customer, so the table shows plan names rather than ids.
  http.get(`${BASE}/customers/external/:externalId/subscriptions`, ({ params, request }) => {
    // The real endpoint refuses any expand (400 "Field is not allowed to be
    // expanded"); mirror it so a caller that adds one fails here, not in prod.
    if (new URL(request.url).searchParams.has('expand'))
      return HttpResponse.json(
        { code: 'validation_error', message: 'Field is not allowed to be expanded' },
        { status: 400 },
      )
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
  // Like the API, an ended price is left out unless `allow_expired_prices` asks for it.
  http.post(`${BASE}/prices/search`, async ({ request }) => {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as SearchBody & {
      allow_expired_prices?: boolean
    }
    const refused = rejectUnknownExpand('prices', body.expand)
    if (refused) return refused
    if (demoEmpty()) return HttpResponse.json(emptyPage(body))
    const source = sourceFor('prices')
    const live = (row: Record<string, unknown>) => {
      const end = Date.parse(readString(row, 'end_date'))
      return Number.isNaN(end) || end <= 0 || end > Date.now()
    }
    const items = body.allow_expired_prices ? source.items : source.items.filter(live)
    return HttpResponse.json(
      page({ ...source, items, pagination: { ...source.pagination, total: items.length } }, body),
    )
  }),
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
    const destinationId = url.searchParams.get('destination_id')
    if (destinationId) {
      const items = [
        ...paymentStore.filter((row) => readString(row, 'destination_id') === destinationId),
        ...invoicePayments(destinationId),
      ]
      return HttpResponse.json({
        items,
        pagination: { total: items.length, limit: window.limit, offset: window.offset },
      })
    }
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
    if (processed) applyPaymentToInvoice(row)
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
    const response = patchRow(paymentStore, id, {
      payment_status: 'SUCCEEDED',
      succeeded_at: new Date().toISOString(),
      attempts: [{ id: 'att_1', attempt_number: 1 }],
    })
    const processed = paymentStore.find((row) => readString(row, 'id') === id)
    if (processed) applyPaymentToInvoice(processed)
    return response
  }),
  http.delete(`${BASE}/payments/:id`, ({ params }) => {
    removeRow(paymentStore, String(params['id']))
    return HttpResponse.json({ message: 'Payment deleted' })
  }),

  // Charges and entitlements, scoped by entity: the plan detail page's tabs.
  search('/entitlements/search', 'entitlements'),

  /*
   * ---- Settings ---------------------------------------------------------
   *
   * `/users/me` and `/users/:id` are registered in that order on purpose: MSW
   * matches in registration order, and `:id` would otherwise swallow `me` and
   * try to rename the current user to whatever a role update sent.
   */

  /*
   * Who is signed in. The demo user (super admin) unless
   * `localStorage['flexprice.mock.userId']` names another mock user: how a
   * reader's or writer's console is checked by hand and in e2e.
   */
  http.get(`${BASE}/users/me`, () => {
    let id: string | null = null
    try {
      id = localStorage.getItem('flexprice.mock.userId')
    } catch {
      /* no storage: the demo user */
    }
    return HttpResponse.json(users.find((user) => user['id'] === id) ?? users[0])
  }),

  /*
   * `POST /users/search` honours `type` and the paging window, and **ignores
   * `filters` and `roles`**: because the real endpoint does. Verified live: a
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
    // A person gets a one-time password, returned once; a service account does not.
    return HttpResponse.json(
      type === 'user' ? { ...created, password: `Tmp-${Date.now().toString(36)}!` } : created,
      { status: 201 },
    )
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
    // As the live API: without X-Environment-ID the request is refused. This
    // is what made a fresh load read "Access denied" before an environment
    // was chosen; the console must not ask before it has one.
    if (!request.headers.get('X-Environment-ID')) {
      return HttpResponse.json(
        { error: { message: 'X-Environment-ID header is required' } },
        { status: 403 },
      )
    }
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
   * `@flexprice/sdk@2.1.30` requests `GET /v1/tenant/billing`: singular: and
   * the deployed route is `GET /v1/tenants/billing`. So the singular path
   * answers 404 here too, exactly as it does live (same `text/plain` body).
   *
   * Serving the data from the singular path instead would make the mocked build
   * the only place this screen has ever worked, and would quietly delete the
   * one bug this panel exists to report. The plural handler below is where the
   * data lives, ready for the day the OpenAPI path gains its `s`: nothing
   * requests it today.
   */
  http.get(`${BASE}/tenant/billing`, () =>
    HttpResponse.text('404 page not found', { status: 404 }),
  ),
  http.get(`${BASE}/tenants/billing`, () => HttpResponse.json(tenantBilling)),

  http.get(`${BASE}/tenants/:id`, ({ params }) =>
    String(params['id']) === TENANT_ID
      ? HttpResponse.json(tenantAsSeen())
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
    // Replaced whole, as the API does: the caller sends every key it keeps.
    if (body['metadata'] && typeof body['metadata'] === 'object') {
      tenant['metadata'] = body['metadata']
      const metadata = body['metadata'] as Record<string, unknown>
      if (metadata['onboarding_completed'] === 'true') onboardedThisSession = true
    }
    tenant['updated_at'] = new Date().toISOString()
    return HttpResponse.json(tenant)
  }),

  // `/alerts/setting`: plural noun, singular setting. That is the real path.
  http.post(`${BASE}/alerts/setting/search`, async ({ request }) => {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as {
      entity_type?: string
      parent_entity_id?: string
      entity_id?: string
      enabled?: boolean
      status?: string
      limit?: number
      offset?: number
    }
    let rows = [...alertSettings]
    // As the API: a status filter leaves out settings in another state.
    if (body.status) {
      rows = rows.filter((row) => (readString(row, 'status') || 'published') === body.status)
    }
    if (body.entity_type) {
      rows = rows.filter((row) => readString(row, 'entity_type') === body.entity_type)
    }
    if (body.parent_entity_id)
      rows = rows.filter((row) => readString(row, 'parent_entity_id') === body.parent_entity_id)
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
   * The update takes `{ config }` and nothing else: no `entity_id`, no
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
   * contract: see `SAML_UNAVAILABLE`. An unrecognised key 404s too: the store
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
   * The write echoes the `value` it was given back inside the envelope: and
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

  // The Svix handoff. The token is visibly fake on purpose: see the fixture.
  http.get(`${BASE}/webhooks/dashboard`, () => HttpResponse.json(webhookDashboard)),

  /*
   * `GET /taxes/rates`: note the path. `@fp/query`'s docstring calls it
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
   * `POST /events/query`: the Events Debugger's list (`client.events.listRawEvents`).
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
   * `GET /creditnotes`: a live route the SDK has no method for, so the app
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
        invoice_number: invoice ? readString(invoice, 'invoice_number') : '',
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
   * `/connections` and the OAuth pair: connect, edit and disconnect a
   * provider. Like the real API: one published connection per provider, a
   * duplicate is refused, secrets are accepted and never echoed, and DELETE
   * archives.
   */
  http.get(`${BASE}/connections`, () =>
    HttpResponse.json({
      connections: connectionRows.filter((row) => row['connection_status'] !== 'archived'),
      pagination: { total: connectionRows.length, limit: 100, offset: 0 },
    }),
  ),

  http.post(`${BASE}/connections`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const provider = String(body['provider_type'] ?? '')
    if (publishedProviders().includes(provider) && provider !== 's3' && provider !== 'gcs') {
      return HttpResponse.json(
        { message: `A connection for ${provider} already exists in this environment` },
        { status: 409 },
      )
    }
    const row = {
      id: `conn_mock_${++connectionSeq}`,
      name: body['name'],
      provider_type: provider,
      connection_status: 'published',
      metadata: body['metadata'] ?? {},
      sync_config: body['sync_config'] ?? {},
      created_at: new Date().toISOString(),
    }
    connectionRows.push(row)
    return HttpResponse.json(row, { status: 201 })
  }),

  http.put(`${BASE}/connections/:id`, async ({ params, request }) => {
    const row = connectionRows.find((item) => item['id'] === params['id'])
    if (!row) return HttpResponse.json({ message: 'Connection not found' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body['name'] === 'string') row['name'] = body['name']
    if (body['metadata']) row['metadata'] = body['metadata']
    if (body['sync_config']) row['sync_config'] = body['sync_config']
    // As the API: replaced keys are merged and kept, never sent back.
    const replaced = body['encrypted_secret_data'] as Record<string, string> | undefined
    if (replaced) {
      const kept = connectionSecrets.get(String(row['id'])) ?? {}
      for (const [key, value] of Object.entries(replaced)) if (value) kept[key] = value
      connectionSecrets.set(String(row['id']), kept)
      row['updated_at'] = new Date().toISOString()
    }
    return HttpResponse.json(row)
  }),

  http.delete(`${BASE}/connections/:id`, ({ params }) => {
    const row = connectionRows.find((item) => item['id'] === params['id'])
    if (!row) return HttpResponse.json({ message: 'Connection not found' }, { status: 404 })
    row['connection_status'] = 'archived'
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${BASE}/oauth/init`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const provider = String(body['provider'] ?? '')
    if (publishedProviders().includes(provider)) {
      return HttpResponse.json(
        { message: `A connection for ${provider} already exists in this environment` },
        { status: 409 },
      )
    }
    const sessionId = `oauth_mock_${++connectionSeq}`
    // The real flow leaves the reader at the provider; the mock sends them
    // straight back to the console's callback with a code.
    const callback = new URL('/tools/integrations/oauth/callback', new URL(request.url).origin)
    callback.searchParams.set('code', 'mock-code')
    callback.searchParams.set('state', sessionId)
    if (provider === 'quickbooks') callback.searchParams.set('realmId', 'mock-realm')
    pendingOAuth.set(sessionId, { name: body['name'], provider, metadata: body['metadata'] })
    return HttpResponse.json({ oauth_url: callback.toString(), session_id: sessionId })
  }),

  http.post(`${BASE}/oauth/complete`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const pending = pendingOAuth.get(String(body['session_id']))
    if (!pending) {
      return HttpResponse.json({ message: 'OAuth session expired' }, { status: 400 })
    }
    pendingOAuth.delete(String(body['session_id']))
    const row = {
      id: `conn_mock_${++connectionSeq}`,
      name: pending.name,
      provider_type: pending.provider,
      connection_status: 'published',
      metadata: pending.metadata ?? {},
      sync_config: {},
      created_at: new Date().toISOString(),
    }
    connectionRows.push(row)
    return HttpResponse.json({ success: true, connection_id: row.id })
  }),

  /*
   * `GET /tasks/scheduled`: the Exports list. `enabled` is the server-side
   * filter this console sends.
   */
  http.get(`${BASE}/tasks/scheduled`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const enabled = url.searchParams.get('enabled')
    const connection = url.searchParams.get('connection_id')
    const matches = scheduledTasks
      .filter((task) => task['status'] !== 'deleted')
      .filter((task) => enabled === null || String(task['enabled']) === enabled)
      .filter((task) => !connection || task['connection_id'] === connection)
    return HttpResponse.json({
      items: matches.slice(offset, offset + limit),
      pagination: { total: matches.length, limit, offset },
    })
  }),

  http.post(`${BASE}/tasks/scheduled`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const row = {
      id: `task_mock_${++scheduledTaskSeq}`,
      connection_id: body['connection_id'],
      entity_type: body['entity_type'],
      interval: body['interval'],
      enabled: body['enabled'] ?? true,
      status: 'published',
      job_config: body['job_config'] ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    scheduledTasks.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),

  http.get(`${BASE}/tasks/scheduled/:id`, ({ params }) => {
    const row = scheduledTasks.find((task) => task['id'] === params['id'])
    if (!row || row['status'] === 'deleted')
      return HttpResponse.json({ message: 'Scheduled task not found' }, { status: 404 })
    return HttpResponse.json(row)
  }),

  http.put(`${BASE}/tasks/scheduled/:id`, async ({ params, request }) => {
    const row = scheduledTasks.find((task) => task['id'] === params['id'])
    if (!row) return HttpResponse.json({ message: 'Scheduled task not found' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body['enabled'] === 'boolean') row['enabled'] = body['enabled']
    row['updated_at'] = new Date().toISOString()
    return HttpResponse.json(row)
  }),

  http.delete(`${BASE}/tasks/scheduled/:id`, ({ params }) => {
    const row = scheduledTasks.find((task) => task['id'] === params['id'])
    if (!row) return HttpResponse.json({ message: 'Scheduled task not found' }, { status: 404 })
    row['status'] = 'deleted'
    return new HttpResponse(null, { status: 204 })
  }),

  /** `POST /tasks/scheduled/{id}/run`: a manual run, listed first among the runs. */
  http.post(`${BASE}/tasks/scheduled/:id/run`, async ({ params, request }) => {
    const row = scheduledTasks.find((task) => task['id'] === params['id'])
    if (!row) return HttpResponse.json({ message: 'Scheduled task not found' }, { status: 404 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const now = new Date()
    const runs = manualRuns.get(String(row['id'])) ?? []
    const run = {
      id: `run_manual_${String(row['id'])}_${runs.length + 1}`,
      task_type: 'EXPORT',
      scheduled_task_id: row['id'],
      task_status: 'PENDING',
      total_records: 0,
      metadata: {
        start_time: body['start_time'] ?? new Date(now.getTime() - 3_600_000).toISOString(),
        end_time: body['end_time'] ?? now.toISOString(),
      },
      started_at: now.toISOString(),
      created_at: now.toISOString(),
      status: 'published',
    }
    manualRuns.set(String(row['id']), [run, ...runs])
    return HttpResponse.json({ workflow_id: `wf_${run.id}`, message: 'started' })
  }),

  /** `GET /tasks`: an export's runs, by `scheduled_task_id` and `task_status`. */
  http.get(`${BASE}/tasks`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 10)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const taskId = url.searchParams.get('scheduled_task_id')
    const status = url.searchParams.get('task_status')
    const task = scheduledTasks.find((row) => row['id'] === taskId)
    const all = task ? [...(manualRuns.get(String(task['id'])) ?? []), ...exportRuns(task)] : []
    const matches = all.filter((run) => !status || run['task_status'] === status)
    return HttpResponse.json({
      items: matches.slice(offset, offset + limit),
      pagination: { total: matches.length, limit, offset },
    })
  }),

  http.get(`${BASE}/tasks/:id/download`, ({ params }) =>
    HttpResponse.json({ download_url: `https://example.com/exports/${String(params['id'])}.csv` }),
  ),

  /*
   * `POST /workflows/search`: the Workflows list. The body is snake_case;
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
   * `POST /usage-records/search`: the Usage Syncs list. `synced` is the
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
  http.put(`${BASE}/wallets/:id`, async ({ request, params }) => {
    const wallet = walletStore.find((w) => w['id'] === String(params['id']))
    if (!wallet) return HttpResponse.json({ message: 'Wallet not found' }, { status: 404 })
    const body = await readBody(request)
    const next = body['auto_topup'] as Record<string, unknown> | undefined
    if (next) {
      const current = (wallet['auto_topup'] ?? {}) as Record<string, unknown>
      wallet['auto_topup'] = { ...current, ...next }
    }
    // The real update replaces the metadata map, so the mock does too.
    if (body['metadata'] && typeof body['metadata'] === 'object')
      wallet['metadata'] = body['metadata']
    return HttpResponse.json(wallet)
  }),
  http.post(`${BASE}/wallets/:id/terminate`, ({ params }) => {
    const wallet = walletStore.find((w) => w['id'] === String(params['id']))
    if (!wallet) return HttpResponse.json({ message: 'Wallet not found' }, { status: 404 })
    wallet['wallet_status'] = 'closed'
    return HttpResponse.json(wallet)
  }),
  // The real-time balance read. The mock store keeps one balance, so it answers
  // with the stored wallet; real_time_* are set on create and top-up.
  http.get(`${BASE}/wallets/:id/balance/real-time`, ({ params }) => {
    const wallet = walletStore.find((w) => w['id'] === String(params['id']))
    return wallet
      ? HttpResponse.json(wallet)
      : HttpResponse.json({ error: { message: 'Wallet not found' } }, { status: 404 })
  }),
  http.get(`${BASE}/wallets/:id/transactions`, ({ params }) => {
    const items = walletTransactionStore.filter((t) => t['wallet_id'] === String(params['id']))
    return HttpResponse.json({ items, pagination: { total: items.length, limit: 50, offset: 0 } })
  }),
  http.post(`${BASE}/wallets/search`, () =>
    HttpResponse.json({ items: [], pagination: { total: 0, limit: 25, offset: 0 } }),
  ),

  // Groups and cost sheets: the capture environment had none, so they start
  // empty and hold whatever this session creates: a state worth seeing, and
  // enough to run create, rename and delete end to end.
  http.post(`${BASE}/groups/search`, () =>
    HttpResponse.json({
      items: groupStore,
      pagination: { total: groupStore.length, limit: 25, offset: 0 },
    }),
  ),
  http.get(`${BASE}/groups/:id`, ({ params }) => {
    const row = groupStore.find((item) => readString(item, 'id') === params['id'])
    return row
      ? HttpResponse.json(row)
      : HttpResponse.json({ error: { message: 'group not found' } }, { status: 404 })
  }),
  http.post(`${BASE}/costs/search`, () =>
    HttpResponse.json({
      items: costSheetStore,
      pagination: { total: costSheetStore.length, limit: 25, offset: 0 },
    }),
  ),

  // A plan's charges. Create, edit and terminate write to `priceCorpus`, so the
  // refetch that follows each one shows the change. The real API versions an
  // edit and end-dates a delete; the mock patches and removes in place, which
  // is the same thing as far as the plan's active charge list can tell.
  http.post(`${BASE}/prices/bulk`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { items?: Record<string, unknown>[] }
    const now = new Date().toISOString()
    const items = (body.items ?? []).map((item, index) => {
      const meterId = readString(item, 'meter_id')
      const meter = meterId ? meterOf(meterId) : null
      const amount = readString(item, 'amount')
      return {
        ...item,
        id: `price_new_${Date.now()}_${index}`,
        status: 'published',
        created_at: now,
        updated_at: now,
        start_date: now,
        ...(amount ? { display_amount: formatMoney(amount, readString(item, 'currency')) } : {}),
        ...(meter ? { meter } : {}),
      }
    })
    priceCorpus.items.push(...items)
    priceCorpus.pagination.total = priceCorpus.items.length
    return HttpResponse.json({ items }, { status: 201 })
  }),
  /**
   * Every version of a plan price, oldest first: the root and every plan price
   * whose `parent_price_id` is that root. Any version's ID gives the same list;
   * a price that is not a plan's answers 400, as the API does.
   */
  http.get(`${BASE}/prices/:id/history`, ({ params }) => {
    const price = byId('prices', String(params['id']))
    if (!price) return HttpResponse.json({ error: { message: 'Price not found' } }, { status: 404 })
    if (readString(price, 'entity_type') !== 'PLAN') {
      return HttpResponse.json(
        { error: { message: 'Price history is only available for plan prices' } },
        { status: 400 },
      )
    }
    const root = readString(price, 'parent_price_id') || readString(price, 'id')
    const items = priceCorpus.items
      .filter(
        (row) =>
          readString(row, 'entity_type') === 'PLAN' &&
          readString(row, 'entity_id') === readString(price, 'entity_id') &&
          (readString(row, 'id') === root || readString(row, 'parent_price_id') === root),
      )
      .sort(
        (a, b) =>
          Date.parse(readString(a, 'start_date') || readString(a, 'created_at')) -
          Date.parse(readString(b, 'start_date') || readString(b, 'created_at')),
      )
    return HttpResponse.json({
      items,
      pagination: { total: items.length, limit: items.length, offset: 0 },
    })
  }),
  http.put(`${BASE}/prices/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const { effective_from: effectiveFrom, ...patch } = body
    const amount = readString(patch, 'amount')
    const existing = byId('prices', String(params['id']))
    const repriced = ['amount', 'billing_model', 'tiers', 'tier_mode', 'transform_quantity'].some(
      (key) => patch[key] !== undefined,
    )
    if (existing && repriced) {
      // As the API does: end this price and start a new version where it stops,
      // pointing back at the first version. Nothing is deleted.
      const at = typeof effectiveFrom === 'string' ? effectiveFrom : new Date().toISOString()
      existing['end_date'] = at
      const next = {
        ...existing,
        ...patch,
        id: `${String(existing['id'])}_v${Date.now()}`,
        parent_price_id: readString(existing, 'parent_price_id') || existing['id'],
        sequence: Number(existing['sequence'] ?? 1) + 1,
        start_date: at,
        end_date: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(amount
          ? { display_amount: formatMoney(amount, readString(existing, 'currency')) }
          : {}),
      }
      priceCorpus.items.push(next)
      priceCorpus.pagination.total = priceCorpus.items.length
      return HttpResponse.json(next)
    }
    return patchRow(priceCorpus.items, String(params['id']), {
      ...patch,
      updated_at: new Date().toISOString(),
      ...(amount
        ? { display_amount: formatMoney(amount, readString(existing ?? {}, 'currency')) }
        : {}),
    })
  }),
  // Terminating a price ends it (`end_date`); the API keeps the row.
  http.delete(`${BASE}/prices/:id`, async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const existing = byId('prices', String(params['id']))
    if (existing) {
      existing['end_date'] =
        typeof body['end_date'] === 'string' ? body['end_date'] : new Date().toISOString()
    }
    return HttpResponse.json({ success: true, id: params['id'] })
  }),

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

  /*
   * The bulk list, which the plans grid counts grants with.
   *
   * `plan_ids` is repeatable and is the filter the real route honours;
   * `plan_id` singular is accepted there and silently ignored, so it is
   * ignored here too rather than being made to work: a mock that is kinder
   * than the API hides the bug it would cause. Checked live, not assumed.
   */
  /*
   * The pricing parser, answering a fixed schema.
   *
   * The real route proxies a model, so the mock cannot reproduce what it
   * would say: what it can do is answer the *shape* the screen has to
   * render, with a metered feature, a hybrid plan and a grant, so the review
   * and the apply path are exercised without a model in the loop.
   */
  /*
   * One event's trace.
   *
   * The id is a query parameter, not a path segment, because event ids may
   * contain `/`. The fixture walks all five stages for most events and fails
   * at the meter for one of them, so the failure path is reachable under
   * mocks: it is the branch people actually open the debugger to see.
   */
  http.get(`${BASE}/events/lookup`, ({ request }) => {
    const url = new URL(request.url)
    const id = url.searchParams.get('id') ?? ''
    const externalCustomerId = url.searchParams.get('external_customer_id') ?? ''
    const unmatched = id.endsWith('3')

    return HttpResponse.json({
      status: unmatched ? 'failed' : 'processed',
      event: { id, idempotency_key: unmatched ? '' : `idem_${id}` },
      events: [
        {
          id,
          external_customer_id: externalCustomerId,
          timestamp: '2026-10-11T16:20:48.685Z',
          ingested_at: '2026-10-11T16:20:48Z',
          source: 'api',
          properties: { value: 1 },
        },
      ],
      debug_tracker: {
        customer_lookup: {
          status: 'found',
          customer: { id: 'cust_mock', external_id: externalCustomerId, name: 'Northwind' },
        },
        meter_matching: unmatched
          ? { status: 'not_found', error: { message: 'No meter listens for this event name.' } }
          : {
              status: 'found',
              matched_meters: [
                { meter_id: 'meter_mock', event_name: 'api.calls', meter: { name: 'API Calls' } },
              ],
            },
        price_lookup: unmatched
          ? { status: 'skipped' }
          : {
              status: 'found',
              matched_prices: [
                {
                  price_id: 'price_mock',
                  meter_id: 'meter_mock',
                  status: 'published',
                  price: { amount: '0.01', currency: 'usd' },
                },
              ],
            },
        subscription_line_item_lookup: unmatched
          ? { status: 'skipped' }
          : {
              status: 'found',
              matched_line_items: [
                {
                  sub_line_item_id: 'subs_line_mock',
                  subscription_id: 'subs_synth_0000',
                  price_id: 'price_mock',
                  is_active_for_event: true,
                  timestamp_within_range: true,
                },
              ],
            },
        attributed_to_customer: unmatched
          ? { status: 'skipped' }
          : {
              status: 'attributed',
              meter_usage: {
                meter_id: 'meter_mock',
                external_customer_id: externalCustomerId,
                qty_total: '1',
              },
            },
        failure_point: unmatched ? { failure_point_type: 'meter_lookup' } : null,
      },
    })
  }),

  http.post(`${BASE}/ai/pricing/parse-gemini`, () =>
    HttpResponse.json({
      features: [
        {
          name: 'API Calls',
          key: 'api_calls',
          type: 'metered',
          unit_singular: 'call',
          unit_plural: 'calls',
          meter_event_name: 'api.calls',
          aggregation: 'count',
        },
        {
          name: 'Seats',
          key: 'seats',
          type: 'static',
          unit_singular: 'seat',
          unit_plural: 'seats',
        },
      ],
      plans: [
        {
          name: 'Starter',
          description: 'Entry tier, monthly',
          prices: [{ amount: 29, currency: 'USD', billing_period: 'monthly' }],
          entitlements: [
            { feature_key: 'api_calls', is_unlimited: false, value: 10000 },
            { feature_key: 'seats', is_unlimited: false, value: 3 },
          ],
          usage_charges: [
            {
              feature_key: 'api_calls',
              amount_per_unit: 0.01,
              currency: 'USD',
              billing_period: 'monthly',
            },
          ],
        },
      ],
      credit_grants: [
        { plan_name: 'Starter', name: 'Welcome credits', credits: 5000, cadence: 'onetime' },
      ],
    }),
  ),

  http.get(`${BASE}/creditgrants`, ({ request }) => {
    const planIds = new URL(request.url).searchParams.getAll('plan_ids')
    const all = (corpus['creditgrants'] as Corpus).items
    const rows =
      planIds.length > 0 ? all.filter((row) => planIds.includes(readString(row, 'plan_id'))) : all
    return HttpResponse.json({
      items: rows,
      pagination: { total: rows.length, limit: 1000, offset: 0 },
    })
  }),

  // Credit grants have no search: only the scoped list endpoints: so the plan
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
    // The API's own rule: a subscription-scoped grant must say when it starts.
    if (body['scope'] === 'SUBSCRIPTION' && !body['start_date']) {
      return HttpResponse.json(
        {
          code: 'validation_error',
          message: 'start_date is required for SUBSCRIPTION-scoped grants',
          hint: 'Please provide a start date for the credit grant',
          http_status_code: 400,
        },
        { status: 400 },
      )
    }
    const row = { ...body, id: `cg_new_${Date.now()}`, status: 'published' }
    if (body['scope'] === 'SUBSCRIPTION') {
      additionsFor('grants', String(body['subscription_id'] ?? '')).push({
        ...row,
        created_at: new Date().toISOString(),
      })
    }
    return HttpResponse.json(row, { status: 201 })
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
  // paths: close, invalidate, refetch: complete end to end.
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
  // success path: close, invalidate, refetch: completes end to end.
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
  // One add-on, by id: the detail page on a direct navigation, from the same
  // corpus the list reads.
  http.get(`${BASE}/addons/:id`, ({ params }) => {
    const addon = byId('addons', String(params['id']))
    return addon ? HttpResponse.json(addon) : new HttpResponse(null, { status: 404 })
  }),

  // Plans, the same way: create and edit echo the record back so the drawer's
  // success path runs end to end.
  http.post(`${BASE}/plans`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const row = {
      ...body,
      id: `plan_new_${Date.now()}`,
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    // Kept, so the detail page the form lands on reads the plan just created.
    ;(corpus['plans'] as Corpus).items.unshift(row)
    return HttpResponse.json(row, { status: 201 })
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
    const subscriptionIds = url.searchParams
      .getAll('subscription_ids')
      .flatMap((value) => value.split(','))
    const items =
      subscriptionIds.length > 0
        ? subscriptionIds.flatMap((id) => additionsFor('coupons', id))
        : couponIds.includes(DEMO_ASSOCIATION_COUPON)
          ? couponAssociations()
          : []
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
    // The API's unique index on (environment, external_id): a taken id is a 409.
    const externalId = readString(body, 'external_id')
    const taken = (corpus['customers'] as Corpus).items.some(
      (row) => externalId !== '' && readString(row, 'external_id') === externalId,
    )
    if (taken) {
      return HttpResponse.json(
        {
          code: 'already_exists',
          message: 'A customer with this identifier already exists',
          http_status_code: 409,
        },
        { status: 409 },
      )
    }
    const row = { ...body, id: `cust_new_${Date.now()}`, status: 'published' }
    ;(corpus['customers'] as Corpus).items.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.get(`${BASE}/invoices/:id`, ({ params, request }) => {
    const id = String(params['id'])
    // One invoice that lives in Production only, for the shared-link journey:
    // opened from Sandbox it 404s, as a real record in another environment does.
    if (id === PRODUCTION_ONLY_INVOICE) {
      if (request.headers.get('X-Environment-ID') !== PRODUCTION_ENVIRONMENT_ID) {
        return HttpResponse.json({ message: 'Invoice not found' }, { status: 404 })
      }
      const template = sourceFor('invoices').items[0] ?? {}
      return HttpResponse.json({ ...template, id, invoice_number: 'INV-PROD-0001' })
    }
    const invoice =
      byId('invoices', id) ??
      sourceFor('invoices').items.find((row) => readString(row, 'id') === id)
    if (!invoice) return HttpResponse.json({ message: 'Invoice not found' }, { status: 404 })
    // A finalized invoice carries the link its customer receives, as the API answers it
    // (the SDK drops the field, so the console reads it from this response directly).
    const hosted =
      readString(invoice, 'invoice_status') === 'DRAFT'
        ? {}
        : { hosted_invoice_url: `https://invoice-dev.flexprice.io/in/hit_${id}.demo-signature` }
    // Generated invoices carry no lines; give the detail one so line-level actions have a target.
    const lines = invoice['line_items']
    if (Array.isArray(lines) && lines.length > 0)
      return HttpResponse.json({ ...invoice, ...hosted })
    return HttpResponse.json({
      ...invoice,
      ...hosted,
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
  /*
   * `PUT /invoices/{id}`: the narrow edit the API actually allows.
   *
   * Its whole body is `invoice_pdf_url`, `due_date`, `metadata` and
   * `apply_discount`; the customer, the amounts and the lines are fixed once
   * an invoice exists. The handler honours exactly those, so a request that
   * tries to edit anything else is as ignored here as it is in production.
   */
  http.put(`${BASE}/invoices/:id`, async ({ request, params }) => {
    const id = String(params['id'])
    const body = (await request.json()) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    if (body['metadata']) patch['metadata'] = body['metadata']
    const dueDate = body['due_date'] ?? body['dueDate']
    if (dueDate !== undefined) {
      // The API refuses a date in the past; the form does too, so a request
      // carrying one is a bug worth failing on rather than quietly accepting.
      if (typeof dueDate === 'string' && new Date(dueDate) < new Date()) {
        return HttpResponse.json(
          { message: 'due_date cannot be in the past', http_status_code: 400 },
          { status: 400 },
        )
      }
      patch['due_date'] = dueDate
    }
    // Re-applying discounts on a finalized invoice lands on a draft copy, as in the API.
    const target = body['apply_discount'] ? invoiceForEdit(id) : null
    const targetId = target ? readString(target, 'id') : id
    if (Object.keys(patch).length > 0) patchRow(sourceFor('invoices').items, targetId, patch)
    const invoice = sourceFor('invoices').items.find((row) => readString(row, 'id') === targetId)
    if (!invoice) return HttpResponse.json({ message: 'Invoice not found' }, { status: 404 })
    return HttpResponse.json(invoice)
  }),
  /*
   * `POST /invoices/{id}/modify/execute`: the only route that changes what an
   * invoice charges for.
   *
   * One action per call, like the API: add (bulk), update (one line, and the
   * edit versions it so the id changes) and remove (bulk). The id change on
   * update is mirrored here deliberately: it is the behaviour the client has
   * to thread through a batch, so a mock that kept the id stable would hide
   * the bug it is most likely to have.
   */
  http.post(`${BASE}/invoices/:id/modify/execute`, async ({ request, params }) => {
    const id = String(params['id'])
    const body = (await request.json()) as {
      line_item_params?: Record<string, unknown>
      lineItemParams?: Record<string, unknown>
    }
    const p = body.line_item_params ?? body.lineItemParams ?? {}
    const invoice = invoiceForEdit(id)
    if (!invoice) return HttpResponse.json({ message: 'Invoice not found' }, { status: 404 })

    const lines = (invoice['line_items'] as Record<string, unknown>[] | undefined) ?? []
    const action = String(p['action'] ?? '')

    if (action === 'remove') {
      const ids = new Set((p['line_item_ids'] ?? p['lineItemIds'] ?? []) as string[])
      invoice['line_items'] = lines.filter((l) => !ids.has(readString(l, 'id')))
    } else if (action === 'update') {
      const target = String(p['line_item_id'] ?? p['lineItemId'] ?? '')
      const patch = (p['update'] ?? {}) as Record<string, unknown>
      invoice['line_items'] = lines.map((l) =>
        readString(l, 'id') === target
          ? // The edit is versioned: the line comes back under a new id.
            { ...l, ...patch, id: `${target}_v2` }
          : l,
      )
    } else if (action === 'add') {
      const items = ((p['items'] ?? []) as Record<string, unknown>[]).map((item, i) => ({
        ...item,
        id: `li_new_${lines.length + i}`,
      }))
      invoice['line_items'] = [...lines, ...items]
    } else {
      return HttpResponse.json(
        { message: `unknown line item action: ${action}`, http_status_code: 400 },
        { status: 400 },
      )
    }

    recomputeInvoice(invoice)
    return HttpResponse.json({ invoice })
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
  http.put(`${BASE}/invoices/:id/payment`, async ({ request, params }) => {
    const id = String(params['id'])
    const body = (await request.json().catch(() => ({}))) as {
      payment_status?: string
      amount?: string
    }
    const current = sourceFor('invoices').items.find((item) => readString(item, 'id') === id)
    if (body.payment_status && current) {
      // What the backend does to the balance for each manual status.
      const due = readString(current, 'amount_due') || '0'
      const paid =
        body.payment_status === 'SUCCEEDED' || body.payment_status === 'OVERPAID'
          ? due
          : body.payment_status === 'FAILED'
            ? '0'
            : (body.amount ?? readString(current, 'amount_paid')) || '0'
      patchRow(sourceFor('invoices').items, id, {
        payment_status: body.payment_status,
        amount_paid: paid,
        amount_remaining: String(Math.max(0, Number(due) - Number(paid))),
      })
    }
    const row = sourceFor('invoices').items.find((item) => readString(item, 'id') === id)
    return row
      ? HttpResponse.json(row)
      : HttpResponse.json({ message: 'Invoice not found' }, { status: 404 })
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
      // Lists open on the most recently updated, so a new invoice leads them.
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    sourceFor('invoices').items.unshift(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  // This period's consumption. Authored: an in-progress period, measured against
  // the contract's own commitment as the API does: none when it has none.
  http.post(`${BASE}/subscriptions/usage`, async ({ request }) => {
    const body = await readBody(request)
    const row = sourceFor('subscriptions').items.find(
      (item) => readString(item, 'id') === body['subscription_id'],
    )
    const commitment = Number(row?.['commitment_amount'] ?? 0)
    return HttpResponse.json({
      amount: 184.5,
      currency: 'usd',
      start_time: '2026-10-01T00:00:00Z',
      end_time: '2026-11-01T00:00:00Z',
      commitment_amount: commitment,
      commitment_utilized: commitment > 0 ? Math.min(184.5, commitment) : 0,
      overage_factor: Number(row?.['overage_factor'] ?? 1),
      overage_amount: 0,
      has_overage: false,
      charges: [
        {
          subscription_line_item_id: 'line_usage',
          meter_display_name: 'API calls',
          quantity: 92250,
          amount: 184.5,
          currency: 'usd',
          is_overage: false,
        },
      ],
    })
  }),
  // The next invoice, computed by the API. Authored: a fixed fee, metered usage, and a zero line
  // that "Hide zero charges" removes.
  http.post(`${BASE}/invoices/preview`, async ({ request }) => {
    const body = await readBody(request)
    const hideZero = body['hide_zero_charges_line_items'] === true
    const lines = [
      {
        id: 'pv_1',
        display_name: 'Platform fee',
        quantity: '1',
        amount: '99.00',
        price_type: 'FIXED',
      },
      {
        id: 'pv_2',
        display_name: 'API usage',
        meter_display_name: 'API calls',
        quantity: '92250',
        amount: '184.50',
        price_type: 'USAGE',
      },
      { id: 'pv_3', display_name: 'Extra seats', quantity: '0', amount: '0', price_type: 'FIXED' },
    ]
      .filter((line) => !hideZero || Number(line.amount) !== 0)
      .map((line) => ({
        ...line,
        period_start: '2026-10-01T00:00:00Z',
        period_end: '2026-11-01T00:00:00Z',
      }))
    return HttpResponse.json({
      id: '',
      subscription_id: String(body['subscription_id'] ?? ''),
      currency: 'usd',
      period_start: '2026-10-01T00:00:00Z',
      period_end: '2026-11-01T00:00:00Z',
      subtotal: '283.50',
      total_discount: '28.35',
      total_tax: '20.41',
      total_prepaid_credits_applied: '0',
      total: '275.56',
      amount_due: '275.56',
      amount_remaining: '275.56',
      line_items: lines,
    })
  }),
  http.get(`${BASE}/subscriptions/:id/addons/associations`, ({ params }) => {
    const items = [
      {
        id: 'sa_demo_1',
        addon_id: 'addon_priority',
        addon_status: 'active',
        start_date: '2026-03-01T00:00:00Z',
        addon: { name: 'Priority support' },
      },
      ...additionsFor('addons', String(params['id'])),
    ]
    return HttpResponse.json({
      items,
      pagination: { total: items.length, limit: 50, offset: 0 },
    })
  }),
  http.delete(`${BASE}/subscriptions/addon`, () => HttpResponse.json({ message: 'ok' })),
  http.post(`${BASE}/subscriptions/addon`, async ({ request }) => {
    const body = await readBody(request)
    const subscriptionId = String(body['subscription_id'] ?? '')
    const addonId = String(body['addon_id'] ?? '')
    const addon = byId('addons', addonId)
    const row = {
      id: `sa_new_${Date.now()}`,
      subscription_id: subscriptionId,
      addon_id: addonId,
      addon_status: 'active',
      start_date: new Date().toISOString(),
      addon: { name: readString(addon ?? {}, 'name') || addonId },
    }
    additionsFor('addons', subscriptionId).push(row)
    return HttpResponse.json({ id: row.id, subscription_id: subscriptionId }, { status: 201 })
  }),
  http.post(`${BASE}/entitlements`, async ({ request }) => {
    const body = await readBody(request)
    const row = { ...body, id: `ent_new_${Date.now()}`, status: 'published' }
    if (body['entity_type'] === 'SUBSCRIPTION') {
      additionsFor('entitlements', String(body['entity_id'] ?? '')).push(row)
    }
    return HttpResponse.json(row, { status: 201 })
  }),
  http.get(`${BASE}/integrations/mappings`, ({ request }) => {
    const url = new URL(request.url)
    const entityId = url.searchParams.get('entity_id') ?? ''
    const items = entityId
      ? mappingsForEntity(url.searchParams.get('entity_type') ?? '', entityId)
      : []
    return HttpResponse.json({ items, pagination: { total: items.length, limit: 50, offset: 0 } })
  }),
  // V1's "Push to Integration": the API queues the sync and answers at once.
  http.post(`${BASE}/integrations/sync`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      entity_type?: string
      entity_id?: string
    }
    if (!body.entity_type || !body.entity_id) {
      return HttpResponse.json(
        { code: 'validation_error', message: 'entity_type and entity_id are required' },
        { status: 400 },
      )
    }
    return HttpResponse.json({ message: 'sync triggered' })
  }),

  http.post(`${BASE}/integrations/link`, async ({ request }) => {
    const body = await readBody(request)
    const customerId = String(body['entity_id'] ?? '')
    const providerType = String(body['provider_type'] ?? '')
    const entityType = String(body['entity_type'] ?? 'customer')
    const rows = mappingsForEntity(entityType, customerId)
    const now = new Date().toISOString()
    const existing = rows.find((row) => row['provider_type'] === providerType)
    if (existing) {
      existing['provider_entity_id'] = body['provider_entity_id']
      existing['updated_at'] = now
      return HttpResponse.json({ mapping: existing })
    }
    const row = {
      id: `intmap_new_${Date.now()}`,
      entity_id: customerId,
      entity_type: entityType,
      provider_type: providerType,
      provider_entity_id: body['provider_entity_id'],
      status: 'published',
      created_at: now,
      updated_at: now,
    }
    rows.push(row)
    return HttpResponse.json({ mapping: row })
  }),
  http.delete(`${BASE}/integrations/link`, async ({ request }) => {
    const body = await readBody(request)
    const rows = mappingsForEntity(
      String(body['entity_type'] ?? 'customer'),
      String(body['entity_id'] ?? ''),
    )
    const index = rows.findIndex((row) => row['provider_type'] === body['provider_type'])
    if (index >= 0) rows.splice(index, 1)
    return HttpResponse.json({ success: true })
  }),
  // Nothing queued by default; the page renders no banner.
  http.get(`${BASE}/subscriptions/:id/schedules`, () => HttpResponse.json({ schedules: [] })),
  http.get(`${BASE}/subscriptions/:id/entitlements`, ({ params }) =>
    HttpResponse.json({
      features: [
        ...additionsFor('entitlements', String(params['id'])).map((row) => ({
          feature: { id: row['feature_id'], name: String(row['feature_id']) },
          entitlement: row,
        })),
        // The same features `GET /customers/usage` reports, so the contract's
        // Usage column has a reading to match by feature id.
        {
          feature: { id: 'feat_synth_0000', name: 'API calls' },
          entitlement: {
            is_enabled: true,
            is_soft_limit: true,
            usage_limit: 250000,
            usage_reset_period: 'MONTHLY',
          },
        },
        {
          feature: { id: 'feat_synth_0001', name: 'Tokens processed' },
          entitlement: {
            is_enabled: true,
            is_soft_limit: true,
            usage_limit: 1000000,
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
  // Like the live API: the update request has no `metadata` field, so the
  // record comes back unchanged and the console reports the edit as unsaved.
  http.put(`${BASE}/subscriptions/:id`, ({ params }) => {
    const row = sourceFor('subscriptions').items.find(
      (item) => readString(item, 'id') === params['id'],
    )
    if (!row) return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
    return HttpResponse.json(row)
  }),
  http.get(`${BASE}/subscriptions/:id`, ({ params }) => {
    const row = sourceFor('subscriptions').items.find(
      (item) => readString(item, 'id') === params['id'],
    )
    if (!row) return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
    const granted = additionsFor('grants', String(row['id']))
    return HttpResponse.json({
      ...row,
      // Like the API, the subscription read carries only the lines billing now.
      line_items: contractLines(String(row['id']), row).filter(lineIsActive),
      ...(granted.length > 0
        ? {
            credit_grants: [
              ...(Array.isArray(row['credit_grants']) ? row['credit_grants'] : []),
              ...granted,
            ],
          }
        : {}),
    })
  }),
  http.post(`${BASE}/subscriptions/:id/lineitems`, async ({ request, params }) => {
    const id = String(params['id'])
    const row = sourceFor('subscriptions').items.find((item) => readString(item, 'id') === id)
    if (!row) return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
    const body = await readBody(request)
    const price = (body['price'] ?? {}) as Record<string, unknown>
    const currency = String(row['currency'] ?? 'USD')
    const usage = price['type'] === 'USAGE'
    const line: Record<string, unknown> = {
      id: `${id}_line_${contractLines(id, row).length + 1}`,
      display_name: body['display_name'],
      price_type: usage ? 'USAGE' : 'FIXED',
      entity_type: 'subscription',
      quantity: usage ? '0' : String(body['quantity'] ?? 1),
      billing_period: price['billing_period'] ?? row['billing_period'] ?? 'MONTHLY',
      currency,
      meter_id: price['meter_id'],
      price: {
        amount: price['amount'],
        currency,
        billing_model: price['billing_model'] ?? 'FLAT_FEE',
        tier_mode: price['tier_mode'],
        tiers: price['tiers'],
        transform_quantity: price['transform_quantity'],
        bucket_size: price['bucket_size'],
        meter_id: price['meter_id'],
      },
      start_date: body['start_date'] ?? new Date().toISOString(),
      end_date: '0001-01-01T00:00:00Z',
      ...commitmentOf(body),
    }
    contractLines(id, row).push(line)
    return HttpResponse.json(line)
  }),
  http.post(`${BASE}/subscriptions/:id/modify/:mode`, async ({ request, params }) => {
    const id = String(params['id'])
    const mode = String(params['mode'])
    const row = sourceFor('subscriptions').items.find((item) => readString(item, 'id') === id)
    if (!row) return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
    const body = await readBody(request)
    if (body['type'] === 'coupon') {
      const params = (body['coupon_params'] ?? {}) as Record<string, unknown>
      const code = String(params['coupon_code'] ?? '')
      const known = sourceFor('coupons').items.find(
        (item) => readString(item, 'coupon_code') === code,
      )
      const coupon = known ?? {
        id: `coupon_mock_${code}`,
        name: code,
        coupon_code: code,
        type: 'percentage',
        percentage_off: '10',
      }
      const association = {
        id: `cpasc_new_${Date.now()}`,
        coupon_id: readString(coupon, 'id'),
        subscription_id: id,
        status: 'published',
        start_date: new Date().toISOString(),
        coupon,
      }
      if (mode === 'execute') additionsFor('coupons', id).push(association)
      return HttpResponse.json({ changed_resources: {} })
    }
    const change = ((
      body['line_item_change_params'] as { line_items?: Record<string, unknown>[] } | undefined
    )?.line_items ?? [])[0]
    const line = change ? findContractLine(String(change['id'])) : undefined
    if (!change || !line) {
      return HttpResponse.json({ error: { message: 'line item not found' } }, { status: 400 })
    }
    const at = String(change['effective_date'] ?? new Date().toISOString())
    const quantity = String(change['quantity'] ?? line['quantity'])
    const price = line['price'] as Record<string, unknown>
    const amount = String(change['amount'] ?? price['amount'])
    const currency = String(row['currency'] ?? 'USD')
    const created: Record<string, unknown> = {
      ...line,
      id: `${String(line['id'])}_v2`,
      quantity,
      start_date: at,
    }
    if (mode === 'execute') {
      line['end_date'] = at
      created['price'] = { ...price, amount }
      contractLines(id, row).push(created)
    }
    return HttpResponse.json({
      changed_resources: {
        line_items: [
          { id: line['id'], change_action: 'ended', quantity: line['quantity'], end_date: at },
          { id: created['id'], change_action: 'created', quantity, start_date: at },
        ],
        invoices: [
          {
            action: 'created',
            status: 'draft',
            invoice: { amount_due: String(Number(quantity) * Number(amount)), currency },
          },
        ],
      },
    })
  }),
  /** Every line of the listed contracts; `active_filter: false` keeps the ended ones. */
  http.post(`${BASE}/subscriptions/lineitems/search`, async ({ request }) => {
    const body = await readBody(request)
    const ids = Array.isArray(body['subscription_ids'])
      ? (body['subscription_ids'] as string[])
      : []
    const items = ids.flatMap((id) => {
      const row = sourceFor('subscriptions').items.find((item) => readString(item, 'id') === id)
      if (!row) return []
      const lines = contractLines(id, row)
      return body['active_filter'] === false ? lines : lines.filter(lineIsActive)
    })
    return HttpResponse.json({
      items,
      pagination: { total: items.length, limit: items.length, offset: 0 },
    })
  }),
  /**
   * Every version of one contract line, oldest first. The API walks the
   * predecessor and successor pointers; here a version is a line of the same
   * contract whose price shares the root price.
   */
  http.get(`${BASE}/subscriptions/lineitems/:lineId/history`, ({ params }) => {
    const line = findContractLine(String(params['lineId']))
    if (!line) return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
    const rootOf = (row: Record<string, unknown>) => {
      const price = (row['price'] ?? {}) as Record<string, unknown>
      return readString(price, 'parent_price_id') || readString(price, 'id')
    }
    const store = [...contractLineStore.values()].find((lines) => lines.includes(line)) ?? [line]
    const items = store
      .filter((row) => row === line || rootOf(row) === rootOf(line))
      .sort(
        (a, b) => Date.parse(readString(a, 'start_date')) - Date.parse(readString(b, 'start_date')),
      )
    return HttpResponse.json({
      items,
      pagination: { total: items.length, limit: items.length, offset: 0 },
    })
  }),
  http.put(`${BASE}/subscriptions/lineitems/:lineId`, async ({ request, params }) => {
    const line = findContractLine(String(params['lineId']))
    if (!line) return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
    const body = await readBody(request)
    const priced = (
      [
        'amount',
        'billing_model',
        'tier_mode',
        'tiers',
        'transform_quantity',
        'bucket_size',
      ] as const
    )
      .filter((key) => body[key] !== undefined)
      .reduce<Record<string, unknown>>((acc, key) => ({ ...acc, [key]: body[key] }), {})
    if (Object.keys(priced).length === 0) {
      Object.assign(line, commitmentOf(body))
      return HttpResponse.json(line)
    }
    // As the API does: the line is ended, not edited, and a new one starts
    // where it stops, its price pointing back at the one it replaced.
    const at =
      typeof body['effective_from'] === 'string' ? body['effective_from'] : new Date().toISOString()
    const previous = (line['price'] ?? {}) as Record<string, unknown>
    line['end_date'] = at
    const store = [...contractLineStore.values()].find((lines) => lines.includes(line))
    const version = (store?.length ?? 0) + 1
    const priceId = `${String(line['id'])}_price_v${version}`
    const next: Record<string, unknown> = {
      ...line,
      ...commitmentOf(body),
      id: `${String(line['id'])}_v${version}`,
      price_id: priceId,
      price: {
        ...previous,
        ...priced,
        id: priceId,
        parent_price_id: previous['parent_price_id'] ?? previous['id'],
        created_at: new Date().toISOString(),
      },
      start_date: at,
      end_date: '0001-01-01T00:00:00Z',
    }
    store?.push(next)
    return HttpResponse.json(next)
  }),
  http.delete(`${BASE}/subscriptions/lineitems/:lineId`, async ({ request, params }) => {
    const line = findContractLine(String(params['lineId']))
    if (!line) return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 })
    const body = await readBody(request)
    line['end_date'] = body['effective_from'] ?? new Date().toISOString()
    return HttpResponse.json(line)
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
  http.post(`${BASE}/subscriptions/:id/pause`, ({ params }) =>
    patchRow(sourceFor('subscriptions').items, String(params['id']), {
      subscription_status: 'paused',
    }),
  ),
  http.post(`${BASE}/subscriptions/:id/resume`, ({ params }) =>
    patchRow(sourceFor('subscriptions').items, String(params['id']), {
      subscription_status: 'active',
    }),
  ),
  http.post(`${BASE}/subscriptions/:id/activate`, async ({ request, params }) => {
    const body = await readBody(request)
    return patchRow(sourceFor('subscriptions').items, String(params['id']), {
      subscription_status: 'active',
      start_date: body['start_date'],
    })
  }),
  http.post(`${BASE}/subscriptions`, async ({ request }) => {
    const body = await readBody(request)
    const start = typeof body['start_date'] === 'string' ? Date.parse(body['start_date']) : NaN
    // As the API (CreateSubscriptionRequest.ToSubscription): the first status
    // comes from the payment behaviour, not the start date. The default,
    // default_active, starts it active even when it starts in the future; the
    // incomplete behaviours start it incomplete. A draft stays a draft.
    const behaviour = readString(body, 'payment_behavior')
    const row = {
      ...body,
      id: `sub_new_${Date.now()}`,
      subscription_status:
        body['subscription_status'] === 'draft'
          ? 'draft'
          : ['default_incomplete', 'allow_incomplete', 'error_if_incomplete'].includes(behaviour)
            ? 'incomplete'
            : 'active',
      status: 'published',
      // Lists open on the most recently updated, so a new contract leads them.
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    sourceFor('subscriptions').items.unshift(row)
    // As the API (handleFxOverride): each fx_rates entry becomes one of the
    // contract's own rates, converting into the invoicing customer's currency.
    const inlineFx = Array.isArray(body['fx_rates'])
      ? (body['fx_rates'] as Record<string, unknown>[])
      : []
    // The API refuses fx_rates when the payer has no other billing currency; the
    // mock simply makes no rate then.
    if (inlineFx.length > 0) {
      const payerExternal = readString(
        (body['inheritance'] ?? {}) as Record<string, unknown>,
        'invoicing_customer_external_id',
      )
      const payer = sourceFor('customers').items.find((c) =>
        payerExternal
          ? readString(c, 'external_id') === payerExternal
          : readString(c, 'id') === readString(body, 'customer_id'),
      )
      const to = payer ? readString(payer, 'billing_currency').toLowerCase() : ''
      if (to)
        inlineFx.forEach((fx, index) =>
          fxRates.push({
            id: `fxrate_${row.id}_${index}`,
            scope: 'subscription',
            scope_id: row.id,
            from_currency: (readString(body, 'currency') || 'usd').toLowerCase(),
            to_currency: to,
            rate: String(fx['rate'] ?? ''),
            ...(fx['start_date'] ? { start_date: fx['start_date'] } : {}),
            ...(fx['end_date'] ? { end_date: fx['end_date'] } : {}),
            source: 'fixed',
            status: 'published',
            updated_at: new Date().toISOString(),
          }),
        )
    }
    // An active contract bills its in-advance fixed charges at once, as the API
    // does, so the customer's first invoice is there to find on their Invoices
    // tab. Drafts and future starts have not begun, so they bill nothing yet.
    if (row.subscription_status === 'active' && !(start > Date.now())) {
      const planId = readString(body, 'plan_id')
      const total = sourceFor('prices')
        .items.filter(
          (price) =>
            readString(price, 'entity_id') === planId &&
            readString(price, 'type') === 'FIXED' &&
            readString(price, 'invoice_cadence') === 'ADVANCE',
        )
        .reduce((sum, price) => sum + Number(readString(price, 'amount') || 0), 0)
      sourceFor('invoices').items.unshift({
        id: `inv_new_${Date.now()}`,
        customer_id: readString(body, 'customer_id'),
        subscription_id: row.id,
        currency: readString(body, 'currency') || 'usd',
        invoice_type: 'SUBSCRIPTION',
        billing_reason: 'SUBSCRIPTION_CREATE',
        invoice_status: 'FINALIZED',
        payment_status: 'PENDING',
        subtotal: String(total),
        total: String(total),
        amount_due: String(total),
        amount_paid: '0',
        amount_remaining: String(total),
        issue_date: row.created_at,
        finalized_at: row.created_at,
        status: 'published',
        created_at: row.created_at,
        updated_at: row.created_at,
      })
    }
    return HttpResponse.json(row, { status: 201 })
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

  // Forex rates, with the API's rules: one global rate per pair, no window and
  // no delete on a global rate, an override needs the global rate for its pair,
  // and one pair's override windows do not overlap.
  http.post(`${BASE}/forex/query`, async ({ request }) => {
    const body = await readBody(request)
    // The filter DSL too (the console asks for fixed rates only), as the API applies it.
    const conditions = (body['filters'] ?? []) as Parameters<typeof matchesCondition>[1][]
    const items = fxRates.filter(
      (row) =>
        row['status'] === 'published' &&
        (!body['scope'] || row['scope'] === body['scope']) &&
        (!body['scope_id'] || row['scope_id'] === body['scope_id']) &&
        conditions.every((condition) => matchesCondition(row, condition)),
    )
    const limit = Number(body['limit'] ?? 50)
    const offset = Number(body['offset'] ?? 0)
    return HttpResponse.json({
      items: items.slice(offset, offset + limit),
      pagination: { total: items.length, limit, offset },
    })
  }),
  http.post(`${BASE}/forex`, async ({ request }) => {
    const body = await readBody(request)
    const from = String(body['from_currency'] ?? '').toLowerCase()
    const to = String(body['to_currency'] ?? '').toLowerCase()
    const live = fxRates.filter((row) => row['status'] === 'published')
    const pair = (row: Record<string, unknown>) =>
      row['from_currency'] === from && row['to_currency'] === to
    const label = `${from.toUpperCase()} → ${to.toUpperCase()}`
    if (body['scope'] === 'tenant') {
      if (body['start_date'] || body['end_date'])
        return fxRefusal('Validity windows are only for customer or subscription overrides.')
      if (live.some((row) => row['scope'] === 'tenant' && pair(row)))
        return fxRefusal(`A ${label} rate already exists. Edit it instead of adding another.`)
    } else {
      if (!live.some((row) => row['scope'] === 'tenant' && pair(row)))
        return fxRefusal(`Add a global ${label} rate before adding an override.`)
      const overlaps = fxOverlaps({ ...body, from_currency: from, to_currency: to }, live)
      if (overlaps) return fxRefusal(`Another ${label} override overlaps this period.`)
    }
    const now = new Date().toISOString()
    const row = {
      id: `fxrate_new_${fxRates.length + 1}`,
      ...body,
      from_currency: from,
      to_currency: to,
      source: 'fixed',
      status: 'published',
      created_at: now,
      updated_at: now,
    }
    fxRates.push(row)
    return HttpResponse.json(row, { status: 201 })
  }),
  http.put(`${BASE}/forex/:id`, async ({ request, params }) => {
    const row = fxRates.find((item) => item['id'] === String(params['id']))
    if (!row) return HttpResponse.json({ message: 'FX rate not found' }, { status: 404 })
    const body = await readBody(request)
    // An edited window is held to the same rule as a new one.
    if (
      row['scope'] !== 'tenant' &&
      (body['start_date'] || body['end_date']) &&
      fxOverlaps(
        { ...row, ...body },
        fxRates.filter((item) => item['status'] === 'published' && item['id'] !== row['id']),
      )
    )
      return fxRefusal(
        `Another ${String(row['from_currency']).toUpperCase()} → ${String(row['to_currency']).toUpperCase()} override overlaps this period.`,
      )
    if (row['scope'] === 'tenant' && (body['start_date'] || body['end_date']))
      return fxRefusal(
        'A tenant FX rate applies at all times; validity windows are only for customer or subscription overrides.',
      )
    Object.assign(row, body, { updated_at: new Date().toISOString() })
    return HttpResponse.json(row)
  }),
  http.delete(`${BASE}/forex/:id`, ({ params }) => {
    const row = fxRates.find((item) => item['id'] === String(params['id']))
    if (!row) return HttpResponse.json({ message: 'FX rate not found' }, { status: 404 })
    if (row['scope'] === 'tenant')
      return fxRefusal(
        'A tenant FX rate cannot be deleted because every override falls back to it. Update its value instead.',
      )
    row['status'] = 'archived'
    return HttpResponse.json({ message: 'FX rate deleted' })
  }),

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

  // Price units, the same way: create echoes the record back, and update: which
  // sends only the name: echoes it beside a fixed identity, so the drawer's
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
  // One price unit, by id: the detail page on a direct navigation.
  http.get(`${BASE}/prices/units/:id`, ({ params }) => {
    const unit = byId('priceUnits', String(params['id']))
    return unit ? HttpResponse.json(unit) : new HttpResponse(null, { status: 404 })
  }),

  // One plan, by id: what the detail page loads on a direct navigation. Served
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
