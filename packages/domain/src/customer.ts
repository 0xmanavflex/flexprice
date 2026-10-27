import { FilterOp, type ListFilter, type ListFilterSpec, sameListFilters } from './listFilter'
import { z } from 'zod'

/**
 * A customer, as the billing list reads it.
 *
 * A customer is who you bill: a name, the ways to reach them, and the external
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
  [CustomerStatus.Published]: 'Active',
  [CustomerStatus.Archived]: 'Archived',
}

/**
 * An integration this customer is connected to.
 *
 * `id` is the catalogue id (the logo key). `name` is what a reader sees.
 * `providerType` is the wire value, kept so two mappings of one provider
 * collapse to one mark.
 */
export interface CustomerIntegration {
  id: string
  name: string
  providerType: string
  /** The customer's id at the provider (`cus_…`). Absent when the mapping carries none. */
  providerEntityId?: string | undefined
}

/**
 * A customer's mapping to one provider as the contract header shows it: the
 * mark, the provider-side id, and when the link was made and last changed.
 */
export interface IntegrationLink extends CustomerIntegration {
  /** The mapping's own id. */
  mappingId: string
  providerEntityId: string
  createdAt: Date | null
  updatedAt: Date | null
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
  /**
   * The currency invoices are issued in, lower-case; empty bills in the
   * contract's own currency. Optional: only the customer API sends it.
   */
  billingCurrency?: string
  status: CustomerStatus
  /** Integrations this customer is connected to. Empty when none are. */
  integrations: CustomerIntegration[]
  createdAt: Date | null
  updatedAt: Date | null
}

export const CustomerTaxTreatment = {
  Taxable: 'taxable',
  Exempt: 'exempt',
} as const
export type CustomerTaxTreatment = (typeof CustomerTaxTreatment)[keyof typeof CustomerTaxTreatment]

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
 * wire, so all default to empty rather than absent: a detail page renders a
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
  /** Granular field filters, applied by the search endpoint. See `CUSTOMER_FILTERS`. */
  filters?: ListFilter[]
}

/**
 * The list opens on active customers only, as V1 did: a visible, removable
 * "Status is Active" filter rather than a hidden narrowing, so archived
 * customers are one click away and the filter chip says why they are missing.
 */
export const ACTIVE_CUSTOMERS_FILTER: ListFilter = {
  field: 'status',
  op: FilterOp.In,
  value: [CustomerStatus.Published],
}

export const DEFAULT_CUSTOMER_QUERY: CustomerQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  statuses: [],
  sortBy: CustomerSortField.UpdatedAt,
  sortDirection: 'desc',
  filters: [ACTIVE_CUSTOMERS_FILTER],
}

/**
 * Whether the list is narrowed beyond its default view. The default "Active"
 * filter does not count, so an account with no customers still gets the
 * first-run empty state rather than "nothing matches these filters".
 */
export function isCustomerQueryFiltered(query: CustomerQuery): boolean {
  return (
    query.search.length > 0 ||
    query.statuses.length > 0 ||
    // An empty list (every status) is not a narrowing; the default view is
    // not one either. Anything else the person chose is.
    ((query.filters?.length ?? 0) > 0 &&
      !sameListFilters(query.filters ?? [], DEFAULT_CUSTOMER_QUERY.filters ?? []))
  )
}

/** What the customer list can filter on: V1's fields, by their wire names. */
export const CUSTOMER_FILTERS: readonly ListFilterSpec[] = [
  { field: 'name', label: 'Name', kind: 'text' },
  { field: 'external_id', label: 'External ID', kind: 'text' },
  { field: 'email', label: 'Email', kind: 'text' },
  {
    field: 'status',
    label: 'Status',
    kind: 'options',
    options: [
      { value: CustomerStatus.Published, label: 'Active' },
      { value: CustomerStatus.Archived, label: 'Archived' },
    ],
  },
  { field: 'created_at', label: 'Created', kind: 'date' },
  // Sent as the search's own `metadata` map, not as a filter condition.
  { field: 'metadata', label: 'Metadata', kind: 'keyvalue' },
]

const optionalText = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer`)

/**
 * A customer draft: what V1's drawer collects, plus the timezone and metadata
 * the backend accepts. `externalId` and `name` are the only required fields.
 * Optional text fields are `''` when blank (a form's natural empty), and the
 * query layer drops them from the request. The country is an ISO 3166-1
 * alpha-2 code.
 */
export const createCustomerSchema = z.object({
  externalId: z.string().trim().min(1, 'Enter an external ID').max(255),
  // 255 and 20 are the API's own limits (`CreateCustomerRequest`: `max=255` on
  // name, `max=20` on contact). A form that accepts more does not accept more:
  // it collects a value the save then rejects, with a server message about a
  // field the person has already stopped looking at.
  name: z.string().trim().min(1, 'Enter a name').max(255, 'Use 255 characters or fewer'),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]).optional(),
  phone: optionalText(20).optional(),
  timezone: optionalText(100).optional(),
  taxTreatment: z.enum([CustomerTaxTreatment.Taxable, CustomerTaxTreatment.Exempt]).optional(),
  addressLine1: optionalText(255).optional(),
  addressLine2: optionalText(255).optional(),
  addressCity: optionalText(100).optional(),
  addressState: optionalText(100).optional(),
  addressPostalCode: optionalText(20).optional(),
  addressCountry: z
    .union([z.literal(''), z.string().trim().length(2, 'Use a two-letter country code')])
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type CreateCustomer = z.infer<typeof createCustomerSchema>

/** An edit carries the same fields; the external ID is editable on the backend. */
export const editCustomerSchema = createCustomerSchema

export type EditCustomer = CreateCustomer

export function emptyCustomer(): CreateCustomer {
  return {
    externalId: '',
    name: '',
    email: '',
    phone: '',
    timezone: '',
    taxTreatment: CustomerTaxTreatment.Taxable,
    addressLine1: '',
    addressLine2: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
    addressCountry: '',
  }
}

/** An edit draft seeded from a customer's detail. */
export function customerToEdit(customer: CustomerDetail): EditCustomer {
  return {
    externalId: customer.externalId,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    timezone: customer.timezone,
    ...(customer.taxTreatment ? { taxTreatment: customer.taxTreatment } : {}),
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    addressCity: customer.addressCity,
    addressState: customer.addressState,
    addressPostalCode: customer.addressPostalCode,
    addressCountry: customer.addressCountry,
    ...(Object.keys(customer.metadata).length > 0 ? { metadata: customer.metadata } : {}),
  }
}
