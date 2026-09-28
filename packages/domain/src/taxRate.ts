/**
 * A tax rate, as the list reads it.
 *
 * A tax rate is a percentage the billing engine adds to an invoice, scoped to
 * where it applies — internal, external, or a one-time charge. The API keeps a
 * wider record (its `taxRateType`, `taxRateStatus`, the audit columns); this is
 * only the list's read model, the same way coupons split a list model from the
 * editor that will follow.
 *
 * One shape the transport does not settle: status arrives with three values
 * ('published', 'deleted', 'archived') and collapses to the two a catalogue
 * shows.
 */

export const TaxRateStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type TaxRateStatus = (typeof TaxRateStatus)[keyof typeof TaxRateStatus]

export const TAX_RATE_STATUS_LABEL: Record<TaxRateStatus, string> = {
  [TaxRateStatus.Published]: 'Published',
  [TaxRateStatus.Archived]: 'Archived',
}

/**
 * Where a tax rate applies. The wire's `scope`, unchanged.
 *
 * `INTERNAL` and `EXTERNAL` distinguish a rate the seller absorbs from one it
 * passes on; `ONETIME` is a rate attached to a single charge rather than a
 * recurring line.
 */
export const TaxRateScope = {
  Internal: 'INTERNAL',
  External: 'EXTERNAL',
  OneTime: 'ONETIME',
} as const
export type TaxRateScope = (typeof TaxRateScope)[keyof typeof TaxRateScope]

export const TAX_RATE_SCOPE_LABEL: Record<TaxRateScope, string> = {
  [TaxRateScope.Internal]: 'Internal',
  [TaxRateScope.External]: 'External',
  [TaxRateScope.OneTime]: 'One-time',
}

/** The read model the list renders. */
export interface TaxRate {
  id: string
  name: string
  /** A short code the rate is referenced by. Empty when it has none. */
  code: string
  description: string
  /** The percentage as the API sends it — `"18"`, not `0.18`. Empty when absent. */
  percentageValue: string
  scope: TaxRateScope
  status: TaxRateStatus
  createdAt: Date | null
  updatedAt: Date | null
}

export const TaxRateSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type TaxRateSortField = (typeof TaxRateSortField)[keyof typeof TaxRateSortField]

export const TAX_RATE_SORT_LABEL: Record<TaxRateSortField, string> = {
  [TaxRateSortField.Name]: 'Name',
  [TaxRateSortField.CreatedAt]: 'Created',
  [TaxRateSortField.UpdatedAt]: 'Updated',
}

export interface TaxRateQuery {
  page: number
  pageSize: number
  search: string
  statuses: TaxRateStatus[]
  sortBy: TaxRateSortField
  sortDirection: 'asc' | 'desc'
}

export const DEFAULT_TAX_RATE_QUERY: TaxRateQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: TaxRateSortField.Name,
  sortDirection: 'asc',
}
