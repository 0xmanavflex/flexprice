import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  clearEnvironmentId,
  clearSession,
  readEnvironmentId,
  readSession,
  writeEnvironmentId,
  writeSession,
} from './storage'
import { resetAnalytics } from '../analytics/posthog'
import { clearListMemory } from '../listMemory'
import { setActiveEnvironmentId } from './activeEnvironment'
import { endSupabaseSession } from './supabaseSession'

/** The credentials a signed-in console holds. */
export interface Session {
  token: string
  userId: string
  tenantId: string
  /**
   * The hosted region whose Supabase session client keeps this session fresh.
   * Absent for a session with no refresh token (`POST /auth/login`, SAML).
   */
  region?: string
}

export type SessionStatus = 'signed-out' | 'signed-in'

export interface SessionValue {
  session: Session | null
  status: SessionStatus
  signIn: (session: Session) => void
  signOut: () => void
  /** The same session with a refreshed access token. */
  replaceToken: (token: string) => void
  /** The active environment id, or null until one is chosen. */
  environmentId: string | null
  setEnvironmentId: (id: string) => void
}

const SessionContext = createContext<SessionValue | null>(null)

/**
 * Who is signed in, and where they are working.
 *
 * Two pieces of state rather than one, because they are answered by two
 * different calls at two different times: `POST /auth/login` returns the token,
 * and only then can `GET /environments` say which environments that token may
 * act in. A provider that required both up front would have no state to
 * represent the moment in between, which is most of sign-in.
 *
 * Both are hydrated synchronously from `localStorage` in the initialiser rather
 * than in an effect. An effect would mean the first render is always signed
 * out, so the route guard would bounce a returning user to `/sign-in` and then
 * bounce them back: a visible flash on every refresh, and a lost deep link.
 *
 * ## Why the environment is cleared on a tenant change
 *
 * An environment id belongs to exactly one tenant. Carrying one across a
 * sign-in into a different tenant does not degrade gracefully: `X-Environment-ID`
 * naming an environment the token cannot reach makes the API answer 403 to
 * every request, so the console loads, looks signed in, and shows nothing but
 * errors. Dropping the id instead leaves `environmentId` null, which is the
 * state the environment picker already knows how to resolve.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const [session, setSession] = useState<Session | null>(() => readSession())
  const [environmentId, setEnvironmentIdState] = useState<string | null>(() => readEnvironmentId())

  /*
   * The previous session, readable without depending on it.
   *
   * `signIn` has to compare the incoming tenant against the outgoing one, and
   * has to stay referentially stable so it can be a dependency elsewhere. The
   * updater form of `setSession` would give it the previous value, but the
   * comparison has a side effect: dropping the environment: and React invokes
   * updaters twice under StrictMode. So the previous value is tracked here
   * instead, where reading it is not part of a render.
   */
  const latest = useRef(session)
  latest.current = session

  const signIn = useCallback((next: Session) => {
    // A different tenant invalidates the stored environment. Compared against
    // the previous session rather than against some remembered tenant id, so
    // a first sign-in (no previous) has nothing to clear to begin with.
    const previous = latest.current
    // Someone else signing in over a live session (a SAML or Google callback
    // in the same tab): forget the previous person before anything is
    // recorded, rather than when `/users/me` answers for the new one.
    if (previous && previous.userId !== next.userId) resetAnalytics()
    if (previous && previous.tenantId !== next.tenantId) {
      clearEnvironmentId()
      setActiveEnvironmentId(null)
      setEnvironmentIdState(null)
    }
    latest.current = next
    setSession(next)
    writeSession(next)
  }, [])

  const replaceToken = useCallback((token: string) => {
    const current = latest.current
    if (!current || current.token === token) return
    const next = { ...current, token }
    latest.current = next
    setSession(next)
    writeSession(next)
  }, [])

  const signOut = useCallback(() => {
    // Revokes the refresh token too, so a hosted session cannot be revived
    // from storage after signing out (as V1's `supabase.auth.signOut()`).
    const region = latest.current?.region
    if (region) void endSupabaseSession(region)
    // The next person on this browser is not this one (V1's `posthog.reset()`).
    resetAnalytics()
    latest.current = null
    setActiveEnvironmentId(null)
    setSession(null)
    setEnvironmentIdState(null)
    clearSession()
    clearEnvironmentId()
    // The remembered list filters are this person's view of this tenant's
    // data. They say what someone was looking for, which is not the next
    // user's business.
    clearListMemory(globalThis.sessionStorage)
    /*
     * The cache is the other half of signing out.
     *
     * Every session query is keyed by token, so the *next* user cannot read
     * this one's rows: but the entries are still resident, and a devtools
     * panel or a stray un-keyed query would still surface a previous user's
     * customers and invoices to whoever sits down next. Clearing is the only
     * version of "signed out" that is true of the whole tab.
     */
    queryClient.clear()
  }, [queryClient])

  /*
   * The previous environment id, tracked with a ref for the same reason as the
   * session above: switching environments has a side effect: dropping the old
   * environment's cached data: and that must run once per actual switch, not
   * inside a state updater React invokes twice under StrictMode.
   */
  const latestEnvironmentId = useRef(environmentId)
  latestEnvironmentId.current = environmentId

  const setEnvironmentId = useCallback(
    (id: string) => {
      const previous = latestEnvironmentId.current
      /*
       * First, and synchronously: the header and the cache key both read this,
       * and everything below must already see the new environment.
       */
      setActiveEnvironmentId(id)
      /*
       * A real switch: from one environment to a different one.
       *
       * Cached rows are keyed by environment (see `createQueryClient`), so the
       * new environment can never be served the old one's data. What remains is
       * the old environment's requests still in flight: left alone they would
       * finish, or retry, with the *new* header while filed under the *old*
       * key. They are cancelled. Everything already cached is marked stale
       * without refetching it: an unmounted old-environment page has no
       * business spending requests, and if the user switches back it is shown
       * and refreshed.
       *
       * Guarded on a real change: the initial null→id defaulting (a fresh tab
       * choosing its first environment) is not a switch.
       */
      if (previous !== null && previous !== id) {
        void queryClient.cancelQueries()
        void queryClient.invalidateQueries({ refetchType: 'none' })
        // Filters name rows: a customer, a plan, a status that exists here
        // and not there. Carried across a switch they would silently empty
        // every list in the new environment.
        clearListMemory(globalThis.sessionStorage)
      }
      latestEnvironmentId.current = id
      setEnvironmentIdState(id)
      writeEnvironmentId(id)
    },
    [queryClient],
  )

  const value = useMemo<SessionValue>(
    () => ({
      session,
      status: session ? 'signed-in' : 'signed-out',
      signIn,
      signOut,
      replaceToken,
      environmentId,
      setEnvironmentId,
    }),
    [session, environmentId, signIn, signOut, replaceToken, setEnvironmentId],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>.')
  }
  return value
}

/**
 * A live mirror of the session, for reading outside React's render cycle.
 *
 * `AuthSource` is a pair of async getters, deliberately: see the note on it in
 * `@fp/api`. They are called per request, from inside the SDK, long after the
 * render that built them. Closing over `session` would capture whatever value
 * was current when the client was constructed, so a sign-in or an environment
 * switch would need the whole `FlexpriceProvider` remounted (and every in-flight
 * query cancelled) to take effect. A ref updated on every render is what makes
 * the getters actually current, which is the entire point of their being
 * getters.
 */
export function useSessionRef(): { current: SessionValue } {
  const value = useSession()
  const ref = useRef(value)
  ref.current = value
  return ref
}
