import { describe, expect, it } from 'vitest'
import { listPathAfterEnvironmentSwitch } from './environmentSwitch'

describe('listPathAfterEnvironmentSwitch', () => {
  it.each([
    ['/customers/cust_1', { customerId: 'cust_1' }, '/customers'],
    ['/customers/cust_1/edit', { customerId: 'cust_1' }, '/customers'],
    ['/customers/cust_1/subscriptions/new', { customerId: 'cust_1' }, '/customers'],
    ['/subscriptions/sub_9', { subscriptionId: 'sub_9' }, '/subscriptions'],
    ['/taxes/tax_2/edit', { taxRateId: 'tax_2' }, '/taxes'],
    ['/features/a%20b', { featureId: 'a b' }, '/features'],
  ])('%s goes to its list', (pathname, params, expected) => {
    expect(listPathAfterEnvironmentSwitch(pathname, params)).toBe(expected)
  })

  it.each([
    ['/customers', {}],
    ['/customers/new', {}],
    ['/revenue', {}],
    ['/', {}],
  ])('%s has no id and stays', (pathname, params) => {
    expect(listPathAfterEnvironmentSwitch(pathname, params)).toBeNull()
  })
})
