import { describe, expect, it, vi } from 'vitest'
import { fetchCustomerSubscriptions } from './customers'

describe('fetchCustomerSubscriptions', () => {
  it("asks by internal customer id: an archived customer's external id no longer resolves", async () => {
    const querySubscription = vi.fn(async () => ({ items: [] }))
    const client = { subscriptions: { querySubscription } } as never
    await fetchCustomerSubscriptions(client, 'cust_archived')
    expect(querySubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust_archived' }),
    )
    expect(querySubscription).toHaveBeenCalledWith(
      expect.not.objectContaining({ externalCustomerId: expect.anything() }),
    )
  })

  it('reads every page, so the tab filters and sorts the whole set', async () => {
    const contracts = Array.from({ length: 130 }, (_, index) => ({ id: `sub_${index}` }))
    const querySubscription = vi.fn(
      async ({ limit, offset }: { limit: number; offset: number }) => ({
        items: contracts.slice(offset, offset + limit),
        pagination: { total: contracts.length },
      }),
    )
    const client = { subscriptions: { querySubscription } } as never
    const all = await fetchCustomerSubscriptions(client, 'cust_1')
    expect(all).toHaveLength(130)
    expect(querySubscription).toHaveBeenCalledTimes(2)
  })
})
