import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('signUpConfirmURL with VITE_AUTH_REDIRECT_ORIGIN', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  // Staging shares prod's Supabase, so it must send people to the V2 prod
  // origin rather than its own, or Supabase falls back to the V1 dashboard.
  it('returns to the configured origin instead of the current one', async () => {
    vi.stubEnv('VITE_AUTH_REDIRECT_ORIGIN', 'https://portal.flexprice.io/')
    const { signUpConfirmURL: fresh } = await import('./supabaseSignUp')
    expect(fresh()).toBe('https://portal.flexprice.io/auth/signup/confirmation')
  })

  it('uses the current origin when it is unset', async () => {
    vi.stubEnv('VITE_AUTH_REDIRECT_ORIGIN', '')
    vi.stubGlobal('location', { origin: 'https://staging.example.com' })
    const { signUpConfirmURL: fresh } = await import('./supabaseSignUp')
    expect(fresh()).toBe('https://staging.example.com/auth/signup/confirmation')
  })
})
