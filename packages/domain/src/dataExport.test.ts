import { describe, expect, it } from 'vitest'
import {
  EXPORT_ENTITY,
  clampMetadataFields,
  emptyDataExport,
  emptyS3Connection,
  validateDataExport,
  validateS3Connection,
  validateS3ConnectionEdit,
} from './dataExport'

describe('validateDataExport', () => {
  it('asks for the bucket on your own S3, not on a managed one', () => {
    const draft = { ...emptyDataExport('conn'), bucket: '' }
    expect(validateDataExport(draft, { flexpriceManaged: false }).bucket).toBe(
      'Enter the bucket name',
    )
    expect(validateDataExport(draft, { flexpriceManaged: true })).toEqual({})
  })

  it('needs a key on every metadata column', () => {
    const draft = {
      ...emptyDataExport('conn'),
      bucket: 'b',
      entity: EXPORT_ENTITY.CreditUsage,
      metadataFields: [{ entity: 'customer' as const, fieldKey: ' ', columnName: '' }],
    }
    expect(validateDataExport(draft, { flexpriceManaged: false }).metadataFields).toBeTruthy()
  })
})

describe('clampMetadataFields', () => {
  it('moves wallet columns to customer for usage analytics, and drops them where none fit', () => {
    const fields = [{ entity: 'wallet' as const, fieldKey: 'k', columnName: '' }]
    expect(clampMetadataFields(fields, EXPORT_ENTITY.UsageAnalytics)[0]?.entity).toBe('customer')
    expect(clampMetadataFields(fields, EXPORT_ENTITY.Invoice)).toEqual([])
  })
})

describe('validateS3Connection', () => {
  it('needs keys only for a bucket you own', () => {
    expect(Object.keys(validateS3Connection(emptyS3Connection()))).toEqual([
      'name',
      'accessKeyId',
      'secretAccessKey',
    ])
    expect(
      validateS3Connection({ ...emptyS3Connection(), name: 'x', flexpriceManaged: true }),
    ).toEqual({})
  })
})

describe('validateS3ConnectionEdit', () => {
  const named = { ...emptyS3Connection(), name: 'Lake' }
  it('keeps the stored keys when both are blank', () => {
    expect(validateS3ConnectionEdit(named)).toEqual({})
  })
  it('needs a name, and both halves of a new key pair', () => {
    expect(Object.keys(validateS3ConnectionEdit(emptyS3Connection()))).toEqual(['name'])
    expect(validateS3ConnectionEdit({ ...named, accessKeyId: 'AKIA' })).toEqual({
      secretAccessKey: 'Enter the new AWS secret access key',
    })
    expect(validateS3ConnectionEdit({ ...named, secretAccessKey: 's' })).toEqual({
      accessKeyId: 'Enter the new AWS access key ID',
    })
    expect(
      validateS3ConnectionEdit({ ...named, accessKeyId: 'AKIA', secretAccessKey: 's' }),
    ).toEqual({})
    expect(validateS3ConnectionEdit({ ...named, sessionToken: 'tok' })).toEqual({
      accessKeyId: 'Enter the new AWS keys this session token belongs to',
    })
  })
})
