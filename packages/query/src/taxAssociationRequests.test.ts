import { describe, expect, it, vi } from 'vitest'
import { CreateTaxAssociationRequest$outboundSchema } from '@flexprice/sdk/sdk/models'
import { emptyTaxAssociation } from '@fp/domain'
import { toCreateTaxAssociationRequest, toTaxAssociation, withTaxRates } from './taxAssociations'

describe('tax association mapping', () => {
  it('builds a customer-scoped request the SDK accepts', () => {
    const request = toCreateTaxAssociationRequest('cust_1', {
      ...emptyTaxAssociation(),
      taxRateCode: 'US-OR',
    })
    expect(request).toMatchObject({ entityType: 'customer', entityId: 'cust_1', priority: 100 })
    expect(CreateTaxAssociationRequest$outboundSchema.safeParse(request).success).toBe(true)
  })

  it('builds a subscription-scoped request the SDK accepts', () => {
    const request = toCreateTaxAssociationRequest(
      'sub_1',
      { ...emptyTaxAssociation(), taxRateCode: 'US-OR' },
      'subscription',
    )
    expect(request).toMatchObject({ entityType: 'subscription', entityId: 'sub_1' })
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

describe('withTaxRates', () => {
  it('reads each rate the list left unexpanded, once, so rows show name, code and rate', async () => {
    const readRate = vi.fn(async (id: string) => {
      if (id === 'gone') throw new Error('not found')
      return { name: 'Test', code: 'cms90', percentageValue: '2' }
    })

    const wires = await withTaxRates(
      [
        { id: 'a', taxRateId: 'r1' },
        { id: 'b', taxRateId: 'r1' },
        { id: 'c', taxRateId: 'gone' },
        { id: 'd', taxRateId: 'r2', taxRate: { name: 'Kept', code: 'K' } },
      ],
      readRate,
    )

    expect(readRate).toHaveBeenCalledTimes(2)
    expect(toTaxAssociation(wires[0]!)).toMatchObject({
      taxRateName: 'Test',
      taxRateCode: 'cms90',
      percentage: '2',
    })
    expect(wires[1]?.taxRate?.code).toBe('cms90')
    // An unreadable rate keeps the row as the API sent it rather than failing the list.
    expect(wires[2]?.taxRate).toBeUndefined()
    expect(wires[3]?.taxRate?.name).toBe('Kept')
  })
})
