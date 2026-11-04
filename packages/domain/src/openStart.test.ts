import { describe, expect, it } from 'vitest'
import { OPEN_START_DATE, isOpenStart } from './price'

describe('isOpenStart', () => {
  it('treats the open start date, and anything before it, as no start', () => {
    expect(isOpenStart(new Date(`${OPEN_START_DATE}T00:00:00Z`))).toBe(true)
    expect(isOpenStart(new Date('1999-06-01T00:00:00Z'))).toBe(true)
  })

  it('keeps a real start date, and nothing at all, as they are', () => {
    expect(isOpenStart(new Date('2000-01-02T00:00:00Z'))).toBe(false)
    expect(isOpenStart(new Date('2026-11-01T00:00:00Z'))).toBe(false)
    expect(isOpenStart(null)).toBe(false)
  })
})
