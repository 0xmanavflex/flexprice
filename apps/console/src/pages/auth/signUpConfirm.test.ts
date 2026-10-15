import { describe, expect, it } from 'vitest'
import { ApiError, ErrorKind } from '@fp/query'
import { ConfirmationLinkInvalid } from '../../app/auth/signUpErrors'
import { messageForConfirmError } from './signUpConfirmMessage'

describe('messageForConfirmError', () => {
  it('explains a stale link and the two ways on', () => {
    expect(messageForConfirmError(new ConfirmationLinkInvalid())).toMatch(/expired.*sign up again/i)
  })

  it('ends a Supabase reason with a full stop', () => {
    expect(
      messageForConfirmError(new ConfirmationLinkInvalid('Email link is invalid or has expired')),
    ).toMatch(/^Email link is invalid or has expired\. Sign in/)
  })

  it('sends an existing account to sign in', () => {
    expect(
      messageForConfirmError(new ApiError(ErrorKind.Invalid, 'exists', { status: 409 })),
    ).toMatch(/already exists/)
  })

  it('reads a refused token as an unconfirmed email', () => {
    expect(
      messageForConfirmError(new ApiError(ErrorKind.Forbidden, 'Forbidden', { status: 403 })),
    ).toMatch(/not confirmed/)
  })
})
