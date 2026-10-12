import { ApiError, ErrorKind } from '@fp/query'
import { describe, expect, it } from 'vitest'
import { messageForSignInError } from './signInMessage'

const fail = (kind: (typeof ErrorKind)[keyof typeof ErrorKind], retryAfterMs?: number) =>
  messageForSignInError(
    new ApiError(kind, 'raw backend text', retryAfterMs === undefined ? {} : { retryAfterMs }),
  )

describe('messageForSignInError', () => {
  it('collapses the credential outcomes to one sentence, so accounts cannot be enumerated', () => {
    const wrong = 'That email and password do not match.'
    expect(fail(ErrorKind.Unauthorized)).toBe(wrong)
    expect(fail(ErrorKind.Forbidden)).toBe(wrong)
    expect(fail(ErrorKind.NotFound)).toBe(wrong)
  })

  it('tells network, timeout, rate limit and server apart from a wrong password', () => {
    const messages = new Set([
      fail(ErrorKind.Network),
      fail(ErrorKind.Timeout),
      fail(ErrorKind.RateLimited),
      fail(ErrorKind.Server),
      fail(ErrorKind.Unauthorized),
    ])
    expect(messages.size).toBe(5)
    expect(fail(ErrorKind.Network)).toMatch(/connection/i)
    expect(fail(ErrorKind.Timeout)).toMatch(/too long/i)
    expect(fail(ErrorKind.Server)).toMatch(/trouble/i)
  })

  it('says how long to wait when the server said so', () => {
    expect(fail(ErrorKind.RateLimited, 12_000)).toBe(
      'Too many sign-in attempts. Try again in 12 seconds.',
    )
    expect(fail(ErrorKind.RateLimited, 500)).toMatch(/1 second\./)
    expect(fail(ErrorKind.RateLimited)).toMatch(/wait a moment/i)
  })

  it('never forwards raw backend text for an unknown failure', () => {
    expect(messageForSignInError(new Error('boom'))).toBe(
      'Something went wrong signing in. Try again.',
    )
  })
})
