import { describe, expect, it } from 'vitest'
import { toCreatePlanRequest, toUpdatePlanRequest } from './plans'

describe('toCreatePlanRequest', () => {
  it('requires only the name; the lookup key is optional', () => {
    expect(toCreatePlanRequest({ name: 'Pro' })).toEqual({ name: 'Pro' })
  })

  it('includes lookup key and description only when present', () => {
    expect(
      toCreatePlanRequest({ name: 'Pro', lookupKey: 'pro', description: 'For teams' }),
    ).toEqual({
      name: 'Pro',
      lookupKey: 'pro',
      description: 'For teams',
    })
    expect(toCreatePlanRequest({ name: 'Pro', lookupKey: '', description: '' })).toEqual({
      name: 'Pro',
    })
  })
})

describe('toUpdatePlanRequest', () => {
  it('sends the lookup key and description as empty strings so they can be cleared', () => {
    expect(toUpdatePlanRequest({ name: 'Pro' })).toEqual({
      name: 'Pro',
      lookupKey: '',
      description: '',
    })
  })

  it('keeps a plan’s editable lookup key', () => {
    expect(
      toUpdatePlanRequest({ name: 'Pro', lookupKey: 'pro_v2', description: 'For teams' }),
    ).toEqual({ name: 'Pro', lookupKey: 'pro_v2', description: 'For teams' })
  })
})
