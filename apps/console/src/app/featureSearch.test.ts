import { describe, expect, it } from 'vitest'
import { DEFAULT_FEATURE_QUERY, FeatureType } from '@fp/domain'
import { parseFeatureSearch, toFeatureSearch } from './featureSearch'

describe('parseFeatureSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseFeatureSearch({})).toEqual(DEFAULT_FEATURE_QUERY)
  })

  it('reads a full query', () => {
    expect(parseFeatureSearch({ page: '2', size: '50', q: 'api', type: 'metered' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'api',
      types: [FeatureType.Metered],
    })
  })

  it('accepts types as a repeated param or a comma list', () => {
    expect(parseFeatureSearch({ type: ['metered', 'boolean'] }).types).toEqual([
      'metered',
      'boolean',
    ])
    expect(parseFeatureSearch({ type: 'metered,boolean' }).types).toEqual(['metered', 'boolean'])
  })

  it.each([
    ['a bad page', { page: 'abc' }],
    ['page zero', { page: '0' }],
    ['an unknown type', { type: 'quantum' }],
    ['nulls', { page: null, type: null, q: null }],
  ])('degrades %s rather than throwing', (_label, raw) => {
    expect(() => parseFeatureSearch(raw as Record<string, unknown>)).not.toThrow()
    expect(parseFeatureSearch(raw as Record<string, unknown>).page).toBeGreaterThanOrEqual(1)
  })

  it('caps page size', () => {
    expect(parseFeatureSearch({ size: '99999' }).pageSize).toBe(100)
  })
})

describe('toFeatureSearch', () => {
  it('omits defaults, keeping /features canonical', () => {
    expect(toFeatureSearch(DEFAULT_FEATURE_QUERY)).toEqual({})
  })

  it('orders types so the same filter is always the same URL', () => {
    expect(toFeatureSearch({ ...DEFAULT_FEATURE_QUERY, types: ['static', 'boolean'] as never }))
      .toEqual(toFeatureSearch({ ...DEFAULT_FEATURE_QUERY, types: ['boolean', 'static'] as never }))
  })

  it.each([
    DEFAULT_FEATURE_QUERY,
    { ...DEFAULT_FEATURE_QUERY, page: 4, pageSize: 50 },
    { ...DEFAULT_FEATURE_QUERY, search: 'api', types: [FeatureType.Metered] },
  ])('round-trips (%#)', (query) => {
    expect(parseFeatureSearch(toFeatureSearch(query))).toEqual(query)
  })
})
