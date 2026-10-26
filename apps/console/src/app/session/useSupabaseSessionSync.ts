import { useEffect, useRef } from 'react'
import { useSession } from './SessionProvider'
import { clientForRegion } from './supabaseSession'

/**
 * Keeps the console's session in step with Supabase's while one is signed in.
 *
 * - A refreshed token replaces the stored one. Most requests already ask
 *   `supabaseAccessToken` for theirs; the few that take the session's token
 *   directly (the environment list and its mutations) need it current too.
 * - Supabase signing the session out (the refresh token was revoked, expired,
 *   or the person signed out in another tab) ends the console's session, the
 *   same way a 401 does.
 */
export function useSupabaseSessionSync(onEnded: () => void): void {
  const { session, replaceToken } = useSession()
  const region = session?.region ?? null
  const userId = session?.userId ?? null
  // The latest callback without resubscribing whenever its identity changes.
  const ended = useRef(onEnded)
  ended.current = onEnded

  useEffect(() => {
    if (!region) return
    const client = clientForRegion(region)
    if (!client) return
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT') {
        ended.current()
        return
      }
      // Another person's session (a sign-in in another tab) is not a refresh of this one.
      if (next && (!userId || next.user.id === userId)) replaceToken(next.access_token)
    })
    return () => data.subscription.unsubscribe()
  }, [region, userId, replaceToken])
}
