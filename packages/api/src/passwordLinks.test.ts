import { describe, expect, it } from 'vitest'
import { toInviteResult, toPasswordLink } from './passwordLinks'

describe('toPasswordLink', () => {
  it('reads the token, purpose and expiry', () => {
    expect(
      toPasswordLink({ token: 't', purpose: 'invite', expires_at: '2026-11-17T10:00:00Z' }),
    ).toEqual({ token: 't', purpose: 'invite', expiresAt: '2026-11-17T10:00:00Z' })
  })

  it('reads an unknown purpose as a reset, and refuses a body with no token', () => {
    expect(toPasswordLink({ token: 't', purpose: 'other' }).purpose).toBe('reset')
    expect(() => toPasswordLink({ purpose: 'reset' })).toThrow()
  })
})

describe('toInviteResult', () => {
  it('keeps the self-hosted invite token the SDK would strip', () => {
    const result = toInviteResult({
      id: 'u1',
      email: 'a@b.example',
      invite_token: 'tok',
      invite_expires_at: '2026-11-17T10:00:00Z',
    })
    expect(result.password).toBe('')
    expect(result.inviteLink).toEqual({
      token: 'tok',
      purpose: 'invite',
      expiresAt: '2026-11-17T10:00:00Z',
    })
    expect(result.user['id']).toBe('u1')
  })

  it('reads a hosted invite as a one-time password and no link', () => {
    const result = toInviteResult({ id: 'u1', password: 'Tmp-1!' })
    expect(result.password).toBe('Tmp-1!')
    expect(result.inviteLink).toBeNull()
  })
})
