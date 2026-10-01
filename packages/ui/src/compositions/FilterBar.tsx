import { useState, type ReactNode } from 'react'
import { FilterIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import { Filters } from '@ui/components/reui/filters/filters'
import {
  createFilterQuery,
  createFilterRule,
  flattenFilterConditions,
} from '@ui/components/reui/filters/filters-query'
import {
  getFilterOperator,
  operatorTakesValue,
  resolveFilterOperators,
} from '@ui/components/reui/filters/filters-operators'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * Filtering, over `@reui/filters`.
 *
 * The registry component edits a *tree* — nested AND/OR groups — and that is
 * more than our URLs can carry. Every list screen keeps its query in search
 * params so a filtered view is a link, and a nested boolean expression does
 * not survive that round trip without inventing an encoding for it.
 *
 * So this deliberately uses the `basic` chrome, which renders and edits the
 * flat case, and hands the caller `flattenFilterConditions` output: a plain
 * array of `{ field, operator, values }`. That is what a URL can hold and what
 * `POST /<entity>/search` already accepts.
 *
 * The tree is still the underlying state, so moving to nested filtering later
 * is a change of `variant` plus a URL codec — not a rewrite. Until then, a
 * shape we cannot serialise is a shape we do not offer.
 */
export const FilterBarProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters', 'ui/button'],
  note: 'Filters in `basic` chrome, flattened to what a URL and the search API can carry.',
})

export interface FlatFilter {
  field: string
  operator: string
  values: unknown[]
}

export interface FilterBarProps {
  fields: FilterField[]
  query: FilterQuery
  onQueryChange: (query: FilterQuery, flat: FlatFilter[]) => void
  size?: 'sm' | 'default'
  /**
   * Which chrome draws the query.
   *
   * `basic` is the flat pill row the registry documents as "a toolbar over a
   * table" — a chip reading `Status  is any of  Select…` with a kebab, the
   * trigger below, and Clear. That is the reference bar, and it is the default.
   *
   * `advanced` is the nested condition builder, which the registry documents as
   * being for "a sidebar or a settings page". Rendered `inline` in a toolbar it
   * draws its whole empty-state panel — a glyph, "No filters yet", and Add
   * filter / Add group — across the bar, and it honours neither `trigger` nor
   * `showClear`, both of which belong to the chip row. It is kept as an option
   * for a surface that genuinely wants a builder; it is not what a list screen
   * wants.
   */
  variant?: 'basic' | 'advanced'
  /** Where the advanced builder renders. Ignored in `basic`. */
  advancedMode?: 'popover' | 'inline'
  /** Where the advanced panel sits against its trigger. */
  advancedAlign?: 'start' | 'center' | 'end'
  /** A Clear button once the query holds anything (the reference bar has one). */
  showClear?: boolean
  /**
   * What opens the chip row's editor. Defaults to the outline "Filter" button
   * below, which is what every caller before `EntityList` renders.
   *
   * Additive and optional on purpose: `EntityList` needs an icon-only trigger
   * carrying a count badge, and the alternative — each list drawing its own
   * trigger beside a bar that also draws one — is two Filter buttons. Only the
   * `basic` chip row draws a trigger at all; `advanced` ignores it, as before.
   */
  trigger?: ReactNode
}

/** A query with nothing in it. Exported so callers can seed state with it. */
export function emptyFilterQuery(): FilterQuery {
  return createFilterQuery()
}

/** Whether a stored value counts as absent, matching the primitive's own
 *  `missing-value` test: nothing chosen, or every entry blank. */
function isBlankFilterValue(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

/**
 * What a query means once half-built rules are dropped. Two queries with the
 * same signature select the same records, whatever drafts are open.
 *
 * A condition is only counted when it actually FILTERS: its operator takes no
 * value (so an empty value list is complete), or it carries at least one
 * non-blank value. A value-taking operator with an empty value list matches
 * everything — a no-op indistinguishable from no condition at all — and a
 * caller drops it, echoing back the same committed query it started from.
 *
 * `flattenFilterConditions` alone is NOT that test: it only skips a rule with
 * no operator (`isFilterRuleComplete`), so a rule with an operator but no value
 * yet — the state every rule passes through between the condition step and the
 * value step — still reaches it and flattens to a `values: []` condition. Left
 * to `flattenFilterConditions`, that half-built rule made `seen` disagree with
 * the empty query the caller echoes back, tripping the re-seed below and wiping
 * the chip the user was midway through filling in the instant they chose its
 * operator. Deciding "same records" here, with the schema's arity, is what
 * keeps the draft alive across the operator step as well as the field step.
 */
function committedSignature(query: FilterQuery, fields: FilterField[]): string {
  const runnable = flattenFilterConditions(query).filter((condition) => {
    const field = fields.find((entry) => entry.id === condition.field)
    // `resolveFilterOperators` handles the array, the resolver-function and the
    // fall-back-to-catalog forms `FilterField.operators` can take.
    const operator = field
      ? getFilterOperator(resolveFilterOperators(field), condition.operator)
      : undefined
    // Unresolved operators fall back to "takes a value" (arity `one`), so an
    // unknown operator with no value is treated as half-built, not committed.
    if (!operatorTakesValue(operator)) return true
    return condition.values.length > 0 && !condition.values.every(isBlankFilterValue)
  })
  return JSON.stringify(runnable)
}

export function FilterBar({
  fields,
  query,
  onQueryChange,
  size = 'sm',
  variant = 'basic',
  advancedMode = 'popover',
  advancedAlign = 'start',
  showClear = true,
  trigger,
}: FilterBarProps) {
  /*
   * The bar owns the tree; the caller owns what it *means*.
   *
   * This is not a convenience — without it the bar cannot be used at all.
   * Callers derive `query` from the committed filter (`statuses` in the URL),
   * and picking an attribute creates a rule whose value has not been chosen
   * yet. `flattenFilterConditions` deliberately skips such a rule, so the
   * caller is told "nothing is filtered", recomputes the same empty query it
   * started with, and the chip the user was halfway through filling in is
   * destroyed under them. Choosing "Status" put the chip on screen and took it
   * away in the same frame, so no filter could ever be completed.
   *
   * Holding the draft here keeps the half-built rule alive locally while the
   * caller still only ever hears about rules that are finished.
   */
  const [draft, setDraft] = useState<FilterQuery>(query)
  /*
   * The last committed signature the CALLER's `query` prop has delivered — not
   * what the bar last emitted. It advances only in the render guard below, when
   * the prop itself moves, so it is a faithful record of what the caller has
   * actually committed to and nothing the bar does optimistically can run ahead
   * of it.
   */
  const incoming = committedSignature(query, fields)
  const [seen, setSeen] = useState(incoming)

  /*
   * Re-seed only when the committed meaning changes from outside — a URL, the
   * back button, a Clear elsewhere. Two guards, because a controlled caller
   * echoes every change back and the echo may be a render (or several) behind:
   *
   *   1. `incoming !== seen` — the prop's committed meaning actually moved.
   *      Until it does, the bar's own optimistic advance cannot be mistaken for
   *      an outside edit, which is what an echo that lands a commit LATE (a URL
   *      round trip, `navigate` resolving on a microtask) otherwise looks like:
   *      the bar has emitted and re-rendered, but the prop still holds the
   *      pre-emit value, so a guard keyed on "what we emitted" would wrongly
   *      wipe the draft — and the chip and its open editor with it — in the gap.
   *   2. `incoming !== committedSignature(draft)` — and the new meaning differs
   *      from what the draft already commits to. When they agree, the prop is
   *      merely the bar's own change arriving; re-seeding would replace an
   *      identical draft and close a popover mid-edit for nothing.
   *
   * Comparing signatures rather than trees is what lets a half-built rule (the
   * chip between its condition and its value) survive the caller's echo of the
   * empty query it flattens to. Adjusting state during render is the documented
   * way to react to a changed prop without a wasted commit.
   */
  if (incoming !== seen) {
    setSeen(incoming)
    if (incoming !== committedSignature(draft, fields)) {
      setDraft(query)
    }
  }

  return (
    <Filters
      size={size}
      variant={variant}
      advancedMode={advancedMode}
      advancedAlign={advancedAlign}
      showClear={showClear}
      fields={fields}
      query={draft}
      onQueryChange={(next: FilterQuery) => {
        // Optimistic: the draft owns the tree between commits, and `seen` is
        // left to the render guard so the caller's echo — however late — is
        // recognised as an echo rather than an outside edit.
        setDraft(next)
        /*
         * `flattenFilterConditions` skips a half-built rule, so a rule whose
         * value has not been chosen yet cannot reach the request and quietly
         * filter everything to nothing.
         */
        const flat = flattenFilterConditions(next) as FlatFilter[]
        onQueryChange(next, flat)
      }}
      trigger={
        // Replaces the row's own "Add filter" button, so the control reads the
        // same as Sort beside it. Only the chip row draws a trigger — the
        // inline builder ignores this, which is why it used to vanish.
        trigger ?? (
          <Button variant="outline" size="sm">
            <FilterIcon aria-hidden className="size-4" />
            Filter
          </Button>
        )
      }
    />
  )
}

const ANY_OF = [{ value: 'is_any_of', label: 'is any of', arity: 'many' as const }]
const IS = [{ value: 'is', label: 'is' }]

/** A select field whose only operator is `is_any_of`, so the result is a list a URL can store. */
export function selectFilterField(
  id: string,
  label: string,
  options: { value: string; label: string }[],
): FilterField {
  return { id, label, type: 'select', options, operators: ANY_OF, defaultOperator: 'is_any_of' }
}

/** Rebuilds the tree from the values the URL is holding, so the chips cannot drift from it. */
export function selectFilterQuery(id: string, values: readonly string[]): FilterQuery {
  if (values.length === 0) return createFilterQuery()
  return createFilterQuery([
    createFilterRule({ id, path: [id], operator: 'is_any_of', value: [...values] }),
  ])
}

/** Every value chosen for `field`, across rules, keeping only ones the schema allows. */
export function readSelectFilter(
  flat: FlatFilter[],
  field: string,
  allowed: ReadonlySet<string>,
): string[] {
  const values = flat
    .filter((entry) => entry.field === field)
    .flatMap((entry) => entry.values.map(String))
    .filter((value) => allowed.has(value))
  return [...new Set(values)]
}

/**
 * Status (or any multi-value enum) as the advanced filter's one field.
 *
 * The dropdown and this builder write the same array, so picking "Published"
 * in either place shows up in the other.
 */
export function statusFilter<S extends string>({
  values,
  choices,
  onChange,
  label = 'Status',
}: {
  values: readonly S[]
  choices: readonly { value: S; label: string }[]
  onChange: (values: S[]) => void
  label?: string
}) {
  const allowed = new Set<string>(choices.map((choice) => choice.value))
  return {
    fields: [selectFilterField('status', label, choices.map((choice) => ({ ...choice })))],
    query: selectFilterQuery('status', values),
    activeCount: values.length > 0 ? 1 : 0,
    onQueryChange: (_next: FilterQuery, flat: FlatFilter[]) => {
      onChange(readSelectFilter(flat, 'status', allowed) as S[])
    },
  }
}

/**
 * A single-value enum, such as a sync state that is either set or "all".
 *
 * `empty` is the unfiltered value and is not offered as a choice — clearing
 * the rule is what returns to it.
 */
export function singleChoiceFilter<S extends string>({
  id,
  label,
  value,
  empty,
  choices,
  onChange,
}: {
  id: string
  label: string
  value: S
  empty: S
  choices: readonly { value: S; label: string }[]
  onChange: (value: S) => void
}) {
  const offered = choices.filter((choice) => choice.value !== empty)
  const allowed = new Set<string>(offered.map((choice) => choice.value))
  const active = value !== empty && allowed.has(value)
  return {
    fields: [
      {
        id,
        label,
        type: 'select' as const,
        options: offered.map((choice) => ({ value: choice.value, label: choice.label })),
        operators: IS,
        defaultOperator: 'is',
      } satisfies FilterField,
    ],
    query: active
      ? createFilterQuery([createFilterRule({ id, path: [id], operator: 'is', value })])
      : createFilterQuery(),
    activeCount: active ? 1 : 0,
    onQueryChange: (_next: FilterQuery, flat: FlatFilter[]) => {
      const next = String(flat.find((entry) => entry.field === id)?.values[0] ?? '')
      onChange((allowed.has(next) ? next : empty) as S)
    },
  }
}
