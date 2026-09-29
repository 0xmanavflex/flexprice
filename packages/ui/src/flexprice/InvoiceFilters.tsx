import { InvoiceStatus, STORED_INVOICE_STATUSES } from '@fp/domain'
import { FilterBar, type FlatFilter } from '@ui/compositions/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * The invoice list's advanced filter, over `@reui/filters`.
 *
 * The same shape as `PaymentFilters`: the faceted builder as the registry
 * component, controlled from the query so the chips always reflect the URL.
 *
 * Its absence was a real hole rather than a missing nicety. `InvoiceQuery`
 * already carries `statuses`, the URL codec already parses `?status=`, and the
 * search endpoint already filters on it — but with no control in the toolbar
 * the only way to reach, say, a skipped invoice was to hand-write the URL. A
 * tenant whose only invoice was `SKIPPED` saw "No invoices yet" on a list that
 * was not empty.
 *
 * Status today; a date range and an amount band join `FIELDS` when the search
 * contract can carry them.
 */
export const InvoiceFiltersProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters'],
  note: 'Advanced filter builder bound to the invoice query. Status today; the field array grows.',
})

/**
 * The labels, spelled here rather than imported.
 *
 * Every other status enum in `@fp/domain` ships a `*_STATUS_LABEL` map;
 * invoices do not, and the domain package is outside this change. The strings
 * match `InvoiceStatusBadge`'s own, so a chip and a row read the same word.
 */
const STATUS_LABEL: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Draft]: 'Draft',
  [InvoiceStatus.Open]: 'Open',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Overdue]: 'Overdue',
  [InvoiceStatus.Void]: 'Void',
  [InvoiceStatus.Skipped]: 'Skipped',
}

/**
 * Only the statuses the API actually stores are offered.
 *
 * `Paid` and `Overdue` are computed by `deriveInvoiceStatus` from a payment
 * status and a due date; neither is a field on an invoice, so neither can be
 * asked of the API. Offering them here would be worse than leaving them out:
 * `toInvoiceFilter` drops what it cannot map, so the request would go out with
 * no status at all, the API would answer with every invoice, and the reader
 * would get an unfiltered list under a chip insisting it was filtered. On a
 * billing console, a wrong answer presented as a right one is the failure mode
 * worth engineering against.
 *
 * Filtering by them needs the backend to learn the concept, or a client-side
 * pass that can also correct `pagination.total` — not a fifth option in a list.
 */
const STATUS_OPTIONS = STORED_INVOICE_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL[value],
}))

const FIELDS: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: STATUS_OPTIONS,
    operators: [{ value: 'is_any_of', label: 'is any of', arity: 'many' }],
    defaultOperator: 'is_any_of',
  },
]

/** Guards what comes back out of the bar, on the same rule as the options. */
const STATUSES = new Set<string>(STORED_INVOICE_STATUSES)

export interface InvoiceFiltersProps {
  statuses: InvoiceStatus[]
  onStatusesChange: (statuses: InvoiceStatus[]) => void
}

export function InvoiceFilters({ statuses, onStatusesChange }: InvoiceFiltersProps) {
  /*
   * Derived from the committed filter, never held locally. `FilterBar` owns the
   * half-built draft — a rule whose value has not been chosen yet — so a second
   * copy here would fight it and destroy the chip mid-edit.
   */
  const query: FilterQuery =
    statuses.length > 0
      ? createFilterQuery([
          createFilterRule({
            id: 'status',
            path: ['status'],
            operator: 'is_any_of',
            value: statuses,
          }),
        ])
      : createFilterQuery()

  return (
    <FilterBar
      fields={FIELDS}
      query={query}
      onQueryChange={(_next, flat: FlatFilter[]) => {
        const rule = flat.find((f) => f.field === 'status')
        const next = (rule?.values ?? [])
          .map(String)
          .filter((s): s is InvoiceStatus => STATUSES.has(s))
        onStatusesChange(next)
      }}
    />
  )
}
