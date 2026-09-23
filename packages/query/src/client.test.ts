import { describe, expect, it } from 'vitest'
import { ApiError, ErrorKind } from '@fp/api'
import { shouldRetry } from './client'
import { queryKeys } from './keys'

describe('retry policy', () => {
  // The payoff from normalizing errors: the client can tell a flaky network
  // from a refusal, so it stops asking a question already answered.
  it.each([
    ['a refusal', ErrorKind.Forbidden],
    ['an expired session', ErrorKind.Unauthorized],
    ['a missing record', ErrorKind.NotFound],
    ['bad input', ErrorKind.Invalid],
  ])('does not retry %s', (_label, kind) => {
    expect(shouldRetry(0, new ApiError(kind, 'no'))).toBe(false)
  })

  it.each([
    ['a network drop', ErrorKind.Network],
    ['a server fault', ErrorKind.Server],
  ])('retries %s, up to three times', (_label, kind) => {
    const error = new ApiError(kind, 'transient')

    expect(shouldRetry(0, error)).toBe(true)
    expect(shouldRetry(2, error)).toBe(true)
    expect(shouldRetry(3, error)).toBe(false)
  })

  it('does not retry something it cannot classify', () => {
    expect(shouldRetry(0, new Error('who knows'))).toBe(false)
    expect(shouldRetry(0, 'a string')).toBe(false)
  })
})

describe('query keys', () => {
  it('nests detail and list keys under the entity, so a prefix invalidates both', () => {
    const all = queryKeys.customers.all()

    for (const key of [queryKeys.customers.detail('cus_1'), queryKeys.customers.list({ q: 'a' })]) {
      expect(key.slice(0, all.length)).toEqual([...all])
    }
  })

  it('distinguishes lists by their filter', () => {
    expect(queryKeys.customers.list({ page: 1 })).not.toEqual(queryKeys.customers.list({ page: 2 }))
  })

  it('is stable for the same filter, so a re-render does not refetch', () => {
    expect(queryKeys.customers.list({ page: 1 })).toEqual(queryKeys.customers.list({ page: 1 }))
  })
})
