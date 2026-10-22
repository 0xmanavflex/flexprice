import { describe, expect, it } from 'vitest'
import { DEFAULT_SUBSCRIPTION_QUERY, SubscriptionStatus } from '@fp/domain'
import { toSubscription, toSubscriptionFilter, type SubscriptionWire } from './subscriptions'

describe('toSubscription', () => {
  it('passes a known status through', () => {
    expect(toSubscription({ subscriptionStatus: 'active' }).status).toBe(SubscriptionStatus.Active)
    expect(toSubscription({ subscriptionStatus: 'paused' }).status).toBe(SubscriptionStatus.Paused)
  })

  it("collapses the wire's draft into Incomplete", () => {
    expect(toSubscription({ subscriptionStatus: 'draft' }).status).toBe(
      SubscriptionStatus.Incomplete,
    )
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

  it('sends chosen statuses to the server, and Incomplete asks for drafts too', () => {
    // The search returns only active subscriptions when no status is given, so
    // a page-only filter could never find a trialing one.
    expect(
      toSubscriptionFilter({
        ...DEFAULT_SUBSCRIPTION_QUERY,
        statuses: [SubscriptionStatus.Trialing, SubscriptionStatus.Incomplete],
      }),
    ).toMatchObject({ subscriptionStatus: ['trialing', 'incomplete', 'draft'] })
  })

  it('asks for every status when none is chosen, not the server active-only default', () => {
    expect(toSubscriptionFilter(DEFAULT_SUBSCRIPTION_QUERY)).toMatchObject({
      subscriptionStatus: ['active', 'trialing', 'paused', 'incomplete', 'draft', 'cancelled'],
    })
  })
})
