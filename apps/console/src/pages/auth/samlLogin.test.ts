import { describe, expect, it, vi } from 'vitest'
import { resolveSsoTenant, startSamlLogin } from './samlLogin'
import type { MaybeStorage } from '../../app/session/samlHandoff'

function fakeStorage(): MaybeStorage {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => void entries.delete(key),
    setItem: (key: string, value: string) => void entries.set(key, value),
  }
}

const reply = (status: number) => vi.fn(async () => new Response(null, { status }))

describe('resolveSsoTenant', () => {
  it('is the tenant the link names', () => {
    expect(resolveSsoTenant('tenant_abc')).toBe('tenant_abc')
    expect(resolveSsoTenant('  tenant_abc  ')).toBe('tenant_abc')
  })

  it('is nothing when the link names none, so no button is offered', () => {
    expect(resolveSsoTenant(null)).toBeUndefined()
    expect(resolveSsoTenant(undefined)).toBeUndefined()
    expect(resolveSsoTenant('   ')).toBeUndefined()
  })
})

describe('startSamlLogin', () => {
  it('returns the login URL with a nonce, and records the login', async () => {
    const storage = fakeStorage()
    const result = await startSamlLogin('ten_1', 'https://api.test/v1', storage, reply(302))

    expect(result.ok).toBe(true)
    const url = new URL((result as { url: string }).url)
    expect(url.pathname).toBe('/v1/auth/saml/ten_1/login')
    // The nonce sent is the nonce recorded, or the callback could never agree.
    expect(url.searchParams.get('state')).toBe(storage?.getItem('fp.saml.pendingState'))
    expect(storage?.getItem('fp.saml.pendingTenant')).toBe('ten_1')
  })

  it('reports a tenant without SSO rather than navigating to a JSON error', async () => {
    const storage = fakeStorage()
    expect(await startSamlLogin('ten_1', 'https://api.test/v1', storage, reply(404))).toEqual({
      ok: false,
      reason: 'unavailable',
    })
    // Nothing was started, so a stray callback afterwards still has nothing to agree with.
    expect(storage?.getItem('fp.saml.pendingTenant')).toBeNull()
  })

  /*
   * A blocked request says nothing about whether SSO works. Refusing on it
   * would turn one CORS header into "your company cannot sign in".
   */
  it('goes ahead when the probe itself fails', async () => {
    const failing = vi.fn(async () => {
      throw new Error('CORS')
    })
    const result = await startSamlLogin('ten_1', 'https://api.test/v1', fakeStorage(), failing)
    expect(result.ok).toBe(true)
  })

  it('does not let a tenant id escape the path', async () => {
    const result = await startSamlLogin('a/b?c', 'https://api.test/v1', fakeStorage(), reply(302))
    expect((result as { url: string }).url).toContain('/auth/saml/a%2Fb%3Fc/login')
  })

  it('tolerates a trailing slash on the API base', async () => {
    const result = await startSamlLogin('ten_1', 'https://api.test/v1/', fakeStorage(), reply(302))
    expect((result as { url: string }).url).toContain('https://api.test/v1/auth/saml/ten_1/login')
  })

  it('does not follow the redirect: the probe must not consume the login', async () => {
    const fetchImpl = reply(302)
    await startSamlLogin('ten_1', 'https://api.test/v1', fakeStorage(), fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), {
      method: 'GET',
      redirect: 'manual',
    })
  })
})
