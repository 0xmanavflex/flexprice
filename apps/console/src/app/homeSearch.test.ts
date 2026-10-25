import { describe, expect, it } from 'vitest'
import { DEFAULT_HOME_SEARCH, parseHomeSearch } from './homeSearch'

describe('parseHomeSearch', () => {
  it('keeps a valid range, granularity, custom span and metric', () => {
    expect(
      parseHomeSearch({
        range: 'custom',
        grain: 'weekly',
        from: '2026-09-01',
        to: '2026-09-30',
        metric: 'events',
      }),
    ).toEqual({
      range: 'custom',
      grain: 'weekly',
      from: '2026-09-01',
      to: '2026-09-30',
      metric: 'events',
    })
  })

  it('falls back to the defaults for anything it does not know', () => {
    expect(parseHomeSearch({ range: '2y', grain: 'monthly', from: 'soon', metric: 'mrr' })).toEqual(
      DEFAULT_HOME_SEARCH,
    )
    expect(parseHomeSearch({})).toEqual(DEFAULT_HOME_SEARCH)
  })

  it('puts a reversed custom span in order', () => {
    expect(
      parseHomeSearch({ range: 'custom', from: '2026-09-30', to: '2026-09-01' }),
    ).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    })
  })
})
