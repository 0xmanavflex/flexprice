import { type Money, money } from './money'

/**
 * The customer portal's view of one customer's billing: what
 * `/v1/customer/portal/*` answers, reduced to what the portal shows.
 *
 * Every mapper takes the raw JSON and never throws on a missing field: the
 * portal is something a merchant's customer opens, and one odd row should
 * cost that row, not the page.
 */

/* ---- Customer and config -------------------------------------------------- */

export interface PortalCustomer {
  id: string
  name: string
  email: string | null
  /** Two letters for the avatar. */
  initials: string
}

export function toPortalCustomer(wire: unknown): PortalCustomer {
  const body = record(wire)
  const name = text(body['name']) || text(body['external_id']) || 'Customer'
  return {
    id: text(body['id']),
    name,
    email: text(body['email']) || null,
    initials: initialsOf(name),
  }
}

export type PortalView = 'overview' | 'usage' | 'credits' | 'invoices'

export const PORTAL_VIEWS: readonly PortalView[] = ['overview', 'usage', 'credits', 'invoices']

export interface PortalConfig {
  /** The merchant's brand colour, a CSS colour, or null for the kit's own. */
  primaryColor: string | null
  /** The tabs to show, in order. */
  tabs: PortalView[]
}

/** Section ids the console's portal settings use, by tab. */
const SECTION_VIEW: Record<string, PortalView> = {
  overview: 'overview',
  usage: 'usage',
  analytics: 'usage',
  wallet: 'credits',
  wallets: 'credits',
  credits: 'credits',
  invoices: 'invoices',
  billing: 'invoices',
}

/**
 * `GET /config` — a setting whose `value` is the portal config. No setting
 * (404, or no sections) means the defaults: every tab, the kit's colours.
 */
export function toPortalConfig(wire: unknown): PortalConfig {
  const value = record(record(wire)['value'])
  const primary = text(record(value['theme'])['primary_color'])
  const sections = list(value['sections'])
  // The config switches tabs on and off; the order is the portal's own —
  // Overview, Usage, Credits, Invoices — whatever order the sections are stored in.
  const enabled = new Set<PortalView>()
  for (const section of sections) {
    const tab = SECTION_VIEW[text(section['id']).toLowerCase()]
    if (tab && section['enabled'] !== false) enabled.add(tab)
  }
  const tabs =
    sections.length > 0
      ? PORTAL_VIEWS.filter((v) => v === 'overview' || enabled.has(v))
      : [...PORTAL_VIEWS]
  return {
    primaryColor: isCssColor(primary) ? primary : null,
    tabs,
  }
}

export const DEFAULT_PORTAL_CONFIG: PortalConfig = { primaryColor: null, tabs: [...PORTAL_VIEWS] }

/* ---- Subscriptions -------------------------------------------------------- */

export type PortalSubscriptionStatus = 'active' | 'trialing' | 'paused' | 'cancelled' | 'other'

export interface PortalSubscription {
  id: string
  planName: string
  status: PortalSubscriptionStatus
  statusLabel: string
  /** "Billed monthly", "Billed every 3 months". */
  cadence: string
  periodStart: Date | null
  periodEnd: Date | null
  trialEnd: Date | null
  cancelAt: Date | null
}

const SUBSCRIPTION_STATUS: Record<string, PortalSubscriptionStatus> = {
  active: 'active',
  trialing: 'trialing',
  paused: 'paused',
  cancelled: 'cancelled',
  canceled: 'cancelled',
}

const PERIOD_NOUN: Record<string, [string, string]> = {
  DAILY: ['daily', 'days'],
  WEEKLY: ['weekly', 'weeks'],
  MONTHLY: ['monthly', 'months'],
  QUARTERLY: ['quarterly', 'quarters'],
  HALF_YEARLY: ['every 6 months', 'half-years'],
  ANNUAL: ['yearly', 'years'],
  YEARLY: ['yearly', 'years'],
}

export function billingCadence(period: string, count = 1): string {
  const noun = PERIOD_NOUN[period.toUpperCase()]
  if (!noun) return period ? `Billed ${words(period).toLowerCase()}` : ''
  return count > 1 ? `Billed every ${count} ${noun[1]}` : `Billed ${noun[0]}`
}

export function toPortalSubscriptions(wire: unknown): PortalSubscription[] {
  return list(record(wire)['items'])
    .map((s) => {
      const status = SUBSCRIPTION_STATUS[text(s['subscription_status']).toLowerCase()] ?? 'other'
      const plan = record(s['plan'])
      return {
        id: text(s['id']),
        planName: text(plan['name']) || text(s['plan_id']) || 'Plan',
        status,
        statusLabel:
          status === 'trialing' ? 'Trial' : words(text(s['subscription_status']) || status),
        cadence: billingCadence(text(s['billing_period']), num(s['billing_period_count']) || 1),
        periodStart: date(s['current_period_start']),
        periodEnd: date(s['current_period_end']),
        trialEnd: date(s['trial_end']),
        cancelAt: date(s['cancel_at']),
      }
    })
    .filter((s) => s.status !== 'cancelled' || (s.periodEnd?.getTime() ?? 0) > Date.now())
}

/** How far into its current period a subscription is: day N of M, as a fraction. */
export function periodProgress(
  start: Date | null,
  end: Date | null,
  now: Date = new Date(),
): { day: number; days: number; fraction: number } | null {
  if (!start || !end || end <= start) return null
  const day = 86_400_000
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / day))
  const elapsed = Math.min(
    days,
    Math.max(0, Math.floor((now.getTime() - start.getTime()) / day) + 1),
  )
  return { day: elapsed, days, fraction: elapsed / days }
}

/* ---- Invoices ------------------------------------------------------------- */

export type PortalInvoiceStatus =
  'draft' | 'open' | 'overdue' | 'failed' | 'processing' | 'paid' | 'void'

export interface PortalInvoiceLine {
  id: string
  name: string
  kind: 'Fixed' | 'Usage' | null
  quantity: string
  amount: Money
}

export interface PortalInvoice {
  id: string
  number: string
  status: PortalInvoiceStatus
  currency: string
  issuedAt: Date | null
  dueAt: Date | null
  paidAt: Date | null
  periodStart: Date | null
  periodEnd: Date | null
  subtotal: Money
  discount: Money | null
  tax: Money | null
  total: Money
  amountPaid: Money
  amountDue: Money
  lines: PortalInvoiceLine[]
}

/** Which badge an invoice wears. Voided wins; paid next; then what is owed and when. */
export function portalInvoiceStatus(
  invoiceStatus: string,
  paymentStatus: string,
  dueAt: Date | null,
  now: Date = new Date(),
): PortalInvoiceStatus {
  const invoice = invoiceStatus.toUpperCase()
  const payment = paymentStatus.toUpperCase()
  if (invoice === 'VOIDED') return 'void'
  if (invoice === 'DRAFT') return 'draft'
  if (['SUCCEEDED', 'OVERPAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment)) return 'paid'
  if (payment === 'PROCESSING') return 'processing'
  if (payment === 'FAILED') return 'failed'
  if (dueAt && dueAt.getTime() < now.getTime()) return 'overdue'
  return 'open'
}

/** An invoice the customer can pay now. */
export function isPayable(invoice: PortalInvoice): boolean {
  return (
    (invoice.status === 'open' || invoice.status === 'overdue' || invoice.status === 'failed') &&
    Number(invoice.amountDue.amount) > 0
  )
}

export function toPortalInvoice(wire: unknown, now: Date = new Date()): PortalInvoice {
  const inv = record(wire)
  const currency = text(inv['currency']) || 'USD'
  const amount = (value: unknown) => moneyOf(value, currency)
  const optional = (value: unknown) => {
    const m = amount(value)
    return Number(m.amount) === 0 ? null : m
  }
  const dueAt = date(inv['due_date'])
  return {
    id: text(inv['id']),
    number: text(inv['invoice_number']) || text(inv['id']),
    status: portalInvoiceStatus(
      text(inv['invoice_status']),
      text(inv['payment_status']),
      dueAt,
      now,
    ),
    currency: currency.toUpperCase(),
    issuedAt: date(inv['finalized_at']) ?? date(inv['created_at']),
    dueAt,
    paidAt: date(inv['paid_at']),
    periodStart: date(inv['period_start']),
    periodEnd: date(inv['period_end']),
    subtotal: amount(inv['subtotal']),
    discount: optional(inv['total_discount']),
    tax: optional(inv['total_tax']),
    total: amount(inv['total']),
    amountPaid: amount(inv['amount_paid']),
    amountDue: amount(inv['amount_remaining'] ?? inv['amount_due']),
    lines: list(inv['line_items']).map((line) => {
      const priceType = text(line['price_type']).toUpperCase()
      return {
        id: text(line['id']),
        name: text(line['display_name']) || text(line['plan_display_name']) || 'Charge',
        kind: priceType === 'USAGE' ? 'Usage' : priceType === 'FIXED' ? 'Fixed' : null,
        quantity: text(line['quantity']) || '1',
        amount: amount(line['amount']),
      }
    }),
  }
}

/** `POST /invoices` — newest first, drafts left out (the customer has nothing to act on). */
export function toPortalInvoices(wire: unknown, now: Date = new Date()): PortalInvoice[] {
  return list(record(wire)['items'])
    .map((item) => toPortalInvoice(item, now))
    .filter((invoice) => invoice.status !== 'draft')
    .sort((a, b) => (b.issuedAt?.getTime() ?? 0) - (a.issuedAt?.getTime() ?? 0))
}

/* ---- Wallets -------------------------------------------------------------- */

export interface PortalWallet {
  id: string
  name: string
  active: boolean
  statusLabel: string
  currency: string
  /** The balance in money. */
  balance: Money
  /** The balance in credits, as a decimal string. */
  credits: string
  /** What one credit costs to buy, in `currency`. */
  creditPrice: string
  autoTopup: {
    enabled: boolean
    threshold: string | null
    credits: string | null
    cooldown: PortalCooldown | null
  } | null
}

export type PortalCooldownUnit = 'minute' | 'hour' | 'day'

export interface PortalCooldown {
  value: number
  unit: PortalCooldownUnit
}

function cooldownOf(value: unknown): PortalCooldown | null {
  const c = record(value)
  const amount = num(c['value'])
  const unit = text(c['unit']).toLowerCase()
  if (amount <= 0) return null
  // Seconds are a backend unit the portal does not offer; show them as minutes, rounded up.
  if (unit === 'second') return { value: Math.max(1, Math.ceil(amount / 60)), unit: 'minute' }
  return unit === 'minute' || unit === 'hour' || unit === 'day' ? { value: amount, unit } : null
}

export function toPortalWallet(wire: unknown): PortalWallet {
  const w = record(wire)
  const currency = (text(w['currency']) || 'USD').toUpperCase()
  const auto = record(w['auto_topup'])
  const status = text(w['wallet_status']) || 'ACTIVE'
  const rate = decimalText(w['topup_conversion_rate']) || decimalText(w['conversion_rate']) || '1'
  return {
    id: text(w['id']),
    name: text(w['name']) || 'Prepaid credits',
    active: status.toUpperCase() === 'ACTIVE',
    statusLabel: words(status),
    currency,
    balance: moneyOf(w['real_time_balance'] ?? w['balance'], currency),
    credits: decimalText(w['real_time_credit_balance'] ?? w['credit_balance']) || '0',
    creditPrice: rate,
    autoTopup:
      Object.keys(auto).length === 0
        ? null
        : {
            enabled: auto['enabled'] === true,
            threshold: decimalText(auto['threshold']) || null,
            credits: decimalText(auto['amount']) || null,
            cooldown: cooldownOf(auto['cooldown']),
          },
  }
}

/** `POST /wallets` answers a bare array. Closed wallets are history, not a balance. */
export function toPortalWallets(wire: unknown): PortalWallet[] {
  const items = Array.isArray(wire) ? wire : list(record(wire)['items'])
  return items.map(toPortalWallet).filter((w) => w.statusLabel.toLowerCase() !== 'closed')
}

export type PortalTransactionDirection = 'in' | 'out'

export interface PortalWalletTransaction {
  id: string
  direction: PortalTransactionDirection
  title: string
  detail: string | null
  at: Date | null
  amount: Money
  credits: string
  pending: boolean
  /** For credits added: how many are still unused (`credits_available`). */
  remaining: string | null
  /** When credits added expire; null when they never do. */
  expiresAt: Date | null
}

const REASON_TITLE: Record<string, string> = {
  INVOICE_PAYMENT: 'Invoice payment',
  FREE_CREDIT_GRANT: 'Free credits',
  SUBSCRIPTION_CREDIT_GRANT: 'Plan credits',
  PURCHASED_CREDIT_INVOICED: 'Credits purchased',
  PURCHASED_CREDIT_DIRECT: 'Credits purchased',
  PURCHASED_CREDIT_BONUS: 'Bonus credits',
  CREDIT_NOTE: 'Credit note',
  CREDIT_EXPIRED: 'Credits expired',
  WALLET_TERMINATION: 'Wallet closed',
  MANUAL_BALANCE_DEBIT: 'Balance adjusted',
  CREDIT_ADJUSTMENT: 'Credits adjusted',
  INVOICE_VOID_REFUND: 'Refund for a voided invoice',
}

export function toPortalWalletTransactions(
  wire: unknown,
  currency: string,
): {
  items: PortalWalletTransaction[]
  total: number
} {
  const body = record(wire)
  const items = list(body['items']).map((t) => {
    const reason = text(t['transaction_reason']).toUpperCase()
    const status = text(t['transaction_status']).toUpperCase()
    return {
      id: text(t['id']),
      direction: (text(t['type']).toUpperCase() === 'DEBIT'
        ? 'out'
        : 'in') as PortalTransactionDirection,
      title: REASON_TITLE[reason] ?? (words(reason) || 'Transaction'),
      detail: text(t['description']) || null,
      at: date(t['created_at']),
      amount: moneyOf(t['amount'], text(t['currency']) || currency),
      credits: decimalText(t['credit_amount']) || '0',
      pending: status === 'PENDING',
      remaining: decimalText(t['credits_available']) || null,
      expiresAt: date(t['expiry_date']),
    }
  })
  const total = num(record(body['pagination'])['total'])
  return { items, total: total || items.length }
}

/** Credits added and used across some transactions — exact, in money and credits. */
export function walletFlows(
  transactions: readonly PortalWalletTransaction[],
  currency: string,
): Record<PortalTransactionDirection, { amount: Money; credits: string }> {
  const sum = (direction: PortalTransactionDirection) => {
    const rows = transactions.filter((t) => t.direction === direction && !t.pending)
    return {
      amount: money(decimalSum(rows.map((t) => t.amount.amount)), currency),
      credits: decimalSum(rows.map((t) => t.credits)),
    }
  }
  return { in: sum('in'), out: sum('out') }
}

export type PortalTopUpState = 'active' | 'running low' | 'expiring soon' | 'used up' | 'expired'

export interface PortalTopUp {
  id: string
  title: string
  detail: string | null
  at: Date | null
  granted: string
  remaining: string
  /** How much of it is used, 0–1. */
  consumed: number
  expiresAt: Date | null
  /** Whole days until it expires; negative once it has. */
  daysLeft: number | null
  state: PortalTopUpState
}

/** A top-up this close to its expiry, with credits left, is flagged. */
const EXPIRING_DAYS = 14
/** A top-up this far consumed is running low. */
const LOW_SHARE = 0.85

/**
 * Every credit that came in, with what is left of it: the wallet's CREDIT
 * transactions and their `credits_available`. Newest first.
 */
export function toPortalTopUps(
  transactions: readonly PortalWalletTransaction[],
  now: Date = new Date(),
): PortalTopUp[] {
  return transactions
    .filter((t) => t.direction === 'in' && !t.pending)
    .map((t) => {
      const granted = Number(t.credits)
      const remaining = t.remaining ?? t.credits
      const consumed = granted > 0 ? Math.min(1, Math.max(0, 1 - Number(remaining) / granted)) : 0
      const daysLeft = t.expiresAt
        ? Math.ceil((t.expiresAt.getTime() - now.getTime()) / 86_400_000)
        : null
      const state: PortalTopUpState =
        daysLeft !== null && daysLeft < 0
          ? 'expired'
          : Number(remaining) === 0
            ? 'used up'
            : daysLeft !== null && daysLeft <= EXPIRING_DAYS
              ? 'expiring soon'
              : consumed >= LOW_SHARE
                ? 'running low'
                : 'active'
      return {
        id: t.id,
        title: t.title,
        detail: t.detail,
        at: t.at,
        granted: t.credits,
        remaining,
        consumed,
        expiresAt: t.expiresAt,
        daysLeft,
        state,
      }
    })
}

/* ---- Payment methods and gateways ----------------------------------------- */

export interface PortalPaymentMethod {
  id: string
  provider: string
  brand: string
  /** The card network, normalised for its logo: visa, mastercard, amex, rupay… or 'card'. */
  network: string
  last4: string
  /** "08/28". */
  expires: string | null
  expired: boolean
  isDefault: boolean
}

/**
 * Network names, keyed by the brand the gateway sends with everything but
 * letters removed: Stripe's `card.brand` (visa, amex, diners, cartes_bancaires,
 * eftpos_au…) and Razorpay's `card.network` (Visa, MasterCard, American
 * Express, RuPay, Bajaj Finserv…).
 */
const NETWORKS: Record<string, [network: string, name: string]> = {
  visa: ['visa', 'Visa'],
  mastercard: ['mastercard', 'Mastercard'],
  amex: ['amex', 'American Express'],
  americanexpress: ['amex', 'American Express'],
  discover: ['discover', 'Discover'],
  diners: ['diners', 'Diners Club'],
  dinersclub: ['diners', 'Diners Club'],
  jcb: ['jcb', 'JCB'],
  unionpay: ['unionpay', 'UnionPay'],
  maestro: ['maestro', 'Maestro'],
  rupay: ['rupay', 'RuPay'],
  cartesbancaires: ['cartesbancaires', 'Cartes Bancaires'],
  eftpos: ['eftpos', 'eftpos'],
  eftposau: ['eftpos', 'eftpos'],
  bajajfinserv: ['bajaj', 'Bajaj Finserv'],
}

export function toPortalPaymentMethods(
  wire: unknown,
  now: Date = new Date(),
): PortalPaymentMethod[] {
  const out: PortalPaymentMethod[] = []
  for (const group of list(record(wire)['providers'])) {
    for (const item of list(group['items'])) {
      const card = record(item['card'])
      const raw = text(card['brand']) || text(card['network'])
      const key = raw.toLowerCase().replace(/[^a-z]/g, '')
      const [network, brand] = NETWORKS[key] ?? ['card', raw && key !== 'unknown' ? raw : 'Card']
      const month = num(card['exp_month'])
      const year = num(card['exp_year'])
      const fullYear = year < 100 ? 2000 + year : year
      out.push({
        id: text(item['id']),
        provider: text(item['provider']) || text(group['provider']),
        brand,
        network,
        last4: text(card['last4']),
        expires:
          month && year
            ? `${String(month).padStart(2, '0')}/${String(fullYear % 100).padStart(2, '0')}`
            : null,
        // A card is good through the last day of its expiry month.
        expired: month && year ? new Date(fullYear, month, 1).getTime() <= now.getTime() : false,
        isDefault: item['is_default'] === true,
      })
    }
  }
  return out.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
}

export interface PortalGateway {
  provider: string
  label: string
  /** A payment page for an invoice (`payment_link`). */
  paysInvoices: boolean
  /** A checkout page for buying credits (`checkout`). */
  checkout: boolean
  /** Saved cards: add, remove, make default. */
  savesCards: boolean
  /** Charges a saved card without the customer present. */
  autoCharge: boolean
}

const GATEWAY_LABEL: Record<string, string> = {
  stripe: 'Stripe',
  razorpay: 'Razorpay',
  paddle: 'Paddle',
  chargebee: 'Chargebee',
  nomod: 'Nomod',
  moyasar: 'Moyasar',
}

export function gatewayLabel(provider: string): string {
  return GATEWAY_LABEL[provider.toLowerCase()] ?? words(provider)
}

export function toPortalGateways(wire: unknown): PortalGateway[] {
  return list(record(wire)['payment_integrations']).map((g) => {
    const caps = new Set(list(g['capabilities']).map((c) => text(c['type'])))
    const provider = text(g['provider'])
    return {
      provider,
      label: gatewayLabel(provider),
      paysInvoices: caps.has('payment_link'),
      checkout: caps.has('checkout'),
      savesCards: caps.has('payment_method_management'),
      autoCharge: caps.has('auto_charge'),
    }
  })
}

/** A gateway's next step: a page to open (checkout, card setup), or nothing to do. */
export function toPortalActionUrl(wire: unknown): string | null {
  const body = record(wire)
  return (
    text(record(body['payment_action'])['url']) ||
    text(record(body['action'])['url']) ||
    text(record(record(body['checkout_session'])['payment_action'])['url']) ||
    null
  )
}

/* ---- Usage ---------------------------------------------------------------- */

export interface PortalQuota {
  featureId: string
  name: string
  unit: string
  used: string
  limit: string | null
  unlimited: boolean
  /** 0–100+, as the API computed it. */
  percent: number
  /** How far past the allowance, when a soft limit lets usage continue. */
  over: string | null
  resetsAt: Date | null
}

/** `GET /usage` — metered allowances only; a boolean feature has nothing to count. */
export function toPortalQuotas(wire: unknown): PortalQuota[] {
  return list(record(wire)['features'])
    .filter((f) => {
      const type = text(record(f['feature'])['type']).toLowerCase()
      return f['is_enabled'] !== false && (type === '' || type === 'metered')
    })
    .map((f) => {
      const feature = record(f['feature'])
      const limit =
        f['total_limit'] === null || f['total_limit'] === undefined
          ? null
          : String(f['total_limit'])
      const used = decimalText(f['current_usage']) || '0'
      const unlimited = f['is_unlimited'] === true || limit === null
      const over = !unlimited && limit !== null ? decimalMinus(used, limit) : null
      return {
        featureId: text(feature['id']),
        name: text(feature['name']) || 'Feature',
        unit: text(feature['unit_plural']) || text(feature['unit_singular']) || '',
        used,
        limit: unlimited ? null : limit,
        unlimited,
        percent: Number(decimalText(f['usage_percent']) || '0'),
        over: over && Number(over) > 0 ? over : null,
        resetsAt: date(f['next_usage_reset_at']),
      }
    })
}

export interface PortalSpendPoint {
  at: Date
  usage: number
  cost: number
}

export interface PortalSpendItem {
  featureId: string
  name: string
  group: string | null
  unit: string
  usage: string
  cost: Money
  /** The per-unit price, when the feature has one flat price. */
  unitCost: Money | null
  /** Share of the period's spend, 0–1. */
  share: number
  points: PortalSpendPoint[]
}

export interface PortalSpend {
  currency: string
  total: Money
  items: PortalSpendItem[]
}

/** `POST /analytics/revenue` — what usage has cost, per feature, largest first. */
export function toPortalSpend(wire: unknown): PortalSpend {
  const body = record(wire)
  const items = list(body['items'])
  const currency = (text(body['currency']) || text(items[0]?.['currency']) || 'USD').toUpperCase()
  const totalText =
    decimalText(body['total_cost']) ||
    decimalSum(items.map((i) => decimalText(i['total_cost']) || '0'))
  const totalNumber = Number(totalText)
  const merged = new Map<string, PortalSpendItem>()
  for (const item of items) {
    const feature = record(item['feature'])
    const price = record(item['price'])
    const featureId = text(item['feature_id']) || text(feature['id'])
    const cost = decimalText(item['total_cost']) || '0'
    const flat =
      text(price['billing_model']).toUpperCase() === 'FLAT_FEE' && decimalText(price['amount'])
    const existing = merged.get(featureId)
    const points = list(item['points'])
      .map((p) => ({
        at: date(p['timestamp']),
        usage: Number(decimalText(p['usage']) || 0),
        cost: Number(decimalText(p['cost']) || 0),
      }))
      .filter((p): p is PortalSpendPoint => p.at !== null)
    if (existing) {
      // One feature priced twice (a plan and an add-on): one row, summed exactly.
      const sum = decimalSum([existing.cost.amount, cost])
      merged.set(featureId, {
        ...existing,
        usage: decimalSum([existing.usage, decimalText(item['total_usage']) || '0']),
        cost: money(sum, currency),
        unitCost: null,
        share: totalNumber > 0 ? Number(sum) / totalNumber : 0,
        points: mergePoints(existing.points, points),
      })
      continue
    }
    merged.set(featureId, {
      featureId,
      name: text(item['name']) || text(feature['name']) || 'Usage',
      group: text(record(item['group'])['name']) || null,
      unit: text(item['unit_plural']) || text(item['unit']) || text(feature['unit_plural']) || '',
      usage: decimalText(item['total_usage']) || '0',
      cost: money(cost, currency),
      unitCost: flat ? money(flat, currency) : null,
      share: totalNumber > 0 ? Number(cost) / totalNumber : 0,
      points,
    })
  }
  return {
    currency,
    total: money(totalText, currency),
    items: [...merged.values()].sort((a, b) => Number(b.cost.amount) - Number(a.cost.amount)),
  }
}

function mergePoints(a: PortalSpendPoint[], b: PortalSpendPoint[]): PortalSpendPoint[] {
  const byTime = new Map<number, PortalSpendPoint>()
  for (const p of [...a, ...b]) {
    const key = p.at.getTime()
    const prev = byTime.get(key)
    byTime.set(key, prev ? { at: p.at, usage: prev.usage + p.usage, cost: prev.cost + p.cost } : p)
  }
  return [...byTime.values()].sort((x, y) => x.at.getTime() - y.at.getTime())
}

/** Daily average of a period's spend, exact to the cent (rounded half up). */
export function dailyAverage(total: Money, days: number): Money {
  return money(decimalDivide(total.amount, Math.max(1, Math.round(days)), 2), total.currency)
}

export type PortalRange = 'today' | '7d' | '30d' | 'this-month' | 'last-month'

export const PORTAL_RANGES: readonly { id: PortalRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
]

/**
 * The window a range covers, in the viewer's local days: `[start, end)`.
 * Rolling ranges end at the start of tomorrow, so today's usage counts.
 */
export function portalRangeWindow(
  range: PortalRange,
  now: Date = new Date(),
): { start: Date; end: Date; days: number } {
  const day = (offset: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  const tomorrow = day(1)
  const span = (start: Date, end: Date) => ({
    start,
    end,
    days: Math.round((end.getTime() - start.getTime()) / 86_400_000),
  })
  switch (range) {
    case 'today':
      return span(day(0), tomorrow)
    case '7d':
      return span(day(-6), tomorrow)
    case '30d':
      return span(day(-29), tomorrow)
    case 'this-month':
      return span(new Date(now.getFullYear(), now.getMonth(), 1), tomorrow)
    case 'last-month':
      return span(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(now.getFullYear(), now.getMonth(), 1),
      )
  }
}

/**
 * What is owed across unpaid invoices, summed exactly. Invoices in another
 * currency are not added in; `others` says how many were left out.
 */
export function totalDue(
  invoices: readonly PortalInvoice[],
): { amount: Money; count: number; others: number } | null {
  const unpaid = invoices.filter(isPayable)
  const first = unpaid[0]
  if (!first) return null
  const same = unpaid.filter((i) => i.amountDue.currency === first.amountDue.currency)
  return {
    amount: money(decimalSum(same.map((i) => i.amountDue.amount)), first.amountDue.currency),
    count: same.length,
    others: unpaid.length - same.length,
  }
}

/** The change from `previous` to `current`, as a fraction; null with nothing to compare. */
export function spendChange(current: Money, previous: Money): number | null {
  const before = Number(previous.amount)
  if (!(before > 0)) return null
  return (Number(current.amount) - before) / before
}

/** Where a billing period lands at today's pace: spent so far plus the daily average for the days left. */
export function projectSpend(soFar: Money, daily: Money, daysLeft: number): Money {
  const rest = decimalTimes(daily.amount, String(Math.max(0, Math.round(daysLeft))))
  return money(decimalRound(decimalSum([soFar.amount, rest]), 2), soFar.currency)
}

/**
 * A per-unit price in a unit people read: "$0.05 per minute", or per 1K or
 * 1M units when one unit costs less than a cent ("$0.20 per 1K calls").
 */
export function unitPriceLabel(price: Money, unitPlural: string): { amount: Money; per: string } {
  const unit = unitPlural || 'units'
  const singular = unit.replace(/-months$/, '-month').replace(/(?<!s)s$/, '')
  const value = Number(price.amount)
  if (value >= 0.01 || value === 0) return { amount: price, per: singular || 'unit' }
  const perThousand = decimalTimes(price.amount, '1000')
  if (Number(perThousand) >= 0.01)
    return { amount: money(perThousand, price.currency), per: `1K ${unit}` }
  return { amount: money(decimalTimes(price.amount, '1000000'), price.currency), per: `1M ${unit}` }
}

/* ---- Buying credits ------------------------------------------------------- */

/**
 * What `credits` cost at `creditPrice` — the price shown before paying. The
 * gateway charges what the top-up response says; this is the preview.
 */
export function creditsCost(credits: string, creditPrice: string, currency: string): Money | null {
  if (!DECIMAL.test(credits) || !DECIMAL.test(creditPrice)) return null
  return money(decimalRound(decimalTimes(credits, creditPrice), 2), currency)
}

/** The balance after adding `credits`. */
export function creditsAfter(balance: string, credits: string): string | null {
  if (!DECIMAL.test(balance) || !DECIMAL.test(credits)) return null
  return decimalSum([balance, credits])
}

/** A whole, positive credit amount the customer typed. */
export function parseCreditAmount(raw: string): string | null {
  const value = raw.replace(/[,\s_]/g, '')
  if (!/^\d+(\.\d+)?$/.test(value)) return null
  return Number(value) > 0 ? value.replace(/^0+(?=\d)/, '') : null
}

/* ---- Exact decimals (display only) ---------------------------------------- */

const DECIMAL = /^-?\d+(\.\d+)?$/

interface Scaled {
  value: bigint
  scale: number
}

function scaled(raw: string): Scaled {
  if (!DECIMAL.test(raw)) return { value: 0n, scale: 0 }
  const negative = raw.startsWith('-')
  const [whole = '0', fraction = ''] = raw.replace('-', '').split('.')
  const value = BigInt(`${whole}${fraction}` || '0')
  return { value: negative ? -value : value, scale: fraction.length }
}

function rescale(a: Scaled, scale: number): bigint {
  return a.value * 10n ** BigInt(scale - a.scale)
}

function render({ value, scale }: Scaled): string {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(scale + 1, '0')
  const whole = scale ? digits.slice(0, -scale) : digits
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : ''
  const body = fraction ? `${whole}.${fraction}` : whole
  return negative && body !== '0' ? `-${body}` : body
}

function decimalSum(values: readonly string[]): string {
  const parts = values.map(scaled)
  const scale = Math.max(0, ...parts.map((p) => p.scale))
  return render({ value: parts.reduce((sum, p) => sum + rescale(p, scale), 0n), scale })
}

function decimalMinus(a: string, b: string): string {
  const neg = b.startsWith('-') ? b.slice(1) : `-${b}`
  return decimalSum([a, neg])
}

function decimalTimes(a: string, b: string): string {
  const x = scaled(a)
  const y = scaled(b)
  return render({ value: x.value * y.value, scale: x.scale + y.scale })
}

function decimalRound(raw: string, places: number): string {
  const x = scaled(raw)
  if (x.scale <= places) return render(x)
  const factor = 10n ** BigInt(x.scale - places)
  const half = factor / 2n
  const value = x.value >= 0n ? (x.value + half) / factor : -((-x.value + half) / factor)
  return render({ value, scale: places })
}

function decimalDivide(raw: string, by: number, places: number): string {
  const x = scaled(raw)
  const extra = places + 1
  const value = (x.value * 10n ** BigInt(extra)) / BigInt(by)
  return decimalRound(render({ value, scale: x.scale + extra }), places)
}

/* ---- Wire helpers --------------------------------------------------------- */

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** A decimal the API sent as a string or a number; '' when it is neither. */
function decimalText(value: unknown): string {
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value)
  return DECIMAL.test(raw) ? raw : ''
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(text(value))
  return Number.isFinite(n) ? n : 0
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

function date(value: unknown): Date | null {
  const raw = text(value)
  if (!raw || raw.startsWith('0001-01-01')) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function moneyOf(value: unknown, currency: string): Money {
  try {
    return money(decimalText(value) || '0', currency || 'USD')
  } catch {
    return money('0', 'USD')
  }
}

function words(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase().trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : name.slice(0, 2)
  return letters.toUpperCase()
}

function isCssColor(value: string): boolean {
  return (
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ||
    /^(rgb|hsl|oklch)a?\([\d\s.,%/-]+\)$/i.test(value)
  )
}
