import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { type AuthSource, type Flexprice, createFlexpriceClient } from '@fp/api'
import { createQueryClient } from './client'

const FlexpriceContext = createContext<Flexprice | null>(null)

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

  return (
    <QueryClientProvider client={resolvedQueryClient}>
      <FlexpriceContext.Provider value={client}>{children}</FlexpriceContext.Provider>
    </QueryClientProvider>
  )
}

export function useFlexprice(): Flexprice {
  const client = useContext(FlexpriceContext)
  if (!client) {
    throw new Error('useFlexprice must be used inside <FlexpriceProvider>.')
  }
  return client
}
