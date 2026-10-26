import { describe, expect, it } from 'vitest'
import { activityFiltersFrom, activitySearchFrom, parseActivitySearch } from './activitySearch'

describe('the Activity tab in the URL', () => {
  it('keeps only valid filters and leaves defaults out', () => {
    expect(
      parseActivitySearch({
        q: ' INV-1 ',
        action: 'invoice.voided',
        actor: 'user',
        source: 'dashboard',
        range: '7d',
      }),
    ).toEqual({
      q: 'INV-1',
      action: 'invoice.voided',
      actor: 'user',
      source: 'dashboard',
      range: '7d',
    })
    expect(
      parseActivitySearch({ action: 'drop table', actor: 'robot', source: 'fax', range: '30d' }),
    ).toEqual({})
  })

  it('round-trips filters through the address bar', () => {
    const filters = activityFiltersFrom({ actor: 'system', range: '24h' })
    expect(filters).toEqual({
      search: '',
      action: '',
      actorType: 'system',
      source: '',
      range: '24h',
    })
    expect(activitySearchFrom(filters)).toEqual({ actor: 'system', range: '24h' })
    expect(activityFiltersFrom({}).range).toBe('30d')
  })
})

describe('a custom activity range in the URL', () => {
  it('keeps valid days only with range=custom', () => {
    expect(parseActivitySearch({ range: 'custom', from: '2026-10-01', to: '2026-10-15' })).toEqual({
      range: 'custom',
      from: '2026-10-01',
      to: '2026-10-15',
    })
    expect(parseActivitySearch({ range: 'custom', from: 'yesterday' })).toEqual({ range: 'custom' })
    // Days without a custom range are dropped: they mean nothing to 7d.
    expect(parseActivitySearch({ range: '7d', from: '2026-10-01' })).toEqual({ range: '7d' })
  })

  it('round-trips through the filters', () => {
    const filters = activityFiltersFrom({ range: 'custom', from: '2026-10-01', to: '2026-10-15' })
    expect(filters).toMatchObject({ range: 'custom', from: '2026-10-01', to: '2026-10-15' })
    expect(activitySearchFrom(filters)).toEqual({
      range: 'custom',
      from: '2026-10-01',
      to: '2026-10-15',
    })
  })
})

describe('one person in the URL', () => {
  it('keeps a person only when the actor is a user', () => {
    expect(parseActivitySearch({ actor: 'user', by: 'user_01ABC' })).toEqual({
      actor: 'user',
      by: 'user_01ABC',
    })
    expect(parseActivitySearch({ actor: 'api_key', by: 'user_01ABC' })).toEqual({
      actor: 'api_key',
    })
    expect(parseActivitySearch({ actor: 'user', by: 'a b/c' })).toEqual({ actor: 'user' })
  })

  it('round-trips the person', () => {
    const filters = activityFiltersFrom({ actor: 'user', by: 'user_01ABC' })
    expect(filters.actorId).toBe('user_01ABC')
    expect(activitySearchFrom(filters)).toEqual({ actor: 'user', by: 'user_01ABC' })
  })
})
