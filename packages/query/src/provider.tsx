import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { type AuthSource, type Flexprice, createFlexpriceClient } from '@fp/api'
import { createQueryClient } from './client'

interface FlexpriceContextValue {
  client: Flexprice
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
 * refresh or an environment switch needs no remount — see `@fp/api`.
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

  const value = useMemo(() => ({ client, serverURL }), [client, serverURL])

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
