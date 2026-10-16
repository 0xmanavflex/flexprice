import { describe, expect, it } from 'vitest'
import {
  ApiError,
  ErrorKind,
  kindForStatus,
  parseRetryAfter,
  readErrorBody,
  serverReason,
} from './errors'
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

describe('readErrorBody', () => {
  const read = (body: unknown) => readErrorBody(JSON.stringify(body), 'fallback')

  it('reads every envelope the backend answers with', () => {
    // The documented wrapper.
    expect(
      read({ success: false, error: { message: 'Name is taken', details: { name: 'taken' } } }),
    ).toEqual({ message: 'Name is taken', details: { name: 'taken' }, fromServer: true })
    // What the `ierr` error handler writes.
    expect(
      read({ code: 'permission_denied', message: 'Plan is archived', http_status_code: 403 }),
    ).toEqual({ message: 'Plan is archived', fromServer: true })
    // The auth middleware: `error` is a label, `message` the sentence.
    expect(
      read({ error: 'Access denied', message: 'Invalid or inaccessible environment' }),
    ).toEqual({ message: 'Invalid or inaccessible environment', fromServer: true })
    // Supabase, and a bare string.
    expect(read({ msg: 'Email not confirmed' }).message).toBe('Email not confirmed')
    expect(read({ error: 'Something broke' }).message).toBe('Something broke')
  })

  it('keeps only string details', () => {
    expect(read({ message: 'Bad', details: { a: 'x', b: 2 } }).details).toEqual({ a: 'x' })
  })

  it('falls back on anything it cannot read', () => {
    expect(readErrorBody('<html>502</html>', 'fallback')).toEqual({ message: 'fallback' })
    expect(read({ nothing: true })).toEqual({ message: 'fallback' })
    expect(read({ message: '   ' })).toEqual({ message: 'fallback' })
  })
})

describe('serverReason', () => {
  it("returns only the server's own sentence", () => {
    expect(
      serverReason(
        new ApiError(ErrorKind.Forbidden, 'Invalid or inaccessible environment', {
          fromServer: true,
        }),
      ),
    ).toBe('Invalid or inaccessible environment')
    expect(serverReason(new ApiError(ErrorKind.Forbidden, 'The request failed (403).'))).toBeNull()
    expect(serverReason(new Error('x'))).toBeNull()
  })
})
