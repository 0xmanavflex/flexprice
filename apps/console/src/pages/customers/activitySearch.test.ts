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
