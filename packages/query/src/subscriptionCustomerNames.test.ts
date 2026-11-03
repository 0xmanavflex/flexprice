import { describe, expect, it, vi } from 'vitest'
import {
  toParentContractCandidates,
  toSubscription,
  withCustomerNames,
  type SubscriptionWire,
} from './subscriptions'

const clientWith = (items: unknown[]) => {
  const queryCustomer = vi.fn(async (_filter: unknown, _options: unknown) => ({ items }))
  return { client: { customers: { queryCustomer } } as never, queryCustomer }
}

describe('contract customer names', () => {
  it('names the one row the customer expand missed, and asks only for it', async () => {
    const rows: SubscriptionWire[] = [
      { id: 's1', customerId: 'cust_a', customer: { name: 'Acme' } },
      { id: 's2', customerId: 'cust_b' },
    ]
    const { client, queryCustomer } = clientWith([{ id: 'cust_b', name: 'GobbleCube' }])
    const named = (await withCustomerNames(client, rows)).map(toSubscription)
    expect(named.map((row) => row.customerName)).toEqual(['Acme', 'GobbleCube'])
    expect(queryCustomer).toHaveBeenCalledTimes(1)
    expect(queryCustomer.mock.calls[0]?.[0]).toEqual({
      customerIds: ['cust_b'],
      limit: 1,
      offset: 0,
    })
  })

  it('does not search when every row already has its customer', async () => {
    const { client, queryCustomer } = clientWith([])
    await withCustomerNames(client, [{ id: 's1', customerId: 'c', customer: { name: 'A' } }])
    expect(queryCustomer).not.toHaveBeenCalled()
  })

  it('keeps the id when the lookup fails, rather than failing the list', async () => {
    const queryCustomer = vi.fn(async () => {
      throw new Error('down')
    })
    const rows = await withCustomerNames({ customers: { queryCustomer } } as never, [
      { id: 's1', customerId: 'cust_x' },
    ])
    expect(toSubscription(rows[0]!).customerName).toBe('cust_x')
  })

  it('falls back to the external id before the internal one', () => {
    expect(
      toSubscription({ customerId: 'cust_1', customer: { name: '', externalId: 'gc-north' } })
        .customerName,
    ).toBe('gc-north')
  })
})

describe('parent contract candidates', () => {
  it('leaves out contracts that already sit under a parent', () => {
    const candidates = toParentContractCandidates([
      { id: 'p1', customerId: 'c1', customer: { name: 'Parent Co' }, plan: { name: 'Pro' } },
      { id: 'k1', customerId: 'c2', parentSubscriptionId: 'p1' },
    ])
    expect(candidates).toEqual([
      { id: 'p1', customerId: 'c1', customerName: 'Parent Co', planName: 'Pro' },
    ])
  })
})
