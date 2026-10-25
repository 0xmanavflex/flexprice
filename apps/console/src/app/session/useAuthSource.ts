import { useMemo } from 'react'
import type { FlexpriceProviderProps } from '@fp/query'
import { env } from '@/env'
import { getActiveEnvironmentId } from './activeEnvironment'
import { useSessionRef } from './SessionProvider'

/** The `AuthSource` shape, reached through `@fp/query` rather than `@fp/api`. */
type AuthSource = FlexpriceProviderProps['auth']

/**
 * How every request proves who it is.
 *
 * The two getters are async and are read per request: see the note on
 * `AuthSource` in `@fp/api`. This hook is what makes that property real on the
 * app side: it returns an object that is **built once** and never rebuilt, and
 * reads the current session out of a ref each time it is called.
 *
 * That is not a micro-optimisation. `FlexpriceProvider` memoises the SDK client
 * on `auth`, so returning a fresh object per render would rebuild the client on
 * every render; and closing over the session value would freeze the token at
 * whatever it was when the provider first mounted. Signing in would then need a
 * remount to take effect: the exact coupling the async getters exist to avoid.
 *
 * The API key, when one is configured, wins over the session token. It is a
 * development-only override that is `null` in any production build, and it is
 * the whole reason it can be honoured here without a session existing at all:
 * see `env.ts`.
 */
export function useAuthSource(): AuthSource {
  const session = useSessionRef()

  return useMemo<AuthSource>(
    () => ({
      getToken: async () => env.apiKey ?? session.current.session?.token ?? null,
      // Not `session.current.environmentId`: that ref is only refreshed by a
      // render, and a request fired between a switch and its re-render would go
      // out naming the environment the user just left.
      getEnvironmentId: async () => getActiveEnvironmentId(),
    }),
    // `session` is a ref: its identity never changes, so this builds once.
    [session],
  )
}
