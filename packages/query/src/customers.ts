import { useQuery } from '@tanstack/react-query'
import { type Flexprice, call } from '@fp/api'
import {
  type Customer,
  type CustomerQuery,
  CustomerSortField,
  CustomerStatus,
} from '@fp/domain'
import { queryKeys } from './keys'
import { useFlexprice } from './provider'

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
