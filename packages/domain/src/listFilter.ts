/**
 * Granular list filters — field, operator, value — the way V1's query builder
 * worked, and the way every `POST /<entity>/search` endpoint evaluates them.
 *
 * A filter is product vocabulary only: which field, which comparison, what to
 * compare against. How it travels (`data_type`, the tagged `value` union) is
 * `@fp/query`'s business, and is derived from the field's `kind`.
 *
 * Only the operators the backend implements are modelled (see the backend's
 * `types.FilterOperatorType`). `starts_with`/`ends_with` are a backend TODO and
 * are not offered, so no filter can be built that the API would ignore.
 */

export const FilterOp = {
  Eq: 'eq',
  Contains: 'contains',
  NotContains: 'not_contains',
  Gt: 'gt',
  Lt: 'lt',
  In: 'in',
  NotIn: 'not_in',
  Before: 'before',
  After: 'after',
} as const
export type FilterOp = (typeof FilterOp)[keyof typeof FilterOp]

/** What a field holds, which decides its operators and its value editor. */
export type FilterKind = 'text' | 'options' | 'date' | 'number'

/** The operators each kind offers, in the order V1 offered them. */
export const FILTER_OPS: Record<FilterKind, readonly FilterOp[]> = {
  text: [FilterOp.Contains, FilterOp.NotContains, FilterOp.Eq],
  options: [FilterOp.In, FilterOp.NotIn],
  date: [FilterOp.Before, FilterOp.After],
  number: [FilterOp.Eq, FilterOp.Gt, FilterOp.Lt],
}

/** One filterable field on a list. `field` is the wire name the search endpoint filters on. */
export interface ListFilterSpec {
  field: string
  label: string
  kind: FilterKind
  /** The choices of an `options` field. */
  options?: readonly { value: string; label: string }[]
}

/**
 * One applied condition. `value` is a string for text, number and date
 * (`YYYY-MM-DD`, a calendar day) and a list for options.
 */
export interface ListFilter {
  field: string
  op: FilterOp
  value: string | string[]
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Whether a filter is complete and valid for its spec; incomplete ones never reach a request. */
export function isRunnableFilter(filter: ListFilter, spec: ListFilterSpec | undefined): boolean {
  if (!spec || !FILTER_OPS[spec.kind].includes(filter.op)) return false
  const { value } = filter
  switch (spec.kind) {
    case 'options':
      return Array.isArray(value) && value.length > 0
    case 'date':
      return typeof value === 'string' && DAY.test(value)
    case 'number':
      return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
    case 'text':
      return typeof value === 'string' && value.trim() !== ''
  }
}

/**
 * Fills in the choices of `options` fields whose choices are the account's own
 * records — customers, plans — which the page loads and the static spec cannot
 * know.
 */
export function withFilterOptions(
  specs: readonly ListFilterSpec[],
  options: Readonly<Record<string, readonly { value: string; label: string }[]>>,
): ListFilterSpec[] {
  return specs.map((spec) => {
    const choices = options[spec.field]
    return choices ? { ...spec, options: choices } : spec
  })
}

/** Keeps the filters that are runnable against these specs. */
export function runnableFilters(
  filters: readonly ListFilter[],
  specs: readonly ListFilterSpec[],
): ListFilter[] {
  return filters.filter((filter) =>
    isRunnableFilter(
      filter,
      specs.find((spec) => spec.field === filter.field),
    ),
  )
}

/**
 * Whether two filter lists ask for the same thing, regardless of property or
 * option order — a URL can spell the same filter either way.
 */
export function sameListFilters(a: readonly ListFilter[], b: readonly ListFilter[]): boolean {
  const key = (filter: ListFilter) =>
    JSON.stringify([
      filter.field,
      filter.op,
      Array.isArray(filter.value) ? [...filter.value].sort() : filter.value,
    ])
  const left = a.map(key).sort()
  const right = b.map(key).sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Filters as a URL value, and back. A hand-edited or stale URL degrades to
 * "no filter" for whatever it cannot read rather than to an error.
 */
export function encodeListFilters(filters: readonly ListFilter[]): string | undefined {
  return filters.length > 0 ? JSON.stringify(filters) : undefined
}

export function decodeListFilters(raw: unknown): ListFilter[] {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  const ops = new Set<string>(Object.values(FilterOp))
  return parsed.flatMap((entry): ListFilter[] => {
    if (!entry || typeof entry !== 'object') return []
    const { field, op, value } = entry as Record<string, unknown>
    if (typeof field !== 'string' || typeof op !== 'string' || !ops.has(op)) return []
    if (typeof value === 'string') return [{ field, op: op as FilterOp, value }]
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return [{ field, op: op as FilterOp, value: value as string[] }]
    }
    return []
  })
}
