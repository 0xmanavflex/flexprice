import { describe, expect, it } from 'vitest'
import { newConnectionId } from './connectionId'

describe('newConnectionId', () => {
  it('is conn_ followed by a ULID', () => {
    expect(newConnectionId()).toMatch(/^conn_[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('starts with the current time', () => {
    const before = Date.now()
    const time = [...newConnectionId().slice(5, 15)].reduce(
      (acc, char) => acc * 32 + '0123456789ABCDEFGHJKMNPQRSTVWXYZ'.indexOf(char),
      0,
    )
    expect(time).toBeGreaterThanOrEqual(before)
    expect(time).toBeLessThanOrEqual(Date.now())
  })

  it('differs on every call', () => {
    expect(newConnectionId()).not.toBe(newConnectionId())
  })
})
