import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { FlexpriceProvider } from '@fp/query'
import '@fp/ui/styles.css'
import { router } from './app/router'
import { env } from './env'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

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
