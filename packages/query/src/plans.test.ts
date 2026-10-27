import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAN_QUERY, usageBasedLabel } from '@fp/domain'
import { toCreatePlanRequest, toPlan, toPlanFilter, toUpdatePlanRequest } from './plans'

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

describe('a usage-only plan', () => {
  it('names what its usage charges meter: display name first, else the meter', () => {
    const plan = toPlan({
      id: 'plan_usage',
      prices: [
        { type: 'USAGE', displayName: 'API calls', meter: { name: 'api_calls' } },
        { type: 'USAGE', meter: { name: 'Tokens' } },
        { type: 'USAGE', meter: { name: 'Tokens' } },
      ],
    } as never)
    expect(plan.usageNames).toEqual(['API calls', 'Tokens'])
  })

  it('asks the list for meters so it can name them', () => {
    expect(toPlanFilter(DEFAULT_PLAN_QUERY).expand).toBe('prices,meters')
  })
})

describe('usageBasedLabel', () => {
  it('reads as a customer would: two names, then a count', () => {
    expect(usageBasedLabel(['API calls'])).toBe('Usage-based · API calls')
    expect(usageBasedLabel(['API calls', 'Tokens', 'Minutes', 'Seats'])).toBe(
      'Usage-based · API calls, Tokens +2 more',
    )
    expect(usageBasedLabel(['', ' '])).toBe('Usage-based')
  })
})
