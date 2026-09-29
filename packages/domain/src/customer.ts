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

export const CustomerTaxTreatment = {
  Taxable: 'taxable',
  Exempt: 'exempt',
} as const
export type CustomerTaxTreatment =
  (typeof CustomerTaxTreatment)[keyof typeof CustomerTaxTreatment]

export const CUSTOMER_TAX_TREATMENT_LABEL: Record<CustomerTaxTreatment, string> = {
  [CustomerTaxTreatment.Taxable]: 'Taxable',
  [CustomerTaxTreatment.Exempt]: 'Exempt',
}

/**
 * The fuller customer, as the detail page reads it.
 *
 * Everything the list model carries, plus the fields a single customer's page
 * shows: the postal address, a phone number, the billing timezone, whether they
 * are taxed, and whatever metadata your own system attached. All optional on the
 * wire, so all default to empty rather than absent — a detail page renders a
 * dash, not a hole. Deliberately no `plan`, `currency` or `payment method`: a
 * customer has none of those, they belong to its subscriptions and wallets.
 */
export interface CustomerDetail extends Customer {
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressState: string
  addressPostalCode: string
  /** A phone number, from the wire's contact. Empty when unset. */
  phone: string
  /** IANA timezone the customer's billing runs in. Empty when unset. */
  timezone: string
  /** Whether the customer is taxed. `null` when the API sends no treatment. */
  taxTreatment: CustomerTaxTreatment | null
  /** Free-form keys your own system attached to the customer. */
  metadata: Record<string, string>
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
