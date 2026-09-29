import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type Customer,
  type CustomerDetail,
  type CustomerQuery,
  CustomerSortField,
  CustomerStatus,
  CustomerTaxTreatment,
  DEFAULT_INVOICE_QUERY,
  type Subscription,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'
import { type SubscriptionWire, toSubscription } from './subscriptions'
import { type InvoicePage, fetchInvoices } from './invoices'

/**
 * Customers: the translation between billing vocabulary and the API.
 *
 * Reached through `POST /customers/search` (`client.customers.queryCustomer`),
 * the same search shape the catalogue lists use. The wire's status knows a
 * soft-deleted state the list has no column for, so it collapses to the two a
 * billing list shows, with anything unrecognised falling to published rather
 * than vanishing from the list.
 */

/** The wire shape this reads, after the SDK camelCases the response. */
export interface CustomerWire {
  id?: string | undefined
  name?: string | undefined
  email?: string | undefined
  externalId?: string | undefined
  addressCountry?: string | undefined
  status?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
}

const CUSTOMER_STATUSES = new Set<string>(Object.values(CustomerStatus))

export function toCustomer(wire: CustomerWire): Customer {
  const status = CUSTOMER_STATUSES.has(wire.status ?? '')
    ? (wire.status as CustomerStatus)
    : CustomerStatus.Published

  return {
    id: wire.id ?? '',
    name: wire.name ?? 'Unnamed customer',
    email: wire.email ?? '',
    externalId: wire.externalId ?? '',
    addressCountry: wire.addressCountry ?? '',
    status,
    createdAt: wire.createdAt ?? null,
    updatedAt: wire.updatedAt ?? null,
  }
}

const SORT_FIELD: Record<CustomerSortField, string> = {
  [CustomerSortField.Name]: 'name',
  [CustomerSortField.CreatedAt]: 'created_at',
  [CustomerSortField.UpdatedAt]: 'updated_at',
}

export function toCustomerFilter(query: CustomerQuery): Record<string, unknown> {
  return {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sort: [{ field: SORT_FIELD[query.sortBy], direction: query.sortDirection }],
  }
}

export interface CustomerPage {
  customers: Customer[]
  total: number
}

export async function fetchCustomers(
  client: Flexprice,
  query: CustomerQuery,
): Promise<CustomerPage> {
  const response = await call(() => client.customers.queryCustomer(toCustomerFilter(query) as never))
  const customers = (response.items ?? []).map((item) => toCustomer(item as CustomerWire))

  // The SDK's customer filter has no name-search field and does not narrow by
  // status, so both are applied on the page — the same split coupons and price
  // units use. Search matches the name, email or external id, case-insensitively.
  const needle = query.search.trim().toLowerCase()
  const filtered = customers
    .filter((customer) =>
      query.statuses.length > 0 ? query.statuses.includes(customer.status) : true,
    )
    .filter((customer) =>
      needle
        ? [customer.name, customer.email, customer.externalId]
            .some((field) => field.toLowerCase().includes(needle))
        : true,
    )

  return {
    customers: filtered,
    total: response.pagination?.total ?? 0,
  }
}

export function useCustomers(query: CustomerQuery) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.customers.list({ ...query, statuses: [...query.statuses].sort() }),
    queryFn: () => fetchCustomers(client, query),
    placeholderData: (previous) => previous,
  })
}

/**
 * The detail read model, richer than the list's.
 *
 * `GET /customers/{id}` (`client.customers.getCustomer`) returns the fuller
 * record — the postal address, a phone, the timezone, the tax treatment and any
 * metadata — that the search list drops. Everything optional collapses to empty
 * rather than absent, so the detail page renders a dash, never a hole.
 */
export interface CustomerDetailWire extends CustomerWire {
  addressLine1?: string | undefined
  addressLine2?: string | undefined
  addressCity?: string | undefined
  addressState?: string | undefined
  addressPostalCode?: string | undefined
  /** The wire spells the phone number `contact`. */
  contact?: string | undefined
  timezone?: string | undefined
  taxTreatment?: string | undefined
  metadata?: Record<string, string> | undefined
}

const TAX_TREATMENTS = new Set<string>(Object.values(CustomerTaxTreatment))

export function toCustomerDetail(wire: CustomerDetailWire): CustomerDetail {
  const taxTreatment = TAX_TREATMENTS.has(wire.taxTreatment ?? '')
    ? (wire.taxTreatment as CustomerTaxTreatment)
    : null

  return {
    ...toCustomer(wire),
    addressLine1: wire.addressLine1 ?? '',
    addressLine2: wire.addressLine2 ?? '',
    addressCity: wire.addressCity ?? '',
    addressState: wire.addressState ?? '',
    addressPostalCode: wire.addressPostalCode ?? '',
    phone: wire.contact ?? '',
    timezone: wire.timezone ?? '',
    taxTreatment,
    metadata: wire.metadata ?? {},
  }
}

export async function fetchCustomer(client: Flexprice, id: string): Promise<CustomerDetail> {
  const response = await call(() => client.customers.getCustomer(id))
  return toCustomerDetail(response as CustomerDetailWire)
}

/**
 * One customer, by internal id.
 *
 * Keyed on the internal `customerId` the route carries. The external-id
 * endpoints (subscriptions, entitlements) need the `externalId` this returns, so
 * a detail page reads the customer first and scopes the rest to what it finds.
 */
export function useCustomer(id: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => fetchCustomer(client, id),
    enabled: id.length > 0,
  })
}

export async function fetchCustomerSubscriptions(
  client: Flexprice,
  externalId: string,
): Promise<Subscription[]> {
  const response = (await call(() =>
    client.customers.getSubscriptionsForCustomer(externalId),
  )) as { items?: unknown[] }
  return (response.items ?? []).map((item) => toSubscription(item as SubscriptionWire))
}

/**
 * A customer's subscriptions, scoped by their external id.
 *
 * `GET /customers/external/{external_id}/subscriptions` — the one that takes the
 * *external* id, which is why the page waits on `useCustomer` before calling
 * this. Not a paged list: a single customer's subscriptions are a handful, shown
 * whole rather than behind a pager.
 */
export function useCustomerSubscriptions(externalId: string) {
  const client = useFlexprice()

  return useQuery({
    queryKey: queryKeys.subscriptions.list({ customerExternalId: externalId }),
    queryFn: () => fetchCustomerSubscriptions(client, externalId),
    enabled: externalId.length > 0,
  })
}

/**
 * A customer's invoices, scoped by their external id.
 *
 * Invoices have no dedicated per-customer endpoint; the list search narrows by
 * `externalCustomerId` instead (that is what the global list's search box does),
 * so this reuses `fetchInvoices` with the external id as the filter. Gated on a
 * real id so it does not fetch the whole book while the customer is still
 * loading. Returns the same `InvoicePage` the list does — status is derived, so
 * a draft reads "Draft" and a past-due one "Overdue".
 */
export function useCustomerInvoices(externalId: string) {
  const client = useFlexprice()

  return useQuery<InvoicePage>({
    queryKey: queryKeys.invoices.list({ externalCustomerId: externalId }),
    queryFn: () =>
      fetchInvoices(client, { ...DEFAULT_INVOICE_QUERY, search: externalId, pageSize: 50 }),
    enabled: externalId.length > 0,
  })
}
