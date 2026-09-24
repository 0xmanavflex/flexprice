/**
 * Expands captured responses into a corpus with volume and variety.
 *
 * The capture environment had twelve rows per entity and almost no spread:
 * every invoice `FINALIZED/PENDING`, every feature `metered`, every price
 * `FLAT_FEE`. Useful shapes, useless states. A grid rendered against them looks
 * finished and proves nothing.
 *
 * The rule this follows: **vary values on a real record, never invent the
 * record.** Every row emitted here starts life as a response the API actually
 * returned — same keys, same nesting, same optional-field absences — with a
 * status flipped or an amount changed. That keeps the corpus honest about
 * shape, which is the part a mock can silently get wrong.
 *
 * Deterministic, so re-running produces an identical corpus and a reviewable
 * diff. Nothing random.
 *
 *   node scripts/synthesize.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const capturedDir = resolve(root, 'src/__fixtures__')
const outDir = resolve(capturedDir, 'generated')

const read = (name) => {
  const path = resolve(capturedDir, `${name}.json`)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Deterministic pseudo-random in [0,1) from an integer. Same input, same corpus. */
function rand(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const clone = (v) => structuredClone(v)
const iso = (d) => d.toISOString()

/** "Today" is fixed, so an overdue row stays overdue next March. */
const NOW = new Date('2026-09-24T00:00:00Z')
const days = (n) => new Date(NOW.getTime() + n * 86_400_000)

/** Decimal arithmetic on strings, to two places. Never a float in the output. */
function scale(amount, factor) {
  const cents = Math.round(Number.parseFloat(amount || '0') * 100 * factor)
  return (cents / 100).toFixed(2)
}

/**
 * The invoice states a billing operator actually triages.
 *
 * `overdue` is not a field — it is FINALIZED, unpaid, past its due date — so it
 * is produced here as that combination rather than as a status value, which is
 * the same derivation the domain layer performs.
 */
const INVOICE_STATES = [
  { invoice_status: 'DRAFT', payment_status: 'PENDING', dueIn: null, paid: 0 },
  { invoice_status: 'FINALIZED', payment_status: 'PENDING', dueIn: 20, paid: 0 },
  { invoice_status: 'FINALIZED', payment_status: 'PENDING', dueIn: -35, paid: 0 },
  { invoice_status: 'FINALIZED', payment_status: 'PENDING', dueIn: -2, paid: 0.5 },
  { invoice_status: 'FINALIZED', payment_status: 'SUCCEEDED', dueIn: -60, paid: 1 },
  { invoice_status: 'FINALIZED', payment_status: 'FAILED', dueIn: -8, paid: 0 },
  { invoice_status: 'VOIDED', payment_status: 'PENDING', dueIn: -14, paid: 0 },
  { invoice_status: 'FINALIZED', payment_status: 'PARTIALLY_REFUNDED', dueIn: -90, paid: 1 },
]

function synthInvoices(captured, customers, count = 40) {
  const seeds = captured.items
  if (seeds.length === 0) return null

  const customerPool = customers?.items ?? []
  const items = Array.from({ length: count }, (_, i) => {
    const row = clone(seeds[i % seeds.length])
    const state = INVOICE_STATES[i % INVOICE_STATES.length]

    row.id = `inv_synth_${String(i).padStart(4, '0')}`
    row.invoice_number = `INV-${9000 + i}`
    row.invoice_status = state.invoice_status
    row.payment_status = state.payment_status

    // A draft has no number and no issue date yet — the case a hand-written
    // fixture always forgets.
    if (state.invoice_status === 'DRAFT') {
      row.invoice_number = ''
      row.finalized_at = undefined
      row.issue_date = undefined
      delete row.finalized_at
      delete row.issue_date
    }

    if (state.dueIn === null) delete row.due_date
    else row.due_date = iso(days(state.dueIn))

    // Spread magnitudes so a column of amounts is worth aligning. One row is
    // deliberately enormous: it is the case a float silently rounds.
    const factor = i % 17 === 0 ? 540_000_000_000_000 : 0.25 + rand(i) * 40
    const total = scale(row.total ?? row.amount_due ?? '100', factor)
    row.total = total
    row.subtotal = total
    row.amount_due = total
    row.amount_paid = scale(total, state.paid)
    row.amount_remaining = scale(total, 1 - state.paid)

    if (customerPool.length > 0) {
      const customer = customerPool[i % customerPool.length]
      row.customer = clone(customer)
      row.customer_id = customer.id
    }

    // Vary currency, so formatting is exercised beyond one locale.
    row.currency = ['USD', 'EUR', 'INR', 'GBP'][i % 4]

    row.created_at = iso(days(-200 + i * 3))
    row.period_start = iso(days(-230 + i * 3))
    row.period_end = iso(days(-200 + i * 3))

    for (const item of row.line_items ?? []) {
      item.id = `li_synth_${i}_${item.id?.slice(-4) ?? '0'}`
      item.invoice_id = row.id
      item.currency = row.currency
      item.amount = scale(item.amount ?? '10', factor)
    }
    return row
  })

  return { items, pagination: { total: items.length, limit: 25, offset: 0 } }
}

/** One of each type, and among the metered, one of each aggregation. */
const FEATURE_SHAPES = [
  { type: 'metered', aggregation: 'COUNT', unit: ['call', 'calls'] },
  { type: 'metered', aggregation: 'SUM', field: 'tokens', unit: ['token', 'tokens'] },
  { type: 'metered', aggregation: 'SUM_WITH_MULTIPLIER', field: 'tokens', multiplier: '1.5', unit: ['token', 'tokens'] },
  { type: 'metered', aggregation: 'COUNT_UNIQUE', field: 'user_id', unit: ['user', 'users'] },
  { type: 'metered', aggregation: 'MAX', field: 'concurrent', unit: ['session', 'sessions'] },
  { type: 'boolean', unit: ['', ''] },
  { type: 'static', unit: ['seat', 'seats'] },
  { type: 'config', unit: ['', ''] },
]

const FEATURE_NAMES = [
  'API calls', 'Tokens processed', 'Weighted tokens', 'Active users', 'Peak sessions',
  'Single sign-on', 'Seats', 'Retention window', 'Webhook deliveries', 'Storage',
  'Audit log export', 'Custom domains',
]

function synthFeatures(captured, count = 24) {
  const seeds = captured.items
  if (seeds.length === 0) return null

  const items = Array.from({ length: count }, (_, i) => {
    const row = clone(seeds[i % seeds.length])
    const shape = FEATURE_SHAPES[i % FEATURE_SHAPES.length]
    const name = FEATURE_NAMES[i % FEATURE_NAMES.length]

    row.id = `feat_synth_${String(i).padStart(4, '0')}`
    row.name = i < FEATURE_NAMES.length ? name : `${name} ${Math.floor(i / FEATURE_NAMES.length) + 1}`
    row.lookup_key = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    row.type = shape.type
    row.unit_singular = shape.unit[0]
    row.unit_plural = shape.unit[1]
    row.created_at = iso(days(-300 + i * 7))

    if (shape.type === 'metered') {
      row.meter_id = `meter_synth_${i}`
      // Embedded exactly as `expand=meters` returns it — the shape the API
      // omits unless asked, and the omission this corpus exists to prevent.
      row.meter = {
        id: row.meter_id,
        name: row.name,
        event_name: row.lookup_key,
        aggregation: {
          type: shape.aggregation,
          ...(shape.field ? { field: shape.field } : {}),
          ...(shape.multiplier ? { multiplier: shape.multiplier } : {}),
        },
        reset_usage: i % 3 === 0 ? 'NEVER' : 'BILLING_PERIOD',
        tenant_id: row.tenant_id,
        environment_id: row.environment_id,
        status: 'published',
        created_at: row.created_at,
      }
    } else {
      delete row.meter_id
      delete row.meter
    }

    // Some features genuinely have no description. Keep that case present.
    if (i % 4 === 0) delete row.description
    return row
  })

  return { items, pagination: { total: items.length, limit: 25, offset: 0 } }
}

/** One of each billing model, including the tiered shape nothing else produces. */
const PRICE_MODELS = [
  { billing_model: 'FLAT_FEE' },
  { billing_model: 'PACKAGE', transform_quantity: { divide_by: 1000, round: 'up' } },
  { billing_model: 'TIERED', tier_mode: 'VOLUME' },
  { billing_model: 'TIERED', tier_mode: 'SLAB' },
]

function synthPrices(captured, count = 20) {
  const seeds = captured.items
  if (seeds.length === 0) return null

  const items = Array.from({ length: count }, (_, i) => {
    const row = clone(seeds[i % seeds.length])
    const model = PRICE_MODELS[i % PRICE_MODELS.length]

    row.id = `price_synth_${String(i).padStart(4, '0')}`
    row.billing_model = model.billing_model
    row.amount = scale(row.amount ?? '10', 0.5 + rand(i) * 20)
    row.display_amount = row.amount
    row.currency = ['USD', 'EUR'][i % 2]
    row.billing_period = ['MONTHLY', 'ANNUAL'][i % 2]

    delete row.transform_quantity
    delete row.tiers
    delete row.tier_mode

    if (model.transform_quantity) row.transform_quantity = model.transform_quantity
    if (model.tier_mode) {
      row.tier_mode = model.tier_mode
      row.tiers = [
        { up_to: 1000, unit_amount: '0.10', flat_amount: '0' },
        { up_to: 10000, unit_amount: '0.08' },
        // The unbounded final band. Without it usage above the last ceiling is
        // not billed at all — the silent revenue bug the domain schema rejects.
        { up_to: null, unit_amount: '0.05' },
      ]
    }
    return row
  })

  return { items, pagination: { total: items.length, limit: 25, offset: 0 } }
}

/**
 * Re-points a foreign key at a row that actually exists in the corpus.
 *
 * `multiply` reassigns ids, which silently orphans every reference to the old
 * ones: a subscription kept `customer_id` from the captured record, so nothing
 * in the generated corpus matched it. Lists still rendered — they read the
 * embedded object — but anything that follows a reference, like opening a
 * customer from a subscription, would find nothing.
 */
function link(row, field, pool, index, embedAs) {
  if (pool.length === 0) return
  const target = pool[index % pool.length]
  row[field] = target.id
  if (embedAs) row[embedAs] = clone(target)
}

/** Entities with no interesting variety axis: more rows, same shape. */
function multiply(captured, prefix, count) {
  const seeds = captured?.items ?? []
  if (seeds.length === 0) return null

  const items = Array.from({ length: count }, (_, i) => {
    const row = clone(seeds[i % seeds.length])
    row.id = `${prefix}_synth_${String(i).padStart(4, '0')}`
    if (row.name) row.name = `${row.name} ${i + 1}`
    if (row.lookup_key) row.lookup_key = `${row.lookup_key}_${i + 1}`
    return row
  })

  return { items, pagination: { total: items.length, limit: 25, offset: 0 } }
}

const captured = {
  invoices: read('invoices'),
  features: read('features'),
  prices: read('prices'),
  customers: read('customers'),
  plans: read('plans'),
  subscriptions: read('subscriptions'),
  addons: read('addons'),
}

/**
 * The subscription states a list has to distinguish.
 *
 * The capture environment had only `active`, which makes a status column
 * decorative.
 */
const SUBSCRIPTION_STATES = [
  { subscription_status: 'active' },
  { subscription_status: 'trialing', trialing: true },
  { subscription_status: 'paused' },
  { subscription_status: 'cancelled', cancelled: true },
  { subscription_status: 'active' },
  { subscription_status: 'incomplete' },
]

function synthSubscriptions(captured, customers, plans, count = 24) {
  const base = multiply(captured, 'subs', count)
  if (!base) return null

  base.items.forEach((row, i) => {
    const state = SUBSCRIPTION_STATES[i % SUBSCRIPTION_STATES.length]
    row.subscription_status = state.subscription_status
    row.currency = ['USD', 'EUR', 'INR'][i % 3]

    link(row, 'customer_id', customers?.items ?? [], i, 'customer')
    link(row, 'plan_id', plans?.items ?? [], i, 'plan')

    row.start_date = iso(days(-120 + i * 4))
    row.current_period_start = iso(days(-30))
    row.current_period_end = iso(days(1 + (i % 28)))

    delete row.cancel_at
    delete row.trial_start
    delete row.trial_end
    if (state.cancelled) row.cancel_at = iso(days(-5 + (i % 10)))
    if (state.trialing) {
      row.trial_start = iso(days(-7))
      row.trial_end = iso(days(7))
    }
  })
  return base
}

const generatedCustomers = multiply(captured.customers, 'cus', 30)
const generatedPlans = multiply(captured.plans, 'plan', 12)

const generated = {
  customers: generatedCustomers,
  plans: generatedPlans,
  invoices: captured.invoices && synthInvoices(captured.invoices, generatedCustomers),
  features: captured.features && synthFeatures(captured.features),
  prices: captured.prices && synthPrices(captured.prices),
  subscriptions:
    captured.subscriptions &&
    synthSubscriptions(captured.subscriptions, generatedCustomers, generatedPlans),
  addons: multiply(captured.addons, 'addon', 12),
}

mkdirSync(outDir, { recursive: true })

let written = 0
for (const [name, data] of Object.entries(generated)) {
  if (!data) {
    console.log(`  skipped   ${name.padEnd(14)} no captured seed to expand`)
    continue
  }
  writeFileSync(resolve(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`)
  written += 1
  console.log(`  generated ${name.padEnd(14)} ${data.items.length} rows`)
}

console.log(`\n${written} corpora written to src/__fixtures__/generated/`)
