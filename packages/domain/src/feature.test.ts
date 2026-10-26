import { describe, expect, it } from 'vitest'
import {
  aggregationFormula,
  AggregationType,
  FeatureType,
  ResetUsage,
  createFeatureSchema,
  emptyFeature,
  needsAggregationTarget,
} from './feature'

const parse = (value: unknown) => createFeatureSchema.safeParse(value)
const errors = (value: unknown) => {
  const r = parse(value)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}
const paths = (value: unknown) => {
  const r = parse(value)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

const meter = (overrides: Record<string, unknown> = {}) => ({
  eventName: 'api_call',
  aggregationType: AggregationType.Count,
  resetUsage: ResetUsage.BillingPeriod,
  ...overrides,
})

const metered = (
  meterOverrides: Record<string, unknown> = {},
  rest: Record<string, unknown> = {},
) => ({
  name: 'API calls',
  type: FeatureType.Metered,
  meter: meter(meterOverrides),
  ...rest,
})

describe('feature type decides whether a meter exists', () => {
  it.each([FeatureType.Boolean, FeatureType.Static, FeatureType.Config])(
    'accepts a %s feature with no meter',
    (type) => {
      expect(parse({ name: 'Seats', type }).success).toBe(true)
    },
  )

  it('requires a meter for a metered feature', () => {
    expect(paths({ name: 'API calls', type: FeatureType.Metered })).toContain('meter')
  })

  // The union is what stops a leftover meter riding along after a type switch:
  // the bug twelve parallel useStates make easy.
  it('drops a meter from a non-metered feature', () => {
    const result = parse({ name: 'Seats', type: FeatureType.Boolean, meter: meter() })
    expect(result.success && 'meter' in result.data).toBe(false)
  })

  it('needs a name whatever the type', () => {
    expect(errors({ name: '  ', type: FeatureType.Boolean })).toContain('Enter a name')
  })

  it.each(['API-Calls', 'apiCalls', 'api calls'])('rejects %s as a lookup key', (lookupKey) => {
    expect(errors({ name: 'x', type: FeatureType.Boolean, lookupKey })).toContain(
      'Use lowercase letters, numbers, hyphens and underscores',
    )
  })

  it('accepts a valid lookup key', () => {
    expect(parse({ name: 'x', type: FeatureType.Boolean, lookupKey: 'api_calls_2' }).success).toBe(
      true,
    )
  })
})

describe('aggregation decides which meter fields are required', () => {
  it('needs an event name', () => {
    expect(errors(metered({ eventName: '' }))).toContain('Enter the event name')
  })

  // COUNT is the only aggregation with nothing per event to add up.
  it('accepts COUNT with no field or expression', () => {
    expect(parse(metered({ aggregationType: AggregationType.Count })).success).toBe(true)
    expect(needsAggregationTarget(AggregationType.Count)).toBe(false)
  })

  it.each([
    AggregationType.Sum,
    AggregationType.Avg,
    AggregationType.Max,
    AggregationType.Latest,
  ])('requires a field or expression for %s', (aggregationType) => {
    expect(errors(metered({ aggregationType }))).toContain(
      'This aggregation needs an event field or an expression',
    )
    expect(needsAggregationTarget(aggregationType)).toBe(true)
  })

  it.each([
    AggregationType.CountUnique,
    AggregationType.WeightedSum,
    AggregationType.SumWithMultiplier,
  ])('requires a field, not an expression, for %s', (aggregationType) => {
    expect(errors(metered({ aggregationType }))).toContain('This aggregation needs an event field')
    expect(
      errors(metered({ aggregationType, expression: 'tokens * 2', field: 'tokens' })),
    ).toContain('This aggregation cannot use a custom expression')
  })

  // V1 picks which of these to validate by reading `showCustomExpression` out
  // of form state, so the rule cannot be checked outside the form. Either
  // satisfies it here.
  it.each([
    ['a field', { field: 'tokens' }],
    ['an expression', { expression: 'tokens * 2' }],
  ])('accepts %s as the aggregation target', (_label, target) => {
    expect(parse(metered({ aggregationType: AggregationType.Sum, ...target })).success).toBe(true)
  })

  it('reports the missing target against the meter, so the form can show it in place', () => {
    expect(paths(metered({ aggregationType: AggregationType.Sum }))).toContain('meter.field')
  })
})

describe('SUM_WITH_MULTIPLIER', () => {
  const withMultiplier = (multiplier: unknown) =>
    metered({ aggregationType: AggregationType.SumWithMultiplier, field: 'tokens', multiplier })

  it('accepts a positive decimal', () => {
    expect(parse(withMultiplier('1.5')).success).toBe(true)
  })

  it('requires a multiplier at all', () => {
    expect(
      paths(metered({ aggregationType: AggregationType.SumWithMultiplier, field: 'x' })),
    ).toContain('meter.multiplier')
  })

  // V1 writes `multiplier <= 0` against a *string*, which is always false: so
  // a zero multiplier passes validation there and silently bills nothing.
  it('rejects a zero multiplier, which V1 lets through', () => {
    expect(errors(withMultiplier('0'))).toContain('Must be greater than zero')
  })

  it.each(['-1', 'abc', ''])('rejects %p', (multiplier) => {
    expect(parse(withMultiplier(multiplier)).success).toBe(false)
  })

  it('keeps the multiplier an exact decimal string', () => {
    const r = parse(withMultiplier('0.000001'))
    expect(r.success && r.data.type === FeatureType.Metered && r.data.meter.multiplier).toBe(
      '0.000001',
    )
  })
})

describe('emptyFeature', () => {
  it.each([FeatureType.Metered, FeatureType.Boolean, FeatureType.Static, FeatureType.Config])(
    'is structurally complete for %s',
    (type) => {
      const value = emptyFeature(type)
      expect(value.type).toBe(type)

      const result = parse(value)
      if (!result.success) {
        // Blank text fails, but never structure: switching type cannot land
        // somewhere incoherent.
        for (const issue of result.error.issues) {
          expect(issue.path.join('.')).toMatch(/name|eventName/)
        }
      }
    },
  )

  it('opens a metered feature on COUNT, the one aggregation needing no field', () => {
    const value = emptyFeature(FeatureType.Metered)
    expect(value.type === FeatureType.Metered && value.meter.aggregationType).toBe(
      AggregationType.Count,
    )
  })
})

describe('aggregationFormula', () => {
  it('writes each aggregation as a spreadsheet formula over the field', () => {
    expect(aggregationFormula({ aggregationType: AggregationType.Count })).toBe('COUNT()')
    expect(
      aggregationFormula({ aggregationType: AggregationType.Sum, aggregationField: 'tokens' }),
    ).toBe('SUM(tokens)')
    expect(
      aggregationFormula({ aggregationType: AggregationType.Avg, aggregationField: 'latency' }),
    ).toBe('AVERAGE(latency)')
    expect(
      aggregationFormula({
        aggregationType: AggregationType.CountUnique,
        aggregationField: 'user_id',
      }),
    ).toBe('COUNTUNIQUE(user_id)')
    expect(
      aggregationFormula({
        aggregationType: AggregationType.SumWithMultiplier,
        aggregationField: 'tokens',
      }),
    ).toBe('SUM(tokens * multiplier)')
  })

  it('is null without a meter', () => {
    expect(aggregationFormula({ aggregationType: null })).toBeNull()
  })
})
