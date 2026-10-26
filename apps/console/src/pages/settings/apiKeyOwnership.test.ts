import { describe, expect, it } from 'vitest'
import { currentUserId, isOwnKey } from './apiKeyOwnership'

describe('currentUserId', () => {
  it('prefers /users/me, which knows a SAML user the session does not', () => {
    expect(currentUserId('user_alice', '')).toBe('user_alice')
    expect(currentUserId('user_alice', 'user_alice')).toBe('user_alice')
  })

  it('falls back to the session id until /users/me loads', () => {
    expect(currentUserId(undefined, 'user_bob')).toBe('user_bob')
  })

  it('is empty when neither knows', () => {
    expect(currentUserId(undefined, '')).toBe('')
    expect(currentUserId(undefined, undefined)).toBe('')
  })
})

describe('isOwnKey', () => {
  it('matches the key owner to the signed-in user', () => {
    expect(isOwnKey('user_alice', 'user_alice')).toBe(true)
    expect(isOwnKey('user_bob', 'user_alice')).toBe(false)
  })

  it('owns nothing while the identity is unknown, even a key with no owner', () => {
    expect(isOwnKey('', '')).toBe(false)
    expect(isOwnKey(undefined, '')).toBe(false)
  })
})
