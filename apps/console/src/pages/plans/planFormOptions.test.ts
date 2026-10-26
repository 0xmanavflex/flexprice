import { describe, expect, it } from 'vitest'
import { type Feature, FeatureStatus, FeatureType } from '@fp/domain'
import { toMeterOptions, withMeters } from './planFormOptions'

const feature = (patch: Partial<Feature>): Feature => ({
  id: 'feat_1',
  name: 'API calls',
  lookupKey: '',
  description: '',
  type: FeatureType.Metered,
  status: FeatureStatus.Published,
  eventName: 'api_call',
  aggregationType: null,
  meterId: 'meter_1',
  unitSingular: '',
  unitPlural: '',
  createdAt: null,
  updatedAt: null,
  ...patch,
})

describe('withMeters', () => {
  it('adds a plan charge’s meter that lies past the picker’s first page', () => {
    const firstPage = toMeterOptions([feature({ id: 'feat_1', meterId: 'meter_1' })])
    const meters = withMeters(firstPage, [
      feature({ id: 'feat_1', meterId: 'meter_1' }),
      feature({
        id: 'feat_101',
        name: 'GPU time',
        meterId: 'meter_101',
        aggregationType: 'SUM' as Feature['aggregationType'],
        meterBucketSize: 'HOUR',
      }),
    ])
    expect(meters.map((meter) => meter.id)).toEqual(['meter_1', 'meter_101'])
    expect(meters[1]).toEqual({
      id: 'meter_101',
      name: 'GPU time',
      aggregationType: 'SUM',
      bucketSize: 'HOUR',
    })
  })

  it('offers a meter shared by several features once', () => {
    const meters = withMeters(
      [],
      [
        feature({ id: 'feat_101', name: 'GPU time', meterId: 'meter_101' }),
        feature({ id: 'feat_102', name: 'GPU credits', meterId: 'meter_101' }),
      ],
    )
    expect(meters.map((meter) => meter.id)).toEqual(['meter_101'])
    expect(meters[0]?.name).toBe('GPU time')
  })

  it('skips features with no meter', () => {
    expect(withMeters([], [feature({ type: FeatureType.Boolean, meterId: null })])).toEqual([])
  })
})
