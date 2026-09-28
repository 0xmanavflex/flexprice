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
