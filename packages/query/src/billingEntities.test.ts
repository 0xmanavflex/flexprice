import { describe, expect, it } from 'vitest'
import { emptyBillingEntity } from '@fp/domain'
import { statusRefetchInterval, toBillingEntity, toBillingEntityRequest } from './billingEntities'

describe('toBillingEntity', () => {
  it('maps the wire names onto the entity', () => {
    const entity = toBillingEntity({
      id: 'be_1',
      name: 'Acme US',
      legal_name: 'Acme Inc.',
      is_default: true,
      invoice_number_prefix: 'US',
      seller_details: {
        email: 'billing@acme.test',
        help_email: 'help@acme.test',
        address: {
          address_line1: '1 Main St',
          address_postal_code: '94105',
          address_country: 'US',
        },
      },
      tax_identifiers: [{ type: 'EIN', value: '12-345', country: 'US' }],
      created_at: '2026-10-01T00:00:00Z',
    })
    expect(entity.isDefault).toBe(true)
    expect(entity.legalName).toBe('Acme Inc.')
    expect(entity.invoiceNumberPrefix).toBe('US')
    expect(entity.seller.helpEmail).toBe('help@acme.test')
    expect(entity.seller.address.line1).toBe('1 Main St')
    expect(entity.seller.address.postalCode).toBe('94105')
    expect(entity.taxIdentifiers).toEqual([{ type: 'EIN', value: '12-345', country: 'US' }])
    expect(entity.createdAt?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })
})

describe('toBillingEntityRequest', () => {
  it('omits empty seller fields and sends tax identifiers whole', () => {
    const draft = {
      ...emptyBillingEntity(),
      name: 'Acme US',
      legalName: 'Acme Inc.',
      invoiceNumberPrefix: 'US',
      seller: { email: 'billing@acme.test', phone: '', address: { postalCode: '94105', city: '' } },
      taxIdentifiers: [{ type: 'EIN', value: '12-345', country: 'US' }],
    }
    expect(toBillingEntityRequest(draft)).toEqual({
      name: 'Acme US',
      legal_name: 'Acme Inc.',
      invoice_number_prefix: 'US',
      seller_details: {
        email: 'billing@acme.test',
        address: { address_postal_code: '94105' },
      },
      tax_identifiers: [{ type: 'EIN', value: '12-345', country: 'US' }],
    })
  })

  it('leaves seller_details out when nothing is filled', () => {
    const request = toBillingEntityRequest({ ...emptyBillingEntity(), name: 'A', legalName: 'A' })
    expect(request).not.toHaveProperty('seller_details')
  })
})

describe('statusRefetchInterval', () => {
  it('polls every 3 seconds only while enabling', () => {
    expect(statusRefetchInterval('enabling')).toBe(3000)
    expect(statusRefetchInterval('enabled')).toBe(false)
    expect(statusRefetchInterval('off')).toBe(false)
    expect(statusRefetchInterval(undefined)).toBe(false)
  })
})
