import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CUSTOMER_ENTITY_FILTER,
  CUSTOMER_FILTERS,
  CustomerStatus,
  DEFAULT_CUSTOMER_QUERY,
} from '@fp/domain'

/** The default query without its "Active" filter, so each case sees only what it sets. */
const ALL_CUSTOMERS = { ...DEFAULT_CUSTOMER_QUERY, filters: [] }
import type { AuthSource } from '@fp/api'
import {
  fetchCustomers,
  toCustomer,
  toCustomerFilter,
  toIntegrationLinks,
  type CustomerWire,
} from './customers'

describe('toCustomer', () => {
  it('carries the wire fields straight across', () => {
    const customer = toCustomer({
      id: 'cust_1',
      name: 'Acme, Inc.',
      email: 'billing@acme.test',
      externalId: 'acme-123',
      addressCountry: 'US',
      status: 'published',
    })

    expect(customer).toMatchObject({
      id: 'cust_1',
      name: 'Acme, Inc.',
      email: 'billing@acme.test',
      externalId: 'acme-123',
      addressCountry: 'US',
      status: CustomerStatus.Published,
    })
  })

  it('keeps the billing entity, and leaves it off when the wire has none', () => {
    expect(toCustomer({ billingEntityId: 'be_1' }).billingEntityId).toBe('be_1')
    expect(toCustomer({})).not.toHaveProperty('billingEntityId')
  })

  it('keeps the createdAt/updatedAt dates, and null when absent', () => {
    const created = new Date('2026-01-01T00:00:00Z')
    const updated = new Date('2026-06-30T00:00:00Z')
    const customer = toCustomer({ createdAt: created, updatedAt: updated })
    expect(customer.createdAt).toEqual(created)
    expect(customer.updatedAt).toEqual(updated)

    const open = toCustomer({})
    expect(open.createdAt).toBeNull()
    expect(open.updatedAt).toBeNull()
  })

  it('falls back to safe defaults for missing fields', () => {
    const customer = toCustomer({})
    expect(customer.name).toBe('Unnamed customer')
    expect(customer.email).toBe('')
    expect(customer.externalId).toBe('')
    expect(customer.addressCountry).toBe('')
    expect(customer.integrations).toEqual([])
    expect(customer.status).toBe(CustomerStatus.Published)
  })

  it('keeps one published mark per provider and names it from the catalogue', () => {
    const customer = toCustomer({
      integrations: [
        { providerType: 'stripe', status: 'published' },
        { providerType: 'stripe', status: 'published' },
        { providerType: 'quickbooks', status: 'archived' },
        { providerType: 'zoho_books' },
      ],
    })
    expect(customer.integrations).toEqual([
      { id: 'stripe', name: 'Stripe', providerType: 'stripe' },
      { id: 'zoho', name: 'Zoho', providerType: 'zoho_books' },
    ])
  })

  it('collapses a soft-deleted or unknown status to published', () => {
    expect(toCustomer({ status: 'deleted' } as CustomerWire).status).toBe(CustomerStatus.Published)
    expect(toCustomer({ status: 'mystery' } as CustomerWire).status).toBe(CustomerStatus.Published)
    expect(toCustomer({ status: 'archived' }).status).toBe(CustomerStatus.Archived)
  })
})

describe('toCustomerFilter', () => {
  it('maps a domain sort field to its wire name and computes the offset', () => {
    const filter = toCustomerFilter({
      ...DEFAULT_CUSTOMER_QUERY,
      page: 3,
      pageSize: 25,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    })
    expect(filter).toMatchObject({
      limit: 25,
      offset: 50,
      sort: [
        { field: 'updated_at', direction: 'desc' },
        { field: 'id', direction: 'desc' },
      ],
    })
  })

  it('sends the search term as a server-side name condition', () => {
    // Not `nameContains`: the SDK's zod strips keys its model does not declare,
    // so that key never reaches the wire. The filter DSL does.
    const filter = toCustomerFilter({ ...ALL_CUSTOMERS, search: 'acme' })
    expect(filter).not.toHaveProperty('nameContains')
    expect(filter['filters']).toEqual([
      { field: 'name', operator: 'contains', dataType: 'string', value: { string: 'acme' } },
    ])
  })

  it('sends a metadata filter as the metadata map of the search (the SDK model declares it)', () => {
    const filter = toCustomerFilter({
      ...ALL_CUSTOMERS,
      filters: [{ field: 'metadata', op: 'eq', value: 'region=eu' }],
    })
    expect(filter['metadata']).toEqual({ region: 'eu' })
    expect(filter).not.toHaveProperty('filters')
  })

  it('trims the search term, and sends nothing for a blank one', () => {
    expect(toCustomerFilter({ ...ALL_CUSTOMERS, search: '  acme  ' })['filters']).toEqual([
      { field: 'name', operator: 'contains', dataType: 'string', value: { string: 'acme' } },
    ])
    expect(toCustomerFilter({ ...ALL_CUSTOMERS, search: '   ' })).not.toHaveProperty('filters')
  })

  it('sends one selected status as the server-side field', () => {
    const filter = toCustomerFilter({
      ...ALL_CUSTOMERS,
      statuses: [CustomerStatus.Archived],
    })
    expect(filter['status']).toBe('archived')
  })

  it('sends no status when none or all are selected', () => {
    expect(toCustomerFilter({ ...ALL_CUSTOMERS, statuses: [] })).not.toHaveProperty('status')
    expect(
      toCustomerFilter({
        ...ALL_CUSTOMERS,
        statuses: [CustomerStatus.Published, CustomerStatus.Archived],
      }),
    ).not.toHaveProperty('status')
  })

  it('sends granular filters as typed conditions', () => {
    const filter = toCustomerFilter({
      ...ALL_CUSTOMERS,
      filters: [{ field: 'email', op: 'contains', value: '@acme' }],
    })
    expect(filter['filters']).toEqual([
      { field: 'email', operator: 'contains', dataType: 'string', value: { string: '@acme' } },
    ])
    expect(toCustomerFilter(ALL_CUSTOMERS)).not.toHaveProperty('filters')
  })

  it('sends the default view as a server-side "status in published" condition', () => {
    expect(toCustomerFilter(DEFAULT_CUSTOMER_QUERY)['filters']).toEqual([
      { field: 'status', operator: 'in', dataType: 'array', value: { array: ['published'] } },
    ])
  })

  it('sends a chosen billing entity as the top-level field, not a condition', () => {
    const filters = [{ field: 'billing_entity_id', op: 'eq' as const, value: 'be_1' }]
    const filter = toCustomerFilter({ ...ALL_CUSTOMERS, filters }, [
      ...CUSTOMER_FILTERS,
      CUSTOMER_ENTITY_FILTER,
    ])
    expect(filter['billingEntityId']).toBe('be_1')
    expect(filter).not.toHaveProperty('filters')
  })

  it('drops a billing entity from the URL when entities are off', () => {
    const filters = [{ field: 'billing_entity_id', op: 'eq' as const, value: 'be_1' }]
    expect(toCustomerFilter({ ...ALL_CUSTOMERS, filters }, CUSTOMER_FILTERS)).not.toHaveProperty(
      'billingEntityId',
    )
  })

  it('expands integrations so the list can show each customer’s marks', () => {
    expect(toCustomerFilter(ALL_CUSTOMERS)).toMatchObject({ expand: 'integrations' })
  })
})

describe('toIntegrationLinks', () => {
  it('keeps published mappings, one per provider, named from the catalogue', () => {
    const created = new Date('2026-08-01T00:00:00Z')
    const links = toIntegrationLinks([
      { id: 'map_1', providerType: 'stripe', providerEntityId: ' cus_Q3x9 ', createdAt: created },
      { id: 'map_2', providerType: 'stripe', providerEntityId: 'cus_dup' },
      { id: 'map_3', providerType: 'quickbooks', status: 'archived', providerEntityId: 'qb_1' },
      { id: 'map_4', providerType: 'mystery', status: 'published' },
      { id: 'map_5' },
    ])

    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({
      id: 'stripe',
      providerType: 'stripe',
      mappingId: 'map_1',
      providerEntityId: 'cus_Q3x9',
      createdAt: created,
      updatedAt: null,
    })
    expect(links[0]?.name).not.toBe('')
    // An unknown provider falls back to its provider type for the mark.
    expect(links[1]).toMatchObject({ id: 'mystery', name: 'mystery', providerEntityId: '' })
  })

  it('is empty for no mappings', () => {
    expect(toIntegrationLinks(undefined)).toEqual([])
  })
})

describe('fetchCustomers', () => {
  afterEach(() => vi.unstubAllGlobals())

  /**
   * The page is returned as the server sent it.
   *
   * This is a regression guard, not a tautology. Search and status used to be
   * applied to the fetched page here, which made a search find only the
   * matches inside the current 25 rows while `total` kept reporting every
   * customer: so the pager offered pages that came back empty. Both are
   * server-side now, and re-adding a `.filter()` would silently bring that
   * back: the rows would still look right on page one.
   */
  it('does not narrow the page it was given', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        items: [
          { id: 'cust_1', name: 'Acme', status: 'published', billing_entity_id: 'be_1' },
          // Neither of these matches the search term or the status asked for.
          // The server decided they belong on this page; the browser must not
          // second-guess it, or the count above the table stops matching it.
          { id: 'cust_2', name: 'Globex', status: 'archived' },
          { id: 'cust_3', name: 'Initech', status: 'archived' },
        ],
        pagination: { total: 97, limit: 25, offset: 0 },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const auth: AuthSource = { getToken: async () => 'tok', getEnvironmentId: async () => 'env_1' }

    const result = await fetchCustomers('https://api.test', auth, {
      ...ALL_CUSTOMERS,
      search: 'acme',
      statuses: [CustomerStatus.Published],
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/customers/search')
    expect(JSON.parse(init.body as string)).toMatchObject({
      status: 'published',
      expand: 'integrations',
    })
    expect(result.customers[0]?.billingEntityId).toBe('be_1')
    expect(result.customers.map((customer) => customer.id)).toEqual(['cust_1', 'cust_2', 'cust_3'])
    expect(result.total).toBe(97)
  })
})
