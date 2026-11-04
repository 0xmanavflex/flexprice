import type { ListFilter, ListFilterSpec } from './listFilter'
/**
 * A price unit, as the list reads it.
 *
 * A price unit lets a catalogue charge in something other than a currency:
 * credits, tokens, minutes: by pinning a code and symbol to a base currency
 * through a conversion rate (`amount × conversion_rate = base_currency_amount`).
 * V1 keeps the whole thing in a list and a drawer, with no detail page; this is
 * that same shape.
 *
 * The one fact the backend enforces and the editor must reflect: once created,
 * only the **name** (and metadata) can change. The code, symbol, base currency
 * and conversion rate are immutable: integrations and issued prices key off
 * them: so the edit drawer shows those four read-only rather than pretending
 * they can be edited.
 */
import { z } from 'zod'

export const PriceUnitStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type PriceUnitStatus = (typeof PriceUnitStatus)[keyof typeof PriceUnitStatus]

export const PRICE_UNIT_STATUS_LABEL: Record<PriceUnitStatus, string> = {
  [PriceUnitStatus.Published]: 'Active',
  [PriceUnitStatus.Archived]: 'Archived',
}

/** The read model the list and cards render. */
export interface PriceUnit {
  id: string
  name: string
  /** The three-character code: `CRD`, `TOK`. Immutable once created. */
  code: string
  /** The glyph a rendered amount carries: `⛁`, `★`. Immutable once created. */
  symbol: string
  /** The ISO currency the rate converts into: `USD`. Immutable once created. */
  baseCurrency: string
  /**
   * The exchange rate to the base currency, as the API sends it: a string
   * (`"0.01"`), not a number, so no precision is lost crossing the boundary.
   */
  conversionRate: string
  status: PriceUnitStatus
  /** Free-form key/value fields; absent or empty when none. */
  metadata?: Record<string, string>
  createdAt: Date | null
  updatedAt: Date | null
}

export const PriceUnitSortField = {
  Name: 'name',
  Code: 'code',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type PriceUnitSortField = (typeof PriceUnitSortField)[keyof typeof PriceUnitSortField]

export const PRICE_UNIT_SORT_LABEL: Record<PriceUnitSortField, string> = {
  [PriceUnitSortField.Name]: 'Name',
  [PriceUnitSortField.Code]: 'Code',
  [PriceUnitSortField.CreatedAt]: 'Created',
  [PriceUnitSortField.UpdatedAt]: 'Updated',
}

/** Table or cards. A layout, not a filter: kept out of the fetch key. */
export const PriceUnitView = {
  Table: 'table',
  Cards: 'cards',
} as const
export type PriceUnitView = (typeof PriceUnitView)[keyof typeof PriceUnitView]

export interface PriceUnitQuery {
  page: number
  pageSize: number
  search: string
  statuses: PriceUnitStatus[]
  sortBy: PriceUnitSortField
  sortDirection: 'asc' | 'desc'
  view: PriceUnitView
  /** Granular field filters, applied by the search endpoint. See `PRICE_UNIT_FILTERS`. */
  filters?: ListFilter[]
}

export const DEFAULT_PRICE_UNIT_QUERY: PriceUnitQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: PriceUnitSortField.UpdatedAt,
  sortDirection: 'desc',
  view: PriceUnitView.Table,
  filters: [],
}
/** What the price unit list can filter on: V1's fields, by their wire names. */
export const PRICE_UNIT_FILTERS: readonly ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  { field: 'code', label: 'Code', kind: 'text' },
  { field: 'base_currency', label: 'Base currency', kind: 'text' },
  {
    field: 'status',
    label: 'Status',
    kind: 'options',
    options: [
      { value: 'published', label: 'Active' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  { field: 'created_at', label: 'Created', kind: 'date' },
]

/**
 * The rules for creating a price unit, and: narrowed: for editing one.
 *
 * The whole shape is required on create. On an edit only `name` is submitted
 * (the backend rejects a change to the rest), so the form keeps the same schema
 * but renders the immutable four read-only. `conversionRate` is a `number` here
 * because the number field emits one; the query layer stringifies it for the
 * wire, which is where the API wants a string.
 *
 * `code` is exactly three characters: V1's rule, and the backend's. Currencies
 * are three letters too, but the field is a select over known codes, so `min(1)`
 * (i.e. "one was chosen") is the real constraint there.
 */
export const createPriceUnitSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  code: z.string().trim().length(3, 'Use a three-character code'),
  symbol: z.string().trim().min(1, 'Enter a symbol'),
  baseCurrency: z.string().trim().min(1, 'Select a base currency'),
  conversionRate: z
    .number({ message: 'Enter a conversion rate' })
    .positive('Must be greater than zero'),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type CreatePriceUnit = z.infer<typeof createPriceUnitSchema>

/**
 * A blank draft, so the create form starts on a valid, empty shape.
 *
 * The rate starts at `1`: the identity, "one unit is one of the base currency"
 *: which is both a sensible default and a value that already passes the schema,
 * so the form does not open showing an error on an untouched field.
 */
export function emptyPriceUnit(): CreatePriceUnit {
  return { name: '', code: '', symbol: '', baseCurrency: '', conversionRate: 1 }
}

/**
 * The currencies a price unit can convert into.
 *
 * A focused set of the common ISO-4217 codes rather than the full table: the
 * base currency is a rate anchor, not a billing currency, so the long tail is
 * noise here. The list can grow when a real one is asked for. Labels are the
 * code and its symbol ("USD ($)"), the way a currency picker reads elsewhere.
 */
export const PRICE_UNIT_CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$)' },
] as const
