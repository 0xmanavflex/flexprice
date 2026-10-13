import { describe, expect, it } from 'vitest'
import { CustomerStatus, DEFAULT_CUSTOMER_QUERY } from '@fp/domain'
import { toCustomer, toCustomerFilter, toIntegrationLinks, type CustomerWire } from './customers'

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
      sort: [{ field: 'updated_at', direction: 'desc' }],
    })
  })

  it('does not send search or status — both are applied on the page', () => {
    const filter = toCustomerFilter({ ...DEFAULT_CUSTOMER_QUERY, search: 'acme' })
    expect(filter).not.toHaveProperty('nameContains')
    expect(filter).not.toHaveProperty('status')
    expect(filter).not.toHaveProperty('statuses')
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
