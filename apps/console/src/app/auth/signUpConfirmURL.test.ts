import { describe, expect, it } from 'vitest'
import { SIGN_UP_CONFIRM_PATH, signUpConfirmURL } from './supabaseSignUp'

describe('signUpConfirmURL', () => {
  // Supabase only returns to allow-listed URLs and silently falls back to prod
  // otherwise. V1's path is the one on that list, so changing it breaks Google
  // sign-in and email confirmation without any error.
  it('uses the V1 path the Supabase Redirect URLs allow', () => {
    expect(SIGN_UP_CONFIRM_PATH).toBe('/auth/signup/confirmation')
  })

  it('builds the URL from the origin it is running on', () => {
    expect(signUpConfirmURL('http://localhost:3000')).toBe(
      'http://localhost:3000/auth/signup/confirmation',
    )
  })
})
