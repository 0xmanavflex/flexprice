import { StrictMode, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { AppFailure, ThemeProvider } from '@fp/ui/compositions'
import { FlexpriceProvider, createQueryClient } from '@fp/query'
import './styles.css'
import { router } from './app/router'
import {
  SessionProvider,
  bypassesSignIn,
  getActiveEnvironmentId,
  useAuthSource,
  useSession,
} from './app/session'
import { env } from './env'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

/**
 * A tab left open across a deploy asks for chunks whose hashed names no longer
 * exist; the host answers with index.html and the dynamic import fails. Reload
 * to pick up the new build. The timestamp stops a loop if the chunk is truly
 * gone, while still letting a later deploy recover the same tab again.
 */
window.addEventListener('vite:preloadError', (event) => {
  const key = 'fp:chunk-reload'
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0)
    if (Date.now() - last < 30_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

/**
 * Start the mock API before rendering, when asked.
 *
 * Dynamically imported so neither MSW nor the fixture corpus reaches a
 * production bundle, and awaited so the first query cannot race the worker —
 * otherwise the opening request escapes to the network and the screen shows an
 * error that disappears on refresh.
 */
if (env.useMocks) {
  const { startMocks } = await import('./mocks/browser')
  await startMocks()
}

if (env.problem) {
  createRoot(container).render(
    <StrictMode>
      <AppFailure title={env.problem.title} detail={env.problem.detail} fix={env.problem.fix} />
    </StrictMode>,
  )
  throw new Error(env.problem.detail)
}

/**
 * One query client, built here rather than left to the provider.
 *
 * `SessionProvider` has to sit *above* `FlexpriceProvider` — the provider takes
 * the auth getters as a prop, so the session must already exist to supply them
 * — and it also has to reach a query client, because signing out clears the
 * cache. Those two requirements point in opposite directions as long as the
 * query client is created inside `FlexpriceProvider`.
 *
 * Creating it here resolves that: the same instance is handed to the outer
 * `QueryClientProvider` and to `FlexpriceProvider`. The nesting is real but
 * harmless — `useQueryClient()` finds the nearer provider, and both hold the
 * identical client, so there is exactly one cache no matter which one answers.
 */
const queryClient = createQueryClient({ getEnvironmentId: getActiveEnvironmentId })

function ConsoleApp() {
  const auth = useAuthSource()
  const { signOut } = useSession()

  /**
   * A 401 ends the session, in exactly one place.
   *
   * The token was accepted once and is not being accepted now, so it has
   * expired or been revoked; leaving it in `localStorage` means every
   * subsequent request fails the same way and the console looks broken rather
   * than signed out.
   *
   * Not under mocks or an API key: neither can produce a *real* 401, and
   * bouncing to `/sign-in` there would break the fixture flow the whole
   * end-to-end suite runs on.
   *
   * Stable by `useCallback`, because `FlexpriceProvider` memoises the SDK
   * client on this function's identity.
   */
  const onUnauthorized = useCallback(() => {
    if (bypassesSignIn()) return
    signOut()
    void router.navigate({ to: '/sign-in', search: {} as never })
  }, [signOut])

  return (
    <FlexpriceProvider
      serverURL={env.apiUrl}
      auth={auth}
      queryClient={queryClient}
      onUnauthorized={onUnauthorized}
    >
      <RouterProvider router={router} />
    </FlexpriceProvider>
  )
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ConsoleApp />
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
