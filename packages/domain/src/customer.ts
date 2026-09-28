/**
 * A customer, as the billing list reads it.
 *
 * A customer is who you bill — a name, the ways to reach them, and the external
 * id that ties the record back to your own system. V1 spread these across a
 * handful of half-overlapping views; this is only the list's read model. The
 * subscriptions, invoices and payments that hang off a customer are their own
 * surfaces, reached from the detail page, not folded in here.
 *
 * One shape crosses this boundary that transport does not: the API's status
 * knows a soft-deleted state the list has no column for, so it collapses to the
 * two a billing list actually shows.
 */

export const CustomerStatus = {
  Published: 'published',
  Archived: 'archived',
} as const
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus]

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  [CustomerStatus.Published]: 'Published',
  [CustomerStatus.Archived]: 'Archived',
}

/** The read model the list renders. */
export interface Customer {
  id: string
  name: string
  /** The customer's email. Empty when they carry none. */
  email: string
  /** The id this customer has in your own system. Empty when unset. */
  externalId: string
  /** ISO 3166-1 alpha-2 country of the customer's address. Empty when unset. */
  addressCountry: string
  status: CustomerStatus
  createdAt: Date | null
  updatedAt: Date | null
}

export const CustomerSortField = {
  Name: 'name',
  CreatedAt: 'createdAt',
  UpdatedAt: 'updatedAt',
} as const
export type CustomerSortField = (typeof CustomerSortField)[keyof typeof CustomerSortField]

export const CUSTOMER_SORT_LABEL: Record<CustomerSortField, string> = {
  [CustomerSortField.Name]: 'Name',
  [CustomerSortField.CreatedAt]: 'Created',
  [CustomerSortField.UpdatedAt]: 'Updated',
}

/**
 * The customer list's query.
 *
 * No `view`: a billing list is a table, not a wall of cards, so there is no
 * layout toggle to keep out of the fetch key.
 */
export interface CustomerQuery {
  page: number
  pageSize: number
  search: string
  statuses: CustomerStatus[]
  sortBy: CustomerSortField
  sortDirection: 'asc' | 'desc'
}

export const DEFAULT_CUSTOMER_QUERY: CustomerQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: CustomerSortField.Name,
  sortDirection: 'asc',
}
