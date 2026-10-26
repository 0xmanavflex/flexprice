// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { readSession, writeSession } from './storage'

describe('the stored session', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
  })

  it('keeps the region of a session Supabase refreshes', () => {
    writeSession({ token: 't', userId: 'u', tenantId: 'ten', region: 'in' })
    expect(readSession()).toEqual({ token: 't', userId: 'u', tenantId: 'ten', region: 'in' })
  })

  it('reads a session from before regions were stored as one with no refresh', () => {
    globalThis.localStorage.setItem(
      'flexprice.session',
      JSON.stringify({ token: 't', userId: 'u', tenantId: 'ten' }),
    )
    expect(readSession()).toEqual({ token: 't', userId: 'u', tenantId: 'ten' })
  })
})
