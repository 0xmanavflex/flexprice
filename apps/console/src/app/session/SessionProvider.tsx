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

/** The credentials a signed-in console holds. */
export interface Session {
  token: string
  userId: string
  tenantId: string
}

export type SessionStatus = 'signed-out' | 'signed-in'

export interface SessionValue {
  session: Session | null
  status: SessionStatus
  signIn: (session: Session) => void
  signOut: () => void
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
 * bounce them back — a visible flash on every refresh, and a lost deep link.
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
   * comparison has a side effect — dropping the environment — and React invokes
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
    if (previous && previous.tenantId !== next.tenantId) {
      clearEnvironmentId()
      setEnvironmentIdState(null)
    }
    latest.current = next
    setSession(next)
    writeSession(next)
  }, [])

  const signOut = useCallback(() => {
    latest.current = null
    setSession(null)
    setEnvironmentIdState(null)
    clearSession()
    clearEnvironmentId()
    /*
     * The cache is the other half of signing out.
     *
     * Every session query is keyed by token, so the *next* user cannot read
     * this one's rows — but the entries are still resident, and a devtools
     * panel or a stray un-keyed query would still surface a previous user's
     * customers and invoices to whoever sits down next. Clearing is the only
     * version of "signed out" that is true of the whole tab.
     */
    queryClient.clear()
  }, [queryClient])

  const setEnvironmentId = useCallback((id: string) => {
    setEnvironmentIdState(id)
    writeEnvironmentId(id)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      session,
      status: session ? 'signed-in' : 'signed-out',
      signIn,
      signOut,
      environmentId,
      setEnvironmentId,
    }),
    [session, environmentId, signIn, signOut, setEnvironmentId],
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
 * `AuthSource` is a pair of async getters, deliberately — see the note on it in
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
