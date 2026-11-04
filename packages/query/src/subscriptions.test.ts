import { describe, expect, it, vi } from 'vitest'
import type { Flexprice } from '@fp/api'
import { DEFAULT_SUBSCRIPTION_QUERY, SubscriptionStatus } from '@fp/domain'
import {
  fetchSubscriptions,
  toSubscription,
  toSubscriptionFilter,
  type SubscriptionWire,
} from './subscriptions'

describe('toSubscription', () => {
  it('passes a known status through', () => {
    expect(toSubscription({ subscriptionStatus: 'active' }).status).toBe(SubscriptionStatus.Active)
    expect(toSubscription({ subscriptionStatus: 'paused' }).status).toBe(SubscriptionStatus.Paused)
  })

  it("reads the wire's draft as Draft, not Incomplete", () => {
    expect(toSubscription({ subscriptionStatus: 'draft' }).status).toBe(SubscriptionStatus.Draft)
  })

  it('falls back to Incomplete for an unknown or missing status', () => {
    expect(toSubscription({ subscriptionStatus: 'mystery' } as SubscriptionWire).status).toBe(
      SubscriptionStatus.Incomplete,
    )
    expect(toSubscription({}).status).toBe(SubscriptionStatus.Incomplete)
  })

  it('resolves the customer name from name, then email, then id, then Unknown', () => {
    expect(toSubscription({ customer: { name: 'Acme', email: 'a@acme.test' } }).customerName).toBe(
      'Acme',
    )
    expect(toSubscription({ customer: { email: 'a@acme.test' } }).customerName).toBe('a@acme.test')
    expect(toSubscription({ customerId: 'cust_1' }).customerName).toBe('cust_1')
    expect(toSubscription({}).customerName).toBe('Unknown')
  })

  it('resolves the plan name from name, then id, then a dash', () => {
    expect(toSubscription({ plan: { name: 'Pro' } }).planName).toBe('Pro')
    expect(toSubscription({ planId: 'plan_1' }).planName).toBe('plan_1')
    expect(toSubscription({}).planName).toBe('—')
  })

  it('turns the billing period into a word, and a dash for an unknown one', () => {
    expect(toSubscription({ billingPeriod: 'MONTHLY' }).billingPeriodLabel).toBe('Monthly')
    expect(toSubscription({ billingPeriod: 'HALF_YEARLY' }).billingPeriodLabel).toBe('Half-yearly')
    expect(toSubscription({ billingPeriod: 'ONETIME' }).billingPeriodLabel).toBe('One-time')
    expect(toSubscription({ billingPeriod: 'FORTNIGHTLY' }).billingPeriodLabel).toBe('—')
    expect(toSubscription({}).billingPeriodLabel).toBe('—')
  })

  it('uppercases the currency and defaults it to empty', () => {
    expect(toSubscription({ currency: 'usd' }).currency).toBe('USD')
    expect(toSubscription({}).currency).toBe('')
  })

  it('keeps dates when present and null when absent', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const withDates = toSubscription({
      startDate: start,
      currentPeriodEnd: start,
      createdAt: start,
    })
    expect(withDates.startDate).toEqual(start)
    expect(withDates.currentPeriodEnd).toEqual(start)
    expect(withDates.createdAt).toEqual(start)

    const bare = toSubscription({})
    expect(bare.startDate).toBeNull()
    expect(bare.currentPeriodEnd).toBeNull()
    expect(bare.createdAt).toBeNull()
  })
})

describe('toSubscriptionFilter', () => {
  it('maps a domain sort field to its wire name and computes the offset', () => {
    const filter = toSubscriptionFilter({
      ...DEFAULT_SUBSCRIPTION_QUERY,
      page: 3,
      pageSize: 25,
      sortBy: 'createdAt',
      sortDirection: 'asc',
    })
    expect(filter).toMatchObject({
      limit: 25,
      offset: 50,
      sort: [
        { field: 'created_at', direction: 'asc' },
        { field: 'id', direction: 'asc' },
      ],
    })
  })

  it('sorts by updated_at, newest first, like every other list', () => {
    // Every list in the console opens on what changed most recently. Checked
    // against the live API before changing it: /subscriptions/search accepts
    // updated_at, so this is a sort the backend really honours.
    expect(toSubscriptionFilter(DEFAULT_SUBSCRIPTION_QUERY)).toMatchObject({
      offset: 0,
      sort: [
        { field: 'updated_at', direction: 'desc' },
        { field: 'id', direction: 'desc' },
      ],
    })
  })

  it('sends chosen statuses to the server, Draft and Incomplete each as itself', () => {
    // The search returns only active subscriptions when no status is given, so
    // a page-only filter could never find a trialing one.
    expect(
      toSubscriptionFilter({
        ...DEFAULT_SUBSCRIPTION_QUERY,
        statuses: [
          SubscriptionStatus.Trialing,
          SubscriptionStatus.Incomplete,
          SubscriptionStatus.Draft,
        ],
      }),
    ).toMatchObject({ subscriptionStatus: ['trialing', 'incomplete', 'draft'] })
  })

  it('asks for every status when none is chosen, not the server active-only default', () => {
    expect(toSubscriptionFilter(DEFAULT_SUBSCRIPTION_QUERY)).toMatchObject({
      subscriptionStatus: ['active', 'trialing', 'paused', 'incomplete', 'draft', 'cancelled'],
    })
  })
})

describe('the contract search', () => {
  const contract = { id: 'sub_1', customerId: 'cus_1', customer: { name: 'QA Module' } }
  const fakeClient = (customers: { id: string }[], plans: { id: string }[] = []) => {
    // Paged like the API: `limit` and `offset` cut the list, `total` counts all of it.
    const paged = (rows: { id: string }[]) => async (filter: unknown) => {
      const { limit = 200, offset = 0 } = filter as { limit?: number; offset?: number }
      return { items: rows.slice(offset, offset + limit), pagination: { total: rows.length } }
    }
    const queryCustomer = vi.fn(paged(customers))
    const queryPlan = vi.fn(paged(plans))
    const querySubscription = vi.fn(async (_filter: unknown) => ({
      items: [contract],
      pagination: { total: 1 },
    }))
    const client = {
      customers: { queryCustomer },
      plans: { queryPlan },
      subscriptions: { querySubscription },
    } as unknown as Flexprice
    return { client, queryCustomer, queryPlan, querySubscription }
  }

  it('asks the server for the contracts of the customers whose name matches', async () => {
    const { client, queryCustomer, querySubscription } = fakeClient([{ id: 'cus_1' }])
    const page = await fetchSubscriptions(client, {
      ...DEFAULT_SUBSCRIPTION_QUERY,
      search: ' QA Module ',
    })
    expect(queryCustomer.mock.calls[0]?.[0]).toMatchObject({
      filters: [{ field: 'name', operator: 'contains', value: { string: 'QA Module' } }],
    })
    expect(querySubscription.mock.calls[0]?.[0]).toMatchObject({ customerIds: ['cus_1'] })
    expect(page.subscriptions.map((row) => row.id)).toEqual(['sub_1'])
    expect(page.total).toBe(1)
  })

  it('collects every matching customer, past the first page', async () => {
    const many = Array.from({ length: 201 }, (_, index) => ({ id: `cus_${index}` }))
    const { client, queryCustomer, querySubscription } = fakeClient(many)
    await fetchSubscriptions(client, { ...DEFAULT_SUBSCRIPTION_QUERY, search: 'QA' })
    expect(queryCustomer).toHaveBeenCalledTimes(2)
    const sent = querySubscription.mock.calls[0]?.[0] as { customerIds: string[] }
    expect(sent.customerIds).toHaveLength(201)
    expect(sent.customerIds.at(-1)).toBe('cus_200')
  })

  it('finds contracts by plan name when no customer matches', async () => {
    const { client, querySubscription } = fakeClient([], [{ id: 'plan_ent' }])
    const page = await fetchSubscriptions(client, {
      ...DEFAULT_SUBSCRIPTION_QUERY,
      search: 'Enterprise',
    })
    const sent = querySubscription.mock.calls[0]?.[0] as Record<string, unknown>
    expect(sent).not.toHaveProperty('customerIds')
    expect(JSON.stringify(sent['filters'])).toContain('plan_ent')
    expect(page.subscriptions.map((row) => row.id)).toEqual(['sub_1'])
  })

  it('merges customer and plan matches without duplicates', async () => {
    const { client, querySubscription } = fakeClient([{ id: 'cus_1' }], [{ id: 'plan_ent' }])
    const page = await fetchSubscriptions(client, { ...DEFAULT_SUBSCRIPTION_QUERY, search: 'Q' })
    // One read narrowed by customer, one by plan; both return sub_1, shown once.
    expect(querySubscription).toHaveBeenCalledTimes(2)
    expect(page.subscriptions.map((row) => row.id)).toEqual(['sub_1'])
    expect(page.total).toBe(1)
  })

  it('returns an empty page when nothing matches, without listing contracts', async () => {
    const { client, querySubscription } = fakeClient([])
    const page = await fetchSubscriptions(client, { ...DEFAULT_SUBSCRIPTION_QUERY, search: 'zz' })
    expect(page).toEqual({ subscriptions: [], total: 0 })
    expect(querySubscription).not.toHaveBeenCalled()
  })

  it('sends no customer narrowing without a search', () => {
    expect(toSubscriptionFilter(DEFAULT_SUBSCRIPTION_QUERY)).not.toHaveProperty('customerIds')
  })
})
