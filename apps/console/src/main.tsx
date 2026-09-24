import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { AppFailure } from '@fp/ui/compositions'
import { FlexpriceProvider } from '@fp/query'
import './styles.css'
import { router } from './app/router'
import { env } from './env'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

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
      <AppFailure
        title={env.problem.title}
        detail={env.problem.detail}
        fix={env.problem.fix}
      />
    </StrictMode>,
  )
  throw new Error(env.problem.detail)
}

createRoot(container).render(
  <StrictMode>
    <FlexpriceProvider
      serverURL={env.apiUrl}
      auth={{
        // Placeholder until the auth surface lands. The shape is the point:
        // async getters, read per request, so a refresh needs no remount.
        getToken: async () => env.devToken,
        getEnvironmentId: async () => env.environmentId,
      }}
      onUnauthorized={() => {
        window.location.href = '/sign-in'
      }}
    >
      <RouterProvider router={router} />
    </FlexpriceProvider>
  </StrictMode>,
)
