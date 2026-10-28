import { describe, expect, it } from 'vitest'
import { billingEntitySchema, effectiveEntityId, emptyBillingEntity } from './billingEntity'

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

describe('effectiveEntityId', () => {
  const entities = [
    { id: 'be_i', isDefault: false },
    { id: 'be_d', isDefault: true },
  ]

  it('reads a customer without an entity as the default one', () => {
    expect(effectiveEntityId({ billingEntityId: null }, entities)).toBe('be_d')
    expect(effectiveEntityId({ billingEntityId: 'be_i' }, entities)).toBe('be_i')
  })
})
