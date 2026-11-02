import type { BillingEntity } from '@fp/domain'

export function billingEntityFixtures(): BillingEntity[] {
  return [
    {
      id: 'be_01',
      name: 'Acme Inc',
      legalName: 'Acme Incorporated',
      isDefault: true,
      invoiceNumberPrefix: 'ACME',
      seller: { address: { country: 'US' } },
      taxIdentifiers: [],
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'be_02',
      name: 'Acme GmbH',
      legalName: 'Acme Deutschland GmbH',
      isDefault: false,
      invoiceNumberPrefix: 'ACME-DE',
      seller: { address: { country: 'DE' } },
      taxIdentifiers: [],
      createdAt: new Date('2026-10-12T00:00:00Z'),
    },
    {
      id: 'be_03',
      name: 'Acme India',
      legalName: 'Acme India Private Limited',
      isDefault: false,
      invoiceNumberPrefix: 'ACME-IN',
      seller: { address: {} },
      taxIdentifiers: [],
      createdAt: null,
    },
  ]
}
