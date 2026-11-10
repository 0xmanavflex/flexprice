import { ApiError, ErrorKind } from './errors'
import { request } from './session'

/**
 * One-time password links: how a self-hosted deployment (Flexprice's own
 * identity provider, no Supabase) lets a member set a password nobody else
 * ever sees. The API side is flexprice#3123.
 *
 *   - An admin asks for a link for a member (`POST /users/{id}/password-link`)
 *     and shares it. `reset` when the member already has a password (24 hours),
 *     `invite` when they never set one (7 days).
 *   - An invite on self-hosted answers with an `invite_token` instead of a
 *     generated password (`POST /users`).
 *   - The member opens the link; the page asks what it is for
 *     (`POST /auth/password/check`) and sets the password with it
 *     (`POST /auth/password`). Setting a password spends every older link,
 *     because the signature covers the current password hash.
 *   - A signed-in member changes their own password (`PUT /users/me/password`),
 *     with the new password only.
 *
 * None of these are in the OpenAPI document (they are dashboard-only), so the
 * SDK has no methods for them, and its `CreateUserResponse` schema drops
 * `invite_token`. That is why they speak `fetch` here.
 */

export type PasswordLinkPurpose = 'invite' | 'reset'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

function toPurpose(value: unknown): PasswordLinkPurpose {
  // An unknown purpose is the API ahead of this client. `reset` is the
  // conservative reading: it promises nothing about joining anything.
  return value === 'invite' ? 'invite' : 'reset'
}

export interface PasswordLink {
  token: string
  purpose: PasswordLinkPurpose
  /** ISO time the link stops working; empty when the API sent none. */
  expiresAt: string
}

export function toPasswordLink(body: unknown): PasswordLink {
  if (!isRecord(body) || !text(body, 'token')) {
    throw new ApiError(ErrorKind.Unknown, 'Flexprice returned no password link.')
  }
  return {
    token: text(body, 'token'),
    purpose: toPurpose(body['purpose']),
    expiresAt: text(body, 'expires_at'),
  }
}

/** `POST /users/{id}/password-link`: super admin only, never a service account. */
export async function createPasswordLink(
  serverURL: string,
  token: string,
  userId: string,
): Promise<PasswordLink> {
  const body = await request(serverURL, `/users/${encodeURIComponent(userId)}/password-link`, {
    method: 'POST',
    token,
  })
  return toPasswordLink(body)
}

/** `PUT /users/me/password`: the signed-in member's own password, no current one asked. */
export async function changeOwnPassword(
  serverURL: string,
  token: string,
  password: string,
): Promise<void> {
  await request(serverURL, '/users/me/password', { method: 'PUT', token, body: { password } })
}

export interface PasswordLinkDetails {
  purpose: PasswordLinkPurpose
  /** Whose password the link sets. */
  email: string
}

/** `POST /auth/password/check`: public. A spent, expired or forged link answers 404. */
export async function checkPasswordLink(
  serverURL: string,
  linkToken: string,
): Promise<PasswordLinkDetails> {
  const body = await request(serverURL, '/auth/password/check', {
    method: 'POST',
    body: { token: linkToken },
  })
  const record = isRecord(body) ? body : {}
  return { purpose: toPurpose(record['purpose']), email: text(record, 'email') }
}

/** `POST /auth/password`: public. Answers 204; the link is spent afterwards. */
export async function setPasswordWithLink(
  serverURL: string,
  linkToken: string,
  password: string,
): Promise<void> {
  await request(serverURL, '/auth/password', {
    method: 'POST',
    body: { token: linkToken, password },
  })
}

/** What `POST /users` answers for a person, read without the SDK's schema. */
export interface InviteResult {
  /** The raw user record, for the caller's own mapping. */
  user: Record<string, unknown>
  /** Hosted (Supabase): a one-time password to share. Empty on self-hosted. */
  password: string
  /** Self-hosted: the invite link's token. Absent on hosted. */
  inviteLink: PasswordLink | null
}

export function toInviteResult(body: unknown): InviteResult {
  const record = isRecord(body) ? body : {}
  const inviteToken = text(record, 'invite_token')
  return {
    user: record,
    password: text(record, 'password'),
    inviteLink: inviteToken
      ? { token: inviteToken, purpose: 'invite', expiresAt: text(record, 'invite_expires_at') }
      : null,
  }
}

/** `POST /users` for a person. */
export async function inviteUser(
  serverURL: string,
  token: string,
  environmentId: string | null,
  payload: Record<string, unknown>,
): Promise<InviteResult> {
  const body = await request(serverURL, '/users', {
    method: 'POST',
    token,
    body: payload,
    ...(environmentId ? { environmentId } : {}),
  })
  return toInviteResult(body)
}
