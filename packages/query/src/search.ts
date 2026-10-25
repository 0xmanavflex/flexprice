import {
  FilterOp,
  runnableFilters,
  splitKeyValue,
  type ListFilter,
  type ListFilterSpec,
} from '@fp/domain'

/**
 * Name search, for the endpoints that have no name-search field.
 *
 * `FeatureFilter` carries a first-class `nameContains`. `PlanFilter`,
 * `AddonFilter`, `CouponFilter` and `PriceUnitFilter` do not: and this is the
 * trap, because sending one anyway *looks* like it works:
 *
 *   - the SDK parses every request body through a generated zod schema, which
 *     **strips** keys the model does not declare. `nameContains` never reaches
 *     the network. Verified live: `POST /plans/search` received
 *     `{expand, limit, offset, sort}` and nothing else.
 *   - the backend ignores a hand-rolled `name_contains` on these four routes
 *     too, so even bypassing the SDK would not help: searching for
 *     `"zzzznomatch"` returned every row.
 *   - the MSW handler honoured *both* spellings, so every test passed while
 *     the search box did nothing against the real API.
 *
 * What these routes do support is the generic filter DSL, which the SDK models
 * as `filters: FilterCondition[]` and the backend evaluates server-side.
 * Verified live against plans, add-ons and coupons: `"Tes"` matched one row,
 * `"zzzznomatch"` matched none.
 *
 * Server-side matters here beyond tidiness: the alternative is filtering the
 * fetched page in the browser, which searches 25 rows out of however many exist
 * and reports a total that disagrees with what is on screen.
 */

/** A `contains` condition on `name`, as the search endpoints' filter DSL. */
export function nameContainsFilter(term: string): Record<string, unknown>[] {
  return [
    {
      field: 'name',
      operator: 'contains',
      dataType: 'string',
      value: { string: term },
    },
  ]
}

/**
 * The status facet, as the field the search endpoints filter on server-side.
 *
 * `status` is a real column on every catalogue and customer table, and the
 * search endpoints accept it as a top-level field: verified live, and it is
 * what `catalogStats` already counts the published/archived split with. So
 * there was never a reason to narrow by status in the browser.
 *
 * Narrowing on the page is not a smaller version of narrowing on the server, it
 * is a different and wrong thing: the request fetches one page, the browser
 * drops rows from *that page*, and the pager still reports the server's
 * unfiltered total. Asking for Archived then shows "287 customers" above three
 * rows, and most of the pages it offers render empty: the matches are spread
 * through pages the browser never fetched.
 *
 * The field takes one value, so this answers for one:
 *
 *   - **nothing selected**: no narrowing, which is the same request as before.
 *   - **one selected**: that status, server-side.
 *   - **every known status selected**: no narrowing, because asking for all of
 *     them is asking for all of them.
 *
 * Any other combination cannot be expressed, and would need either several
 * requests whose pages could not be reconciled into one pager, or an `OR` the
 * DSL does not have (Ent's `Where(...)` conjoins predicates). Every status
 * facet in the console is binary, so that case does not arise today; it throws
 * rather than silently widening to every row, because a filter that quietly
 * stops filtering is the bug this function exists to remove.
 */
export function statusFilterField(
  selected: readonly string[],
  known: readonly string[],
): Record<string, unknown> {
  if (selected.length === 0) return {}

  const wanted = [...new Set(selected)]
  if (known.length > 0 && wanted.length >= known.length) return {}
  if (wanted.length === 1) return { status: wanted[0] }

  throw new Error(
    `Cannot filter by ${wanted.length} statuses at once: the search endpoints take a single ` +
      `status and the filter DSL has no OR. Narrow the facet to one, or add server support.`,
  )
}

/**
 * Granular list filters as the search endpoints' filter DSL.
 *
 * Incomplete filters are dropped first, so a half-built rule never narrows a
 * request. A date is a calendar day: "before 1 Oct" is before the start of that
 * day and "after 1 Oct" is after its end, both in UTC, which is how the lists
 * cut their days.
 */
export function toFilterConditions(
  filters: readonly ListFilter[],
  specs: readonly ListFilterSpec[],
): Record<string, unknown>[] {
  return runnableFilters(filters, specs).flatMap((filter) => {
    const spec = specs.find((entry) => entry.field === filter.field)!
    // A key/value pair is not a filter condition: it travels as the search's
    // own `metadata` map (see `toMetadataFilter`).
    if (spec.kind === 'keyvalue') return []
    const base = { field: filter.field, operator: filter.op }
    switch (spec.kind) {
      case 'options':
        return { ...base, dataType: 'array', value: { array: filter.value as string[] } }
      case 'number':
        return { ...base, dataType: 'number', value: { number: Number(filter.value) } }
      case 'date': {
        const day = new Date(`${filter.value as string}T00:00:00Z`)
        const at = filter.op === FilterOp.After ? new Date(day.getTime() + 86_400_000) : day
        return { ...base, dataType: 'date', value: { date: at.toISOString() } }
      }
      case 'text':
        return { ...base, dataType: 'string', value: { string: (filter.value as string).trim() } }
    }
  })
}

/**
 * The key/value filters as the search's `metadata` map (`{ region: 'eu' }`):
 * every pair must match. Empty when there are none, so it is left out.
 */
export function toMetadataFilter(
  filters: readonly ListFilter[],
  specs: readonly ListFilterSpec[],
): Record<string, string> {
  const metadata: Record<string, string> = {}
  for (const filter of runnableFilters(filters, specs)) {
    const spec = specs.find((entry) => entry.field === filter.field)
    if (spec?.kind !== 'keyvalue') continue
    const pair = splitKeyValue(filter.value as string)
    if (pair) metadata[pair.key] = pair.value
  }
  return metadata
}
