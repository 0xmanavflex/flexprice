import { request } from './settings'

/** What `POST /users/chat/verify` returns. */
export interface SupportChatTokenWire {
  /** The HMAC of the user's email, signed with `chat_support.identity_secret`. */
  token?: string
  expires_at?: string
}

/**
 * `POST /users/chat/verify` — the identity hash a support-chat widget checks
 * the signed-in user against (Pylon's `email_hash`). Live, but absent from the
 * OpenAPI document and so from the SDK, which is why this speaks `fetch` the
 * way `settings.ts` does.
 */
export async function fetchSupportChatToken(
  serverURL: string,
  token: string,
  environmentId: string,
): Promise<SupportChatTokenWire> {
  const body = await request(serverURL, '/users/chat/verify', {
    method: 'POST',
    token,
    environmentId,
  })
  return (body ?? {}) as SupportChatTokenWire
}
