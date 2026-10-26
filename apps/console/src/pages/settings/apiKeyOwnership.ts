/**
 * Who the signed-in person is, for telling their own API keys apart.
 *
 * `/users/me` is the authority: a SAML sign-in stores no user id in the session
 * (the fragment carries none), so the session's id is only a fallback for
 * password sign-ins before `/users/me` has loaded. Empty while unknown.
 */
export function currentUserId(meId: string | undefined, sessionUserId: string | undefined): string {
  return meId || sessionUserId || ''
}

/** Whether a key belongs to the signed-in person. An unknown identity owns nothing. */
export function isOwnKey(ownerId: string | undefined, userId: string): boolean {
  return userId !== '' && ownerId === userId
}
