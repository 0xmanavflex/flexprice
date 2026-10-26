import { formatMoney, money } from './money'

/**
 * One row of the billing audit trail (`POST /activity`).
 *
 * The list is already newest first. Callers must not re-sort: two entries can
 * share an instant, and the API breaks that tie by id.
 */
export interface ActivityEntry {
  id: string
  /** `entity.pastVerb`, as the API sent it (`invoice.refunded`). */
  action: string
  /** `invoice.refunded` → "Invoice refunded". */
  title: string
  occurredAt: Date | null
  entityType: string
  entityId: string
  /** Display name when the API sent one; otherwise the entity id. */
  entityLabel: string
  actorType: string
  actorId: string
  actorLabel: string
  /** Channel the change came from (`dashboard`, `api`, …). */
  source: string
  /** The customer the change belongs to, when the API scoped it to one. */
  customerId?: string
  /** The API request that made the change, for tracing it in logs. */
  requestId?: string
  /** Where the request came from. Present for changes made over HTTP. */
  ip?: string
  userAgent?: string
  /**
   * The entity as it stood just after this change. Present when the list was
   * asked for `expand: ["state"]`. Keys stay as the API sent them.
   */
  state?: Readonly<Record<string, unknown>>
}

/** One labelled value of an activity row: "Total" → "$2,000.00". */
export interface ActivityField {
  label: string
  value: string
}

export interface ActivityFacts {
  /** The record name, drawn above its fields. */
  record?: string
  /** What the record stood at after the change, label by label. */
  fields?: ActivityField[]
}

const SOURCE_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  api: 'API',
  customer_portal: 'Customer portal',
  webhook: 'Webhook',
  workflow: 'Workflow',
  consumer: 'Consumer',
  hosted_invoice: 'Hosted invoice',
}

/** Every source the API writes (`types.Source`), in the order a filter lists them. */
export const ACTIVITY_SOURCES: readonly string[] = Object.keys(SOURCE_LABEL)

const ACTOR_KIND: Record<string, string> = {
  api_key: 'API key',
  customer: 'Customer',
}

/** Who can make a change (`types.ActorType`), for the actor filter. */
export const ACTIVITY_ACTOR_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'user', label: 'People' },
  { value: 'api_key', label: 'API keys' },
  { value: 'customer', label: 'Customers' },
  { value: 'system', label: 'System' },
]

/**
 * Who acted, always named, for places that must not leave the actor implicit
 * (the full Activity tab). The system is "System"; a nameless actor falls back
 * to its kind.
 */
export function activityActor(entry: ActivityEntry): string {
  if (entry.actorType === 'system') return entry.actorLabel || 'System'
  if (entry.actorLabel) return entry.actorLabel
  return (
    ACTOR_KIND[entry.actorType] ??
    (entry.actorType ? (human(entry.actorType) ?? 'Unknown') : 'Unknown')
  )
}

/**
 * The record's status after the change, from an allowlist of status keys.
 * Only these are read: the rest of the snapshot stays behind "raw payload".
 */
export function activityStatus(entry: ActivityEntry): string | undefined {
  return human(
    text(
      read(
        entry.state,
        'invoice_status',
        'invoiceStatus',
        'subscription_status',
        'payment_status',
        'paymentStatus',
        'status',
      ),
    ),
  )
}

/** A second status where the record has one, e.g. an invoice's payment status. */
export function activityPaymentStatus(entry: ActivityEntry): string | undefined {
  if (entry.entityType !== 'invoice') return undefined
  return human(text(read(entry.state, 'payment_status', 'paymentStatus')))
}

/** The entity's kind in words, as the console names it: "Contract", "Credit memo". */
export function activityEntityNoun(entityType: string): string {
  const name = ENTITY_NOUN[entityType] ?? entityType.replace(/_/g, ' ')
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Record'
}

/**
 * Who acted, in words. A user is just their name. An API key or a customer
 * keeps its kind so "activity-log" is not read as a person. The system is omitted.
 */
export function activityByline(entry: ActivityEntry): string | undefined {
  if (entry.actorType === '' || entry.actorType === 'system' || entry.actorLabel === '') {
    return undefined
  }
  const kind = ACTOR_KIND[entry.actorType]
  return kind ? `${entry.actorLabel} · ${kind}` : entry.actorLabel
}

export function activitySourceLabel(source: string): string {
  if (source === '') return ''
  return SOURCE_LABEL[source] ?? source
}

/**
 * The rail's facts, chosen by entity type, each value under its own label so
 * a row reads "Total $35.00 / Due $35.00 / Status Voided" rather than one run
 * of dot-joined numbers.
 *
 * An invoice's amount is `total` (then what is paid and still due). A wallet's
 * is `balance`. A payment's is `amount`. Anything else uses the first money
 * field the snapshot actually carries, then the entity's own label.
 */
function facts(
  record: string | undefined,
  fields: Array<[string, string | undefined]>,
): ActivityFacts {
  const present = fields.flatMap(([label, value]) => (value ? [{ label, value }] : []))
  return {
    ...(record ? { record } : {}),
    ...(present.length > 0 ? { fields: present } : {}),
  }
}

export function describeActivity(entry: ActivityEntry): ActivityFacts {
  const present = PRESENT[entry.entityType] ?? presentGeneric
  return present(entry)
}

const PRESENT: Record<string, (entry: ActivityEntry) => ActivityFacts> = {
  invoice: (entry) => invoiceFacts(entry),
  wallet: (entry) =>
    facts(label(entry) || 'Wallet', [
      [
        'Balance',
        moneyPhrase(entry.state, ['balance', 'credit_balance', 'creditBalance', 'amount']),
      ],
    ]),
  payment: (entry) =>
    facts(label(entry), [
      ['Amount', moneyPhrase(entry.state, ['amount', 'amount_paid', 'amountPaid'])],
      ['Invoice', settledInvoice(entry.state)],
    ]),
  refund: (entry) =>
    facts(label(entry), [['Amount', moneyPhrase(entry.state, ['amount', 'total'])]]),
  credit_note: (entry) =>
    facts(text(read(entry.state, 'credit_note_number', 'number')) ?? label(entry), [
      ['Total', moneyPhrase(entry.state, ['total', 'amount', 'amount_remaining'])],
    ]),
  subscription: (entry) =>
    facts(label(entry), [
      ['Plan', text(read(entry.state, 'plan_name', 'planName'))],
      ['Status', human(text(read(entry.state, 'subscription_status', 'status')))],
    ]),
  customer: (entry) => customerFacts(entry),
}

/**
 * An invoice snapshot carries several amounts. The rail shows the total, then
 * what has been paid and what is still due when those differ. A draft with
 * every amount at zero stays "Draft" rather than "$0.00".
 */
function invoiceFacts(entry: ActivityEntry): ActivityFacts {
  const number = text(read(entry.state, 'invoice_number', 'invoiceNumber', 'number'))
  const record = number ?? (entry.entityLabel !== entry.entityId ? label(entry) : undefined)
  const total = amount(entry.state, 'total')
  const paid = amount(entry.state, 'amount_paid', 'amountPaid')
  const due = amount(entry.state, 'amount_remaining', 'amountRemaining')
  const status =
    human(text(read(entry.state, 'invoice_status', 'invoiceStatus'))) ??
    human(text(read(entry.state, 'payment_status', 'paymentStatus')))
  return facts(record, [
    ['Total', total && !isZero(total.raw) ? total.formatted : undefined],
    ['Paid', paid && !isZero(paid.raw) ? paid.formatted : undefined],
    ['Due', due && !isZero(due.raw) && due.raw !== total?.raw ? due.formatted : undefined],
    ['Status', status],
  ])
}

function amount(
  state: ActivityEntry['state'],
  ...keys: string[]
): { raw: string; formatted: string } | undefined {
  const raw = text(read(state, ...keys))
  if (!raw || !DECIMAL.test(raw)) return undefined
  const currency = (text(read(state, 'currency')) ?? 'USD').toUpperCase()
  return { raw, formatted: formatMoney(money(raw, currency)) }
}

function isZero(raw: string): boolean {
  return /^0+(\.0+)?$/.test(raw)
}

function presentGeneric(entry: ActivityEntry): ActivityFacts {
  return facts(label(entry), [
    [
      'Amount',
      moneyPhrase(entry.state, [
        'amount',
        'total',
        'balance',
        'amount_due',
        'amount_remaining',
        'credit_balance',
      ]),
    ],
  ])
}

function label(entry: ActivityEntry): string | undefined {
  const name = entry.entityLabel.trim()
  if (!name || name === entry.entityId || isOpaqueId(name)) return undefined
  return name
}

/** `pay_01M5…` and `cust_01M5…` are ids, not names. */
function isOpaqueId(value: string): boolean {
  return /^[a-z][a-z0-9]*_[0-9A-Za-z]{8,}$/.test(value)
}

/**
 * A customer snapshot is mostly ids. The rail keeps the name (once) and the
 * settings a person can read: tax treatment, timezone, status.
 */
function customerFacts(entry: ActivityEntry): ActivityFacts {
  const name = text(read(entry.state, 'name'))
  const external = text(read(entry.state, 'external_id', 'externalId'))
  // The API's entity label is the external id when it has no display name.
  const labelName =
    entry.entityLabel && entry.entityLabel !== entry.entityId && entry.entityLabel !== external
      ? entry.entityLabel
      : undefined
  const record = name || labelName || undefined
  const zone = text(read(entry.state, 'timezone'))
  return facts(record, [
    ['Tax treatment', human(text(read(entry.state, 'tax_treatment', 'taxTreatment')))],
    ['Timezone', zone === 'UTC' || (zone && zone.includes('/')) ? zone : human(zone)],
    ['Status', human(text(read(entry.state, 'status')))],
  ])
}

function human(value: string | undefined): string | undefined {
  if (!value) return undefined
  const spaced = value.toLowerCase().replace(/[_-]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function settledInvoice(state: ActivityEntry['state']): string | undefined {
  const invoice = text(read(state, 'invoice_number', 'invoiceNumber', 'invoice_id', 'invoiceId'))
  return invoice
}

const DECIMAL = /^-?\d+(\.\d+)?$/

function moneyPhrase(state: ActivityEntry['state'], keys: readonly string[]): string | undefined {
  const currency =
    text(read(state, 'currency')) ??
    text(read(asRecord(read(state, 'amount')), 'currency')) ??
    'USD'
  for (const key of keys) {
    const value = read(state, key)
    const phrase = asMoney(value, currency)
    if (phrase) return phrase
  }
  return undefined
}

function asMoney(value: unknown, currency: string): string | undefined {
  if (typeof value === 'string' && DECIMAL.test(value)) {
    return formatMoney(money(value, currency))
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const amount = String(value)
    if (!DECIMAL.test(amount)) return undefined
    return formatMoney(money(amount, currency))
  }
  const record = asRecord(value)
  if (!record) return undefined
  const amount = text(record.amount)
  const code = text(record.currency) ?? currency
  if (!amount || !DECIMAL.test(amount)) return undefined
  return formatMoney(money(amount, code))
}

function read(state: ActivityEntry['state'] | undefined, ...keys: string[]): unknown {
  if (!state) return undefined
  for (const key of keys) {
    const value = state[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function text(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '[redacted]') return undefined
  return trimmed
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * Actions whose literal reading is not how billing talks. A payment that
 * succeeded is money received, so it reads "Paid", the word on the invoice.
 */
const ACTION_TITLE: Record<string, string> = {
  'payment.succeeded': 'Paid',
  'invoice.payment_succeeded': 'Invoice paid',
}

/**
 * The console's word for an entity where it differs from the API's: a
 * subscription is a contract and a credit note a credit memo everywhere else
 * on screen, so "Subscription created" would read as something else.
 */
const ENTITY_NOUN: Record<string, string> = {
  subscription: 'contract',
  credit_note: 'credit memo',
}

/** `invoice.refunded` → "Invoice refunded". Unknown actions stay readable. */
export function activityTitle(action: string): string {
  const trimmed = action.trim()
  if (trimmed === '') return 'Activity'
  const known = ACTION_TITLE[trimmed]
  if (known) return known
  const [entity = '', ...rest] = trimmed.split('.')
  const name = ENTITY_NOUN[entity] ?? entity.replace(/_/g, ' ')
  const titled = name.charAt(0).toUpperCase() + name.slice(1)
  const verb = rest.join(' ').replace(/_/g, ' ')
  return verb ? `${titled} ${verb}` : titled
}
