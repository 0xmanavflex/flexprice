import { describe, expect, it } from 'vitest'
import { ApiError, ErrorKind, kindForStatus, parseRetryAfter } from './errors'
import { transportError } from './timeout'

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')

  it('reads whole and fractional seconds', () => {
    expect(parseRetryAfter('30', now)).toBe(30_000)
    expect(parseRetryAfter(' 1.5 ', now)).toBe(1_500)
    expect(parseRetryAfter('0', now)).toBe(0)
  })

  it('reads an HTTP date relative to now', () => {
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:01:00 GMT', now)).toBe(60_000)
  })

  it('treats a date in the past as retry-now', () => {
    expect(parseRetryAfter('Wed, 31 Dec 2025 23:00:00 GMT', now)).toBe(0)
  })

  it.each([null, undefined, '', '   ', 'soon', '-5'])('is undefined for %j', (value) => {
    expect(parseRetryAfter(value, now)).toBeUndefined()
  })
})

describe('error kinds', () => {
  it('maps 429 to RateLimited, which is not blindly retryable', () => {
    expect(kindForStatus(429)).toBe(ErrorKind.RateLimited)
    expect(new ApiError(ErrorKind.RateLimited, 'x').retryable).toBe(false)
  })

  it('treats Timeout as retryable and Cancelled as not', () => {
    expect(new ApiError(ErrorKind.Timeout, 'x').retryable).toBe(true)
    expect(new ApiError(ErrorKind.Cancelled, 'x').retryable).toBe(false)
  })
})

describe('transportError', () => {
  it('tells slow, cancelled and offline apart', () => {
    expect(transportError(new DOMException('t', 'TimeoutError')).kind).toBe(ErrorKind.Timeout)
    expect(transportError(new DOMException('a', 'AbortError')).kind).toBe(ErrorKind.Cancelled)
    expect(transportError(new TypeError('Failed to fetch')).kind).toBe(ErrorKind.Network)
  })
})
