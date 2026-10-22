import { describe, expect, it } from 'vitest'
import { ApiError, ErrorKind } from '@fp/api'
import {
  INHERITANCE_WITH_BILLING_CUSTOMER,
  INHERITANCE_WITH_THRESHOLD,
  InheritanceBlock,
} from '@fp/domain'
import { explainContractHierarchyError, toInheritanceBlocks } from './subscriptions'

const contract = (
  id: string,
  customerId: string,
  subscriptionStatus = 'active',
  parentSubscriptionId?: string,
) => ({
  id,
  customerId,
  subscriptionStatus,
  ...(parentSubscriptionId ? { parentSubscriptionId } : {}),
})

describe('toInheritanceBlocks', () => {
  it('lets a customer with no contract inherit', () => {
    expect(toInheritanceBlocks('parent', [contract('sub_p', 'parent')])).toEqual({})
  })

  it('blocks a customer with a contract of its own, live or draft', () => {
    expect(
      toInheritanceBlocks('parent', [
        contract('sub_a', 'child_a'),
        contract('sub_b', 'child_b', 'draft'),
        contract('sub_c', 'child_c', 'trialing'),
      ]),
    ).toEqual({
      child_a: InheritanceBlock.OwnContract,
      child_b: InheritanceBlock.OwnContract,
      child_c: InheritanceBlock.OwnContract,
    })
  })

  it('ignores ended and paused contracts, as the API does', () => {
    expect(
      toInheritanceBlocks('parent', [
        contract('sub_a', 'child_a', 'cancelled'),
        contract('sub_b', 'child_b', 'paused'),
      ]),
    ).toEqual({})
  })

  it("lets a customer that already inherits from this customer's contract inherit again", () => {
    expect(
      toInheritanceBlocks('parent', [
        contract('sub_p', 'parent'),
        contract('sub_i', 'child', 'active', 'sub_p'),
      ]),
    ).toEqual({})
  })

  it("blocks a customer that inherits another customer's contract", () => {
    expect(
      toInheritanceBlocks('parent', [
        contract('sub_p', 'parent'),
        contract('sub_i', 'child', 'active', 'sub_elsewhere'),
      ]),
    ).toEqual({ child: InheritanceBlock.OtherParent })
  })

  it('names its own contract first when a customer has both reasons', () => {
    expect(
      toInheritanceBlocks('parent', [
        contract('sub_i', 'child', 'active', 'sub_elsewhere'),
        contract('sub_own', 'child'),
      ]),
    ).toEqual({ child: InheritanceBlock.OwnContract })
  })
})

describe('explainContractHierarchyError', () => {
  const server = (message: string, details?: Record<string, string>) =>
    new ApiError(ErrorKind.Invalid, message, {
      status: 400,
      fromServer: true,
      ...(details ? { details } : {}),
    })
  const names: Record<string, string> = { acme_eu: 'Acme EU' }
  const nameOf = (externalId: string) => names[externalId] ?? externalId

  it('names the child that has its own contract, in place of the API hint', () => {
    const error = server('The child customer cannot have standalone or parent subscriptions', {
      external_id: 'acme_eu',
      customer_id: 'cust_1',
    })
    expect(explainContractHierarchyError(error, nameOf)).toBe(
      'Acme EU has a contract of its own, so it cannot inherit this one. End that contract first, or remove the customer from Inherited customers.',
    )
  })

  it('explains a child already under another parent', () => {
    const error = server('A customer can only be inherited under one parent', {
      external_id: 'acme_eu',
    })
    expect(explainContractHierarchyError(error, nameOf)).toMatch(
      /^Acme EU already inherits another customer's contract/,
    )
  })

  it('explains the billing-customer and threshold conflicts with the form copy', () => {
    expect(
      explainContractHierarchyError(
        server(
          'Use either invoicing_customer_external_id or external_customer_ids_to_inherit_subscription, not both',
        ),
      ),
    ).toBe(INHERITANCE_WITH_BILLING_CUSTOMER)
    expect(
      explainContractHierarchyError(
        server(
          'Remove auto_invoice_threshold or create the subscription without parent/inheritance, delegated invoicing, or grouped invoicing',
        ),
      ),
    ).toBe(INHERITANCE_WITH_THRESHOLD)
  })

  it('leaves any other error to the caller', () => {
    expect(explainContractHierarchyError(server('Plan not found'))).toBeNull()
    expect(explainContractHierarchyError(new Error('boom'))).toBeNull()
    expect(explainContractHierarchyError(null)).toBeNull()
  })
})
