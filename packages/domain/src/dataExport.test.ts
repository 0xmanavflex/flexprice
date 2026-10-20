import { describe, expect, it } from 'vitest'
import {
  EXPORT_ENTITY,
  clampMetadataFields,
  emptyDataExport,
  emptyS3Connection,
  validateDataExport,
  validateS3Connection,
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
