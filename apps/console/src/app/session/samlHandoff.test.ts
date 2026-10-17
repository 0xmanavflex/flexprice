import { beforeEach, describe, expect, it } from 'vitest'
import { parseFragment, readHandoff, rememberTenant, takeTenant } from './samlHandoff'

beforeEach(() => {
  globalThis.sessionStorage.clear()
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
    rememberTenant('ten_1')
    expect(takeTenant()).toBe('ten_1')
    expect(takeTenant()).toBeNull()
  })
})

describe('readHandoff', () => {
  it('accepts a callback that answers the login this browser started', () => {
    rememberTenant('ten_1')
    expect(readHandoff('#token=abc&tenant_id=ten_1')).toEqual({
      ok: true,
      handoff: { token: 'abc', tenantId: 'ten_1' },
    })
  })

  /*
   * The attack the backend's own note describes: a token minted for one
   * tenant, planted on a browser part-way through signing in to another.
   */
  it('refuses a token for a tenant other than the one being signed in to', () => {
    rememberTenant('ten_1')
    expect(readHandoff('#token=abc&tenant_id=ten_evil')).toEqual({
      ok: false,
      reason: 'rejected',
    })
  })

  it('refuses a callback this browser never started, rather than trusting it', () => {
    expect(readHandoff('#token=abc&tenant_id=ten_1')).toEqual({ ok: false, reason: 'rejected' })
  })

  it('spends the remembered tenant, so a replayed callback is refused', () => {
    rememberTenant('ten_1')
    expect(readHandoff('#token=abc&tenant_id=ten_1').ok).toBe(true)
    expect(readHandoff('#token=abc&tenant_id=ten_1')).toEqual({ ok: false, reason: 'rejected' })
  })

  it('says only that it was refused, never which half was wrong', () => {
    rememberTenant('ten_1')
    const wrongTenant = readHandoff('#token=abc&tenant_id=ten_evil')
    const noneStarted = readHandoff('#token=abc&tenant_id=ten_1')
    expect(wrongTenant).toEqual(noneStarted)
  })
})
