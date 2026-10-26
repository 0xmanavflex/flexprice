import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The session client is replaced with a fake: what is under test is what the
 * console asks Supabase and what it does with the answers, not supabase-js.
 */
const auth = vi.hoisted(() => ({
  setSession: vi.fn(),
  signInWithPassword: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
}))

vi.mock('@/env', () => ({
  env: {
    supabaseFor: (region: string) =>
      region === 'in' ? { url: 'https://in.supabase.co', anonKey: 'anon' } : null,
    authRedirectOrigin: null,
  },
}))

vi.mock('./supabaseClient', () => ({
  clientFor: () => ({ auth }),
  sessionClientFor: () => ({ auth }),
}))

import {
  ConfirmationLinkInvalid,
  EmailNotConfirmed,
  SupabaseCredentialsRefused,
  readConfirmedSession,
  signInWithSupabase,
} from './supabaseSignUp'

const supabaseSession = (tenant: string | null, token = 'access.1') => ({
  access_token: token,
  refresh_token: 'refresh.1',
  user: {
    id: 'user_1',
    email: 'someone@example.com',
    app_metadata: tenant ? { tenant_id: tenant } : {},
  },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('readConfirmedSession', () => {
  it('hands both tokens in the link to the session client, so it can refresh them', async () => {
    auth.setSession.mockResolvedValue({ data: { session: supabaseSession('ten_1') }, error: null })

    const confirmed = await readConfirmedSession(
      'in',
      '#access_token=access.1&refresh_token=refresh.1&expires_in=3600&type=signup',
    )

    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'access.1',
      refresh_token: 'refresh.1',
    })
    expect(confirmed).toEqual({
      email: 'someone@example.com',
      userId: 'user_1',
      accessToken: 'access.1',
      tenantId: 'ten_1',
    })
  })

  it('refuses a link without a refresh token rather than starting a session that cannot last', async () => {
    await expect(readConfirmedSession('in', '#access_token=access.1')).rejects.toBeInstanceOf(
      ConfirmationLinkInvalid,
    )
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('shows the reason Supabase gives for a rejected link', async () => {
    await expect(
      readConfirmedSession('in', '#error_description=Email+link+is+invalid+or+has+expired'),
    ).rejects.toThrow('Email link is invalid or has expired')
  })
})

describe('signInWithSupabase', () => {
  const create = vi.fn(async () => ({ userId: 'user_1', tenantId: 'ten_new' }))

  it('signs in an account that has a tenant, with a refreshed token and its region', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: supabaseSession('ten_1') },
      error: null,
    })
    auth.refreshSession.mockResolvedValue({
      data: { session: supabaseSession('ten_1', 'access.2') },
      error: null,
    })

    const session = await signInWithSupabase('in', ' someone@example.com ', 'pw', create)

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'someone@example.com',
      password: 'pw',
    })
    expect(session).toEqual({
      token: 'access.2',
      userId: 'user_1',
      tenantId: 'ten_1',
      region: 'in',
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('finishes a sign-up that stopped half way: creates the account, then refreshes', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: supabaseSession(null) },
      error: null,
    })
    auth.refreshSession.mockResolvedValue({
      data: { session: supabaseSession('ten_new', 'access.2') },
      error: null,
    })

    const session = await signInWithSupabase('in', 'someone@example.com', 'pw', create)

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ token: 'access.1' }))
    expect(session).toMatchObject({ token: 'access.2', tenantId: 'ten_new', region: 'in' })
  })

  it('says when only the email confirmation is missing', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email not confirmed', status: 400 },
    })
    await expect(
      signInWithSupabase('in', 'someone@example.com', 'pw', create),
    ).rejects.toBeInstanceOf(EmailNotConfirmed)
  })

  it('refuses wrong credentials without saying which part was wrong', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    })
    await expect(
      signInWithSupabase('in', 'someone@example.com', 'pw', create),
    ).rejects.toBeInstanceOf(SupabaseCredentialsRefused)
  })

  it('ends the Supabase session when the account cannot be finished', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: supabaseSession(null) },
      error: null,
    })
    const failing = vi.fn(async () => {
      throw new Error('signup failed')
    })

    await expect(signInWithSupabase('in', 'someone@example.com', 'pw', failing)).rejects.toThrow(
      'signup failed',
    )
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
