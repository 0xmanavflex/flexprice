import { describe, expect, it } from 'vitest'
import {
  AggregationType,
  DEFAULT_FEATURE_QUERY,
  FeatureType,
  ResetUsage,
  createFeatureSchema,
} from '@fp/domain'
import { toCreateFeatureRequest, toFeature, toFeatureFilter, type FeatureWire } from './features'

const valid = (value: unknown) => createFeatureSchema.parse(value)

describe('toFeatureFilter', () => {
  it('turns a 1-based page into an offset', () => {
    expect(toFeatureFilter({ ...DEFAULT_FEATURE_QUERY, page: 3, pageSize: 25 })).toMatchObject({
      limit: 25,
      offset: 50,
    })
  })

  it('sends the default view as a server-side "status in published" condition', () => {
    expect(toFeatureFilter(DEFAULT_FEATURE_QUERY)['filters']).toEqual([
      { field: 'status', operator: 'in', dataType: 'array', value: { array: ['published'] } },
    ])
  })

  it('sends a name search only when there is one', () => {
    expect(toFeatureFilter(DEFAULT_FEATURE_QUERY)).not.toHaveProperty('nameContains')
    expect(toFeatureFilter({ ...DEFAULT_FEATURE_QUERY, search: 'api' })).toMatchObject({
      nameContains: 'api',
    })
  })
})

describe('toCreateFeatureRequest', () => {
  it('omits optional fields rather than sending empty ones', () => {
    const result = toCreateFeatureRequest(valid({ name: 'Seats', type: FeatureType.Boolean }))

    expect(result).toEqual({ name: 'Seats', type: 'boolean' })
    expect(result).not.toHaveProperty('meter')
    expect(result).not.toHaveProperty('lookupKey')
  })

  it('fills the plural unit from the singular when only the singular is given', () => {
    const result = toCreateFeatureRequest(
      valid({ name: 'Seats', type: FeatureType.Boolean, unitSingular: 'seat' }),
    )
    expect(result).toMatchObject({ unitSingular: 'seat', unitPlural: 'seats' })
  })

  it('nests the meter inline, so one call creates both', () => {
    const result = toCreateFeatureRequest(
      valid({
        name: 'API calls',
        type: FeatureType.Metered,
        lookupKey: 'api_calls',
        meter: {
          eventName: 'api_call',
          aggregationType: AggregationType.Sum,
          field: 'tokens',
          resetUsage: ResetUsage.BillingPeriod,
        },
      }),
    )

    expect(result).toMatchObject({
      name: 'API calls',
      type: 'metered',
      lookupKey: 'api_calls',
      meter: {
        name: 'API calls',
        eventName: 'api_call',
        resetUsage: 'BILLING_PERIOD',
        aggregation: { type: 'SUM', field: 'tokens' },
      },
    })
  })

  it('omits the aggregation target COUNT does not need', () => {
    const result = toCreateFeatureRequest(
      valid({
        name: 'Requests',
        type: FeatureType.Metered,
        meter: {
          eventName: 'request',
          aggregationType: AggregationType.Count,
          resetUsage: ResetUsage.Never,
        },
      }),
    ) as { meter: { aggregation: Record<string, unknown> } }

    expect(result.meter.aggregation).toEqual({ type: 'COUNT' })
  })

  // Multipliers are decimal strings all the way to the wire.
  it('keeps the multiplier an exact decimal string', () => {
    const result = toCreateFeatureRequest(
      valid({
        name: 'Weighted',
        type: FeatureType.Metered,
        meter: {
          eventName: 'e',
          aggregationType: AggregationType.SumWithMultiplier,
          field: 'tokens',
          multiplier: '0.000001',
          resetUsage: ResetUsage.BillingPeriod,
        },
      }),
    ) as { meter: { aggregation: { multiplier: string } } }

    expect(result.meter.aggregation.multiplier).toBe('0.000001')
  })
})

describe('toFeature', () => {
  const wire: FeatureWire = {
    id: 'feat_1',
    name: 'API calls',
    lookupKey: 'api_calls',
    type: 'metered',
    meter: { eventName: 'api_call', aggregation: { type: 'SUM' } },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }

  it('lifts the meter details onto the row, so no cell has to dig', () => {
    expect(toFeature(wire)).toMatchObject({
      id: 'feat_1',
      type: FeatureType.Metered,
      eventName: 'api_call',
      aggregationType: AggregationType.Sum,
    })
  })

  it('carries the multiplier and group-by the Information tab shows', () => {
    const feature = toFeature({
      ...wire,
      meter: {
        eventName: 'llm_completion',
        aggregation: { type: 'SUM_WITH_MULTIPLIER', field: 'tokens', multiplier: '2.5' },
      },
    })
    expect(feature.aggregationMultiplier).toBe('2.5')
    expect(feature.aggregationGroupBy).toBeNull()
    expect(toFeature(wire).aggregationMultiplier).toBeNull()
    expect(
      toFeature({
        ...wire,
        meter: { eventName: 'x', aggregation: { type: 'MAX', field: 'v', groupBy: 'region' } },
      }).aggregationGroupBy,
    ).toBe('region')
  })

  it('reports no meter for a non-metered feature', () => {
    expect(toFeature({ id: 'f', name: 'Seats', type: 'boolean' })).toMatchObject({
      eventName: null,
      aggregationType: null,
    })
  })

  it('maps status, defaulting an unknown or missing one to published', () => {
    expect(toFeature({ status: 'archived' }).status).toBe('archived')
    expect(toFeature({ status: 'weird' }).status).toBe('published')
    expect(toFeature({}).status).toBe('published')
  })

  // Every field on FeatureResponse is optional. The grid must still get a row.
  it('survives a response with nothing on it', () => {
    expect(toFeature({})).toMatchObject({
      id: '',
      name: 'Untitled feature',
      type: FeatureType.Boolean,
      createdAt: null,
    })
  })

  // An unrecognised type means the API is ahead of this client. Showing the row
  // is better than dropping it, which would hide data with no explanation.
  it('keeps a row whose type it does not recognise', () => {
    expect(toFeature({ id: 'f', name: 'New kind', type: 'quantum' }).type).toBe(FeatureType.Boolean)
  })
})

describe('toFeature alert settings', () => {
  // V1 stores a feature's usage alerts on the feature; the menu's dialog edits them.
  it('reads the thresholds the feature carries, and null when it has none', () => {
    const feature = toFeature({
      id: 'feat_1',
      alertSettings: {
        alertEnabled: true,
        alertThresholdType: 'absolute',
        warning: { threshold: '500', condition: 'above' },
      },
    })
    expect(feature.alertSettings).toEqual({
      alertEnabled: true,
      thresholdType: 'absolute',
      warning: { threshold: '500', condition: 'above' },
    })
    expect(toFeature({ id: 'feat_2' }).alertSettings).toBeNull()
  })
})
