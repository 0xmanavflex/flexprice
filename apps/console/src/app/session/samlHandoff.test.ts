import { beforeEach, describe, expect, it } from 'vitest'
import {
  parseFragment,
  readHandoff,
  rememberTenant,
  takeTenant,
  type MaybeStorage,
} from './samlHandoff'

/*
 * Storage is handed in, so these tests need neither a browser nor a stubbed
 * global. The first version leaned on an ambient `sessionStorage`, which is
 * how it passed here and failed in CI: Node 26 exposes Web Storage as a
 * global and the Node 24 that CI pins does not.
 */
function fakeStorage(): MaybeStorage {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => void entries.delete(key),
    setItem: (key: string, value: string) => void entries.set(key, value),
  }
}

let storage: MaybeStorage

beforeEach(() => {
  storage = fakeStorage()
})

describe('parseFragment', () => {
  it('reads the token, tenant and state the backend sends', () => {
    expect(parseFragment('#token=abc.def&tenant_id=ten_1&state=/plans')).toEqual({
      token: 'abc.def',
      tenantId: 'ten_1',
      state: '/plans',
    })
  })

  it('works without the leading hash, and without a state', () => {
    expect(parseFragment('token=abc&tenant_id=ten_1')).toEqual({
      token: 'abc',
      tenantId: 'ten_1',
    })
  })

  it('keeps a JWT whole — its padding is not a parameter separator', () => {
    const jwt = 'eyJhbGci.eyJzdWIi.c2lnbmF0dXJl=='
    expect(parseFragment(`#token=${encodeURIComponent(jwt)}&tenant_id=ten_1`)?.token).toBe(jwt)
  })

  it('is nothing when the fragment is empty or has no hand-off in it', () => {
    expect(parseFragment('')).toBeNull()
    expect(parseFragment('#')).toBeNull()
    expect(parseFragment('#section-charges')).toBeNull()
  })

  it('refuses half a hand-off: a token with no tenant cannot be checked', () => {
    expect(parseFragment('#token=abc')).toBeNull()
    expect(parseFragment('#tenant_id=ten_1')).toBeNull()
    expect(parseFragment('#token=&tenant_id=ten_1')).toBeNull()
  })
})

describe('the started-login tenant', () => {
  it('is readable once and then forgotten', () => {
    rememberTenant('ten_1', storage)
    expect(takeTenant(storage)).toBe('ten_1')
    expect(takeTenant(storage)).toBeNull()
  })
})

describe('readHandoff', () => {
  it('accepts a callback that answers the login this browser started', () => {
    rememberTenant('ten_1', storage)
    expect(readHandoff('#token=abc&tenant_id=ten_1', storage)).toEqual({
      ok: true,
      handoff: { token: 'abc', tenantId: 'ten_1' },
    })
  })

  /*
   * The attack the backend's own note describes: a token minted for one
   * tenant, planted on a browser part-way through signing in to another.
   */
  it('refuses a token for a tenant other than the one being signed in to', () => {
    rememberTenant('ten_1', storage)
    expect(readHandoff('#token=abc&tenant_id=ten_evil', storage)).toEqual({
      ok: false,
      reason: 'rejected',
    })
  })

  it('refuses a callback this browser never started, rather than trusting it', () => {
    expect(readHandoff('#token=abc&tenant_id=ten_1', storage)).toEqual({
      ok: false,
      reason: 'rejected',
    })
  })

  it('spends the remembered tenant, so a replayed callback is refused', () => {
    rememberTenant('ten_1', storage)
    expect(readHandoff('#token=abc&tenant_id=ten_1', storage).ok).toBe(true)
    expect(readHandoff('#token=abc&tenant_id=ten_1', storage)).toEqual({
      ok: false,
      reason: 'rejected',
    })
  })

  /*
   * Fail closed, not open.
   *
   * A browser with storage blocked cannot record which login it started, so
   * it has nothing to check the callback against. Refusing is the only safe
   * answer: accepting "we could not check" would hand the whole tenant
   * comparison to anyone who can make the check impossible.
   */
  it('refuses when the browser cannot remember which login it started', () => {
    rememberTenant('ten_1', undefined)
    expect(readHandoff('#token=abc&tenant_id=ten_1', undefined)).toEqual({
      ok: false,
      reason: 'rejected',
    })
  })

  it('says only that it was refused, never which half was wrong', () => {
    rememberTenant('ten_1', storage)
    const wrongTenant = readHandoff('#token=abc&tenant_id=ten_evil', storage)
    const noneStarted = readHandoff('#token=abc&tenant_id=ten_1', storage)
    expect(wrongTenant).toEqual(noneStarted)
  })
})
