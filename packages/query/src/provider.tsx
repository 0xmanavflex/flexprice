import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { type AuthSource, type Flexprice, createFlexpriceClient } from '@fp/api'
import { createQueryClient } from './client'

interface FlexpriceContextValue {
  client: Flexprice
  /**
   * The same auth getters the SDK client was built from.
   *
   * Carried for the hooks that cannot go through the client at all: the
   * `/settings/{key}` family, `/webhooks/dashboard` and `/tenants/billing` are
   * missing from the OpenAPI document (or, for the last, present at the wrong
   * path), so `@fp/api` reaches them with `fetch`: and a bare `fetch` has no
   * `beforeRequest` hook putting the JWT and the environment on it.
   *
   * Exposing the getters rather than a token means those hooks authenticate
   * the same way every other call does, per request, with no caller holding a
   * credential and nothing to rebuild when the session changes.
   */
  auth: AuthSource
  /**
   * Carried alongside the client because the session-bootstrap routes are not
   * on it: `/auth/login`, `/users/me` and `/environments` are absent from the
   * OpenAPI document, so `@fp/api` reaches them with `fetch` and needs to be
   * told where. Reading the URL from context rather than a second env import
   * keeps one source of truth for which region the app is pointed at.
   */
  serverURL: string
}

const FlexpriceContext = createContext<FlexpriceContextValue | null>(null)

export interface FlexpriceProviderProps {
  serverURL: string
  auth: AuthSource
  onUnauthorized?: () => void
  /** Supply one in tests; the app lets the provider build it. */
  queryClient?: QueryClient
  children: ReactNode
}

/**
 * Holds the one API client and the one query client.
 *
 * The client is built from `auth` getters rather than values, so a token
 * refresh or an environment switch needs no remount: see `@fp/api`.
 */
export function FlexpriceProvider({
  serverURL,
  auth,
  onUnauthorized,
  queryClient,
  children,
}: FlexpriceProviderProps) {
  const client = useMemo(
    () =>
      createFlexpriceClient({
        serverURL,
        auth,
        ...(onUnauthorized ? { onUnauthorized } : {}),
      }),
    [serverURL, auth, onUnauthorized],
  )

  const resolvedQueryClient = useMemo(() => queryClient ?? createQueryClient(), [queryClient])

  const value = useMemo(() => ({ client, auth, serverURL }), [client, auth, serverURL])

  return (
    <QueryClientProvider client={resolvedQueryClient}>
      <FlexpriceContext.Provider value={value}>{children}</FlexpriceContext.Provider>
    </QueryClientProvider>
  )
}

function useFlexpriceContext(): FlexpriceContextValue {
  const value = useContext(FlexpriceContext)
  if (!value) {
    throw new Error('useFlexprice must be used inside <FlexpriceProvider>.')
  }
  return value
}

export function useFlexprice(): Flexprice {
  return useFlexpriceContext().client
}

/** Where this console is pointed. Only the session-bootstrap hooks need it. */
export function useFlexpriceServerURL(): string {
  return useFlexpriceContext().serverURL
}

/**
 * How to authenticate a request the SDK cannot make.
 *
 * For the `fetch`-based hooks only: see the note on `FlexpriceContextValue`.
 * A hook calls `await auth.getToken()` inside its query function, where being
 * async costs nothing, rather than taking a token as an argument: a token in a
 * hook signature is a token in a component, and eventually a token in a query
 * key or a log line.
 */
export function useFlexpriceAuth(): AuthSource {
  return useFlexpriceContext().auth
}
