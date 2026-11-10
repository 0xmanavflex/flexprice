import { describe, expect, it } from 'vitest'
import { passwordLinkUrl, readPasswordLinkToken } from './passwordLink'

describe('a password link', () => {
  it('carries the token in the fragment and reads it back', () => {
    const url = passwordLinkUrl('a.b+c/d=', 'https://app.example')
    expect(url).toBe('https://app.example/set-password#token=a.b%2Bc%2Fd%3D')
    expect(readPasswordLinkToken(new URL(url).hash)).toBe('a.b+c/d=')
  })

  it('reads no token from an empty or tokenless fragment', () => {
    expect(readPasswordLinkToken('')).toBeNull()
    expect(readPasswordLinkToken('#token=')).toBeNull()
    expect(readPasswordLinkToken('#other=1')).toBeNull()
  })
})
