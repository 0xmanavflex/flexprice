import { describe, expect, it } from 'vitest'
import {
  INHERITANCE_WITH_BILLING_CUSTOMER,
  INHERITANCE_WITH_THRESHOLD,
  createSubscriptionSchema,
  emptySubscription,
} from './subscription'

const base = { ...emptySubscription(), customerId: 'c', planId: 'p', currency: 'USD' }
const issues = (value: unknown, field: string) => {
  const result = createSubscriptionSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues.filter((i) => i.path[0] === field).map((i) => i.message)
}

describe('inherited customers', () => {
  it('accepts inherited customers on a contract its own customer pays, with a commitment', () => {
    const draft = {
      ...base,
      commitmentAmount: '1000',
      inheritedCustomerExternalIds: ['child_a', 'child_b'],
    }
    expect(createSubscriptionSchema.safeParse(draft).success).toBe(true)
  })

  it('accepts another billing customer when nobody inherits', () => {
    const draft = { ...base, invoicingCustomerExternalId: 'payer' }
    expect(createSubscriptionSchema.safeParse(draft).success).toBe(true)
  })

  it('refuses inherited customers together with another billing customer, as the API does', () => {
    expect(
      issues(
        { ...base, invoicingCustomerExternalId: 'payer', inheritedCustomerExternalIds: ['child'] },
        'inheritedCustomerExternalIds',
      ),
    ).toEqual([INHERITANCE_WITH_BILLING_CUSTOMER])
  })

  it('refuses an auto-invoice threshold on a contract with inherited customers', () => {
    expect(
      issues(
        { ...base, autoInvoiceThreshold: '500', inheritedCustomerExternalIds: ['child'] },
        'autoInvoiceThreshold',
      ),
    ).toEqual([INHERITANCE_WITH_THRESHOLD])
    expect(issues({ ...base, autoInvoiceThreshold: '500' }, 'autoInvoiceThreshold')).toEqual([])
  })
})
