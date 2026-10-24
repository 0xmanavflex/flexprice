import { describe, expect, it } from 'vitest'
import { DEFAULT_FEATURE_QUERY, FeatureType, ACTIVE_FEATURES_FILTER } from '@fp/domain'
import { parseFeatureSearch } from './featureSearch'

describe('parseFeatureSearch', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseFeatureSearch({})).toEqual(DEFAULT_FEATURE_QUERY)
  })

  it('opens on published features, and an explicit empty filter list means every status', () => {
    expect(parseFeatureSearch({}).filters).toEqual([ACTIVE_FEATURES_FILTER])
    expect(parseFeatureSearch({ filters: [] }).filters).toEqual([])
  })

  it('leaves the default filter off a link that names a status', () => {
    expect(parseFeatureSearch({ status: 'archived' }).filters).toEqual([
      { field: 'status', op: 'in', value: ['archived'] },
    ])
  })

  it('reads a full query', () => {
    expect(parseFeatureSearch({ page: '2', size: '50', q: 'api', type: 'metered' })).toEqual({
      page: 2,
      pageSize: 50,
      search: 'api',
      types: [FeatureType.Metered],
      statuses: [],
      sortBy: DEFAULT_FEATURE_QUERY.sortBy,
      sortDirection: DEFAULT_FEATURE_QUERY.sortDirection,
      view: 'table',
      filters: [ACTIVE_FEATURES_FILTER],
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

  it('reads the cards view, and defaults everything else to the table', () => {
    expect(parseFeatureSearch({ view: 'cards' }).view).toBe('cards')
    expect(parseFeatureSearch({ view: 'table' }).view).toBe('table')
    expect(parseFeatureSearch({ view: 'grid' }).view).toBe('table')
    expect(parseFeatureSearch({}).view).toBe('table')
  })
})

/**
 * The round trip, which was broken.
 *
 * TanStack serialises the query object as it stands, so navigation writes
 * `types`, `pageSize`, `search`, `sortBy`. The parser only read the short
 * hand-written spellings, so every filter and sort reverted the instant it was
 * applied — no error, just a control that did nothing.
 */
describe('round-trips what the router writes', () => {
  it('reads the long names TanStack emits', () => {
    const query = parseFeatureSearch({
      page: 3,
      pageSize: 50,
      search: 'api',
      types: ['metered'],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    })

    expect(query).toEqual({
      page: 3,
      pageSize: 50,
      search: 'api',
      types: [FeatureType.Metered],
      statuses: [],
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      view: 'table',
      filters: [ACTIVE_FEATURES_FILTER],
    })
  })

  it('still reads the short names a person types', () => {
    expect(parseFeatureSearch({ q: 'api', sort: 'createdAt', dir: 'desc' })).toMatchObject({
      search: 'api',
      sortBy: 'createdAt',
      sortDirection: 'desc',
    })
  })

  // Parsing its own output must be a fixed point, or a reload changes the list.
  it('is stable across a parse of its own output', () => {
    const once = parseFeatureSearch({ types: ['metered'], sortBy: 'name', sortDirection: 'desc' })
    expect(parseFeatureSearch({ ...once })).toEqual(once)
  })
})
