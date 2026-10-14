import { FilterOp, runnableFilters, type ListFilter, type ListFilterSpec } from '@fp/domain'

/**
 * Name search, for the endpoints that have no name-search field.
 *
 * `FeatureFilter` carries a first-class `nameContains`. `PlanFilter`,
 * `AddonFilter`, `CouponFilter` and `PriceUnitFilter` do not — and this is the
 * trap, because sending one anyway *looks* like it works:
 *
 *   - the SDK parses every request body through a generated zod schema, which
 *     **strips** keys the model does not declare. `nameContains` never reaches
 *     the network. Verified live: `POST /plans/search` received
 *     `{expand, limit, offset, sort}` and nothing else.
 *   - the backend ignores a hand-rolled `name_contains` on these four routes
 *     too, so even bypassing the SDK would not help — searching for
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
  return runnableFilters(filters, specs).map((filter) => {
    const spec = specs.find((entry) => entry.field === filter.field)!
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
