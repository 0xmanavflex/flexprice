import { describe, expect, it } from 'vitest'
import { CreateTaxAssociationRequest$outboundSchema } from '@flexprice/sdk/sdk/models'
import { emptyTaxAssociation } from '@fp/domain'
import { toCreateTaxAssociationRequest, toTaxAssociation } from './taxAssociations'

describe('tax association mapping', () => {
  it('builds a customer-scoped request the SDK accepts', () => {
    const request = toCreateTaxAssociationRequest('cust_1', {
      ...emptyTaxAssociation(),
      taxRateCode: 'US-OR',
    })
    expect(request).toMatchObject({ entityType: 'customer', entityId: 'cust_1', priority: 100 })
    expect(CreateTaxAssociationRequest$outboundSchema.safeParse(request).success).toBe(true)
  })

  it('reads the rate off the association and defaults the behavior', () => {
    expect(
      toTaxAssociation({
        id: 'a',
        taxRateId: 'r',
        taxRate: { name: 'OR', code: 'US-OR', percentageValue: '0' },
      }),
    ).toMatchObject({ taxRateName: 'OR', taxBehavior: 'exclusive', autoApply: false })
  })
})
