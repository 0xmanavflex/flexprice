import { describe, expect, it } from 'vitest'
import { type BillingEntity, type InvoiceSellerSnapshot, InvoiceStatus } from '@fp/domain'
import { billFromFor } from './invoiceParties'

const tenant = { name: 'Northwind Systems', email: 'billing@northwind.test', address: [] }

const entity: BillingEntity = {
  id: 'be_india',
  name: 'Northwind India',
  legalName: 'Northwind India Pvt Ltd',
  isDefault: false,
  invoiceNumberPrefix: 'NWIN',
  seller: { email: 'in@northwind.test', address: { city: 'Bengaluru', country: 'IN' } },
  taxIdentifiers: [{ type: 'GSTIN', value: '29ABCDE1234F1Z5', country: 'IN' }],
  createdAt: null,
}

const snapshot: InvoiceSellerSnapshot = {
  billingEntityId: 'be_india',
  legalName: 'Northwind India (issued)',
  email: 'issued@northwind.test',
  helpEmail: '',
  phone: '',
  address: { line1: '', line2: '', city: 'Mumbai', state: '', postalCode: '', country: 'IN' },
  taxIdentifiers: [{ type: 'GSTIN', value: '27ZZZZZ9999Z1Z5', country: 'IN' }],
}

describe('billFromFor', () => {
  it('prints the seller snapshot on an issued invoice, not the entity as it is now', () => {
    const from = billFromFor(
      { status: InvoiceStatus.Open, sellerSnapshot: snapshot },
      entity,
      tenant,
    )
    expect(from).toMatchObject({
      name: 'Northwind India (issued)',
      taxIds: ['GSTIN 27ZZZZZ9999Z1Z5'],
    })
  })

  it("prints a draft from the customer's entity as it is now", () => {
    const from = billFromFor({ status: InvoiceStatus.Draft }, entity, tenant)
    expect(from).toMatchObject({
      name: 'Northwind India Pvt Ltd',
      email: 'in@northwind.test',
      address: ['Bengaluru', 'IN'],
      taxIds: ['GSTIN 29ABCDE1234F1Z5'],
    })
  })

  it('prints the tenant while entities are off', () => {
    expect(billFromFor(null, null, tenant)).toBe(tenant)
    expect(billFromFor({ status: InvoiceStatus.Draft }, null, tenant)).toBe(tenant)
  })

  it('prints the tenant on an invoice issued before entities, which has no snapshot', () => {
    expect(billFromFor({ status: InvoiceStatus.Paid }, entity, tenant)).toBe(tenant)
  })
})
