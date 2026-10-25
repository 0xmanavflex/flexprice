import { describe, expect, it, vi } from 'vitest'
import { completeAccount, type ConfirmedSession } from './supabaseSignUp'

const confirmed = (tenantId: string | null): ConfirmedSession => ({
  email: 'someone@example.com',
  userId: 'user_1',
  accessToken: 'token.minted.earlier',
  tenantId,
})

const neverCreates = vi.fn(async () => {
  throw new Error('should not create an account')
})

describe('completeAccount, for an account that already exists', () => {
  /*
   * The API reads the tenant from the token's `app_metadata.tenant_id` and
   * refuses with "Invalid token claims" when it is missing. The session object
   * can name a tenant the token does not, because the token was minted
   * earlier: so the token is refreshed rather than passed on as it arrived.
   */
  it('signs in with a freshly minted token, not the one the link carried', async () => {
    const refresh = vi.fn(async () => 'token.minted.now')
    const result = await completeAccount('us', confirmed('ten_1'), neverCreates, refresh)

    expect(result).toEqual({ token: 'token.minted.now', userId: 'user_1', tenantId: 'ten_1' })
    expect(neverCreates).not.toHaveBeenCalled()
  })

  it('falls back to the token in hand when the refresh fails', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('offline')
    })
    const result = await completeAccount('us', confirmed('ten_1'), neverCreates, refresh)

    // Refusing the sign-in over a failed refresh would turn a token that is
    // very likely fine into a dead button.
    expect(result.token).toBe('token.minted.earlier')
  })
})

describe('completeAccount, for a new account', () => {
  it('creates it with the link token, then signs in with a refreshed one', async () => {
    const create = vi.fn(async () => ({ userId: 'user_new', tenantId: 'ten_new' }))
    const refresh = vi.fn(async () => 'token.with.tenant')
    const result = await completeAccount('us', confirmed(null), create, refresh)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'someone@example.com', token: 'token.minted.earlier' }),
    )
    // The tenant exists only after the create, so only a later token names it.
    expect(result).toEqual({ token: 'token.with.tenant', userId: 'user_new', tenantId: 'ten_new' })
  })
})
