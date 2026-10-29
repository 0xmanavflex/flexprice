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
})
