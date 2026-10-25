import { describe, expect, it } from 'vitest'
import { toCreateAddonRequest, toUpdateAddonRequest } from './addons'

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
