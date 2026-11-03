import { describe, expect, it } from 'vitest'
import { DEFAULT_ADDON_QUERY } from '@fp/domain'
import type { Flexprice } from '@fp/api'
import { fetchAddons, toCreateAddonRequest, toUpdateAddonRequest } from './addons'

describe('toCreateAddonRequest', () => {
  it('sends name and the required lookup key', () => {
    expect(
      toCreateAddonRequest({ name: 'Priority support', lookupKey: 'priority_support' }),
    ).toEqual({ name: 'Priority support', lookupKey: 'priority_support' })
  })

  it('includes a description only when there is one', () => {
    expect(
      toCreateAddonRequest({ name: 'A', lookupKey: 'a', description: 'Extra' }),
    ).toHaveProperty('description', 'Extra')
    expect(toCreateAddonRequest({ name: 'A', lookupKey: 'a', description: '' })).not.toHaveProperty(
      'description',
    )
  })
})

describe('toUpdateAddonRequest', () => {
  it('does not send the lookup key: it is fixed once set', () => {
    expect(
      toUpdateAddonRequest({ name: 'Priority support', lookupKey: 'priority_support' }),
    ).not.toHaveProperty('lookupKey')
  })

  it('sends an empty description so clearing the text actually clears it', () => {
    expect(toUpdateAddonRequest({ name: 'A', lookupKey: 'a' })).toEqual({
      name: 'A',
      description: '',
    })
    expect(toUpdateAddonRequest({ name: 'A', lookupKey: 'a', description: 'Extra' })).toEqual({
      name: 'A',
      description: 'Extra',
    })
  })
})

describe('fetchAddons', () => {
  // 120 add-ons on the server; the first 100 are shells with no charge.
  const all = Array.from({ length: 120 }, (_, index) => ({
    id: `addon_${index}`,
    name: `Add-on ${index}`,
    prices: index < 100 ? [] : [{ type: 'FIXED' }],
  }))
  const client = {
    addons: {
      queryAddon: async (filter: { limit: number; offset: number }) => ({
        items: all.slice(filter.offset, filter.offset + filter.limit),
        pagination: { total: all.length },
      }),
    },
  } as unknown as Flexprice

  it('pages priced add-ons, not the server page they sit on', async () => {
    const first = await fetchAddons(client, { ...DEFAULT_ADDON_QUERY, page: 1, pageSize: 10 })
    expect(first.total).toBe(20)
    expect(first.addons.map((addon) => addon.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `addon_${100 + index}`),
    )
    const second = await fetchAddons(client, { ...DEFAULT_ADDON_QUERY, page: 2, pageSize: 10 })
    expect(second.total).toBe(20)
    expect(second.addons[0]?.id).toBe('addon_110')
  })
})
