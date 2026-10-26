import type { SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/env'
import { sessionClientFor } from '../auth/supabaseClient'

/**
 * A hosted session's link to the Supabase client that keeps it alive.
 *
 * On a hosted region the console signs in through Supabase, as V1 does, and
 * the session client holds the refresh token (`sessionClientFor`). These are
 * the three places the rest of the console meets it: a fresh token for each
 * request, the refreshed token written back to the session, and the end of the
 * session when Supabase can no longer refresh it.
 */

export function clientForRegion(region: string): SupabaseClient | null {
  const config = env.supabaseFor(region)
  return config ? sessionClientFor(config) : null
}

/**
 * The current access token for a hosted session, refreshed first when the
 * stored one has lapsed (`getSession` does that). Null when Supabase holds no
 * session for the region, so the caller falls back to the token it has, and a
 * dead one ends the session through the usual 401.
 */
export async function supabaseAccessToken(region: string): Promise<string | null> {
  const client = clientForRegion(region)
  if (!client) return null
  try {
    const { data } = await client.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/**
 * Ends the Supabase session on this device: its tokens are revoked and removed
 * from storage. `local`, not `global`: signing out of this tab should not sign
 * the person out everywhere else.
 */
export async function endSupabaseSession(region: string): Promise<void> {
  await clientForRegion(region)
    ?.auth.signOut({ scope: 'local' })
    .catch(() => undefined)
}
