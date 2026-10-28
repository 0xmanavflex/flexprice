import { describe, expect, it } from 'vitest'
import { billingEntitySchema, emptyBillingEntity } from './billingEntity'

const valid = {
  ...emptyBillingEntity(),
  name: 'Acme',
  legalName: 'Acme Inc',
  invoiceNumberPrefix: 'ACME',
}

describe('billingEntitySchema tax IDs', () => {
  it.each([
    [{ type: '', value: '', country: '' }],
    [{ type: 'GSTIN', value: '  ' }],
    [{ type: '', value: '29ABCDE1234F1Z5' }],
  ])('rejects a blank or half-filled row %o', (row) => {
    expect(billingEntitySchema.safeParse({ ...valid, taxIdentifiers: [row] }).success).toBe(false)
  })

  it('accepts a complete row, trimmed, with country optional', () => {
    const parsed = billingEntitySchema.parse({
      ...valid,
      taxIdentifiers: [{ type: ' GSTIN ', value: ' 29ABCDE1234F1Z5 ' }],
    })
    expect(parsed.taxIdentifiers).toEqual([{ type: 'GSTIN', value: '29ABCDE1234F1Z5' }])
  })
})
