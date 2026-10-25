import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseConfig } from '@/env'

/**
 * The browser's Supabase client, for the auth steps the Flexprice API does not
 * broker: password reset, and confirming a new account's email.
 *
 * It is never the console's session. Sign-in stays `POST /auth/login` and the
 * token stays in `SessionProvider`, so `persistSession` and `autoRefreshToken`
 * are off: supabase-js writes nothing to `localStorage` and refreshes nothing
 * in the background. `detectSessionInUrl` is on because both email links (the
 * recovery link and the sign-up confirmation) put their tokens in the URL
 * fragment, and the implicit flow is pinned because the PKCE verifier would
 * live in memory and be gone by the time the person clicks the link in another
 * tab.
 *
 * One client per project URL, because the hosted regions are separate projects.
 */
const clients = new Map<string, SupabaseClient>()

export function clientFor(config: SupabaseConfig): SupabaseClient {
  const existing = clients.get(config.url)
  if (existing) return existing

  const client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  })
  clients.set(config.url, client)
  return client
}
