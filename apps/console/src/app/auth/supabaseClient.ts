import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseConfig } from '@/env'

/**
 * The browser's Supabase client, for the auth steps around a session rather
 * than the session itself: password reset, sending the sign-up email, and
 * starting Google sign-in.
 *
 * It is never the console's session (that is {@link sessionClientFor}), so
 * `persistSession` and `autoRefreshToken` are off: supabase-js writes nothing
 * to `localStorage` and refreshes nothing in the background. `detectSessionInUrl` is on because the
 * recovery link puts its tokens in the URL fragment (the sign-up confirmation
 * does too, but that one is read by the session client), and the implicit flow
 * is pinned because the PKCE verifier would live in memory and be gone by the
 * time the person clicks the link in another tab.
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

/**
 * The console's own session on a hosted region, as V1 keeps it.
 *
 * Unlike {@link clientFor}, this one is the session: it persists the access and
 * refresh tokens (under its own `storageKey`, so the two clients never share a
 * session) and refreshes the access token before it expires. Every request
 * reads its token through `getSession()`, which refreshes first when the stored
 * one has lapsed, so a hosted session lasts as long as Supabase's refresh token
 * rather than one access token. `detectSessionInUrl` is off: the confirmation
 * page hands this client the fragment's tokens itself, so the link's session is
 * read once and only here.
 *
 * Self-hosted builds have no Supabase and never create one; they keep the
 * token `POST /auth/login` returns.
 */
const sessionClients = new Map<string, SupabaseClient>()

export function sessionClientFor(config: SupabaseConfig): SupabaseClient {
  const existing = sessionClients.get(config.url)
  if (existing) return existing

  const client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: `flexprice.supabase.${new URL(config.url).host}`,
    },
  })
  sessionClients.set(config.url, client)
  return client
}
