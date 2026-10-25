import { beforeEach, describe, expect, it } from 'vitest'
import {
  newNonce,
  parseFragment,
  readHandoff,
  startLogin,
  takeStarted,
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

  it('keeps a JWT whole: its padding is not a parameter separator', () => {
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

describe('the started login', () => {
  it('is readable once and then forgotten', () => {
    const nonce = startLogin('ten_1', storage)
    expect(takeStarted(storage)).toEqual({ tenantId: 'ten_1', nonce })
    expect(takeStarted(storage)).toEqual({ tenantId: null, nonce: null })
  })

  it('mints a fresh nonce each time, short enough for RelayState', () => {
    const nonces = new Set(Array.from({ length: 50 }, () => newNonce()))
    expect(nonces.size).toBe(50)
    for (const nonce of nonces) expect(nonce.length).toBeLessThanOrEqual(80)
  })
})

describe('readHandoff', () => {
  it('accepts a callback that answers the login this browser started', () => {
    const nonce = startLogin('ten_1', storage)
    expect(readHandoff(`#token=abc&tenant_id=ten_1&state=${nonce}`, storage)).toEqual({
      ok: true,
      handoff: { token: 'abc', tenantId: 'ten_1', state: nonce },
    })
  })

  /*
   * The tenant alone cannot tell one login from another, because every login
   * to a tenant carries the same value: which is the whole reason the nonce
   * travels as RelayState. A second login to the same tenant, started
   * elsewhere, must not be accepted here.
   */
  it('refuses a callback for a different login to the same tenant', () => {
    startLogin('ten_1', storage)
    const elsewhere = newNonce()
    expect(readHandoff(`#token=abc&tenant_id=ten_1&state=${elsewhere}`, storage)).toEqual({
      ok: false,
      reason: 'rejected',
    })
  })

  it('refuses a callback that carries no state at all', () => {
    startLogin('ten_1', storage)
    expect(readHandoff('#token=abc&tenant_id=ten_1', storage)).toEqual({
      ok: false,
      reason: 'rejected',
    })
  })

  /*
   * The attack the backend's own note describes: a token minted for one
   * tenant, planted on a browser part-way through signing in to another.
   */
  it('refuses a token for a tenant other than the one being signed in to', () => {
    const nonce = startLogin('ten_1', storage)
    expect(readHandoff(`#token=abc&tenant_id=ten_evil&state=${nonce}`, storage)).toEqual({
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

  it('spends the started login, so a replayed callback is refused', () => {
    const nonce = startLogin('ten_1', storage)
    const url = `#token=abc&tenant_id=ten_1&state=${nonce}`
    expect(readHandoff(url, storage).ok).toBe(true)
    expect(readHandoff(url, storage)).toEqual({ ok: false, reason: 'rejected' })
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
    const nonce = startLogin('ten_1', undefined)
    expect(readHandoff(`#token=abc&tenant_id=ten_1&state=${nonce}`, undefined)).toEqual({
      ok: false,
      reason: 'rejected',
    })
  })

  it('says only that it was refused, never which half was wrong', () => {
    const nonce = startLogin('ten_1', storage)
    const wrongTenant = readHandoff(`#token=abc&tenant_id=ten_evil&state=${nonce}`, storage)
    const noneStarted = readHandoff(`#token=abc&tenant_id=ten_1&state=${nonce}`, storage)
    expect(wrongTenant).toEqual(noneStarted)
  })
})
