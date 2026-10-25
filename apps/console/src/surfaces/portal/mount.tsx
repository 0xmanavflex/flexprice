import { StrictMode } from 'react'
import type { Root } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@fp/query'
import { ThemeProvider } from '@fp/ui/compositions'
import './styles.css'
import { REGION_IDS, publicApiUrls } from '../publicApi'
import { env } from '@/env'
import { PortalSurface } from './PortalSurface'

/** The API this deployment's console uses: where a region-less portal link is served. */
function ownApiOrigin(): string | null {
  try {
    return new URL(env.apiUrl).origin
  } catch {
    return null
  }
}

/**
 * Boot the customer portal surface.
 *
 * Like the hosted invoice, none of the console's providers: no session, no
 * sign-in redirect, no environment. The portal link's token is the only
 * credential, so an expired link is an "expired" page here: never a bounce
 * to `/sign-in`, which the customer has no account for. Light and dark follow
 * the customer's system.
 */
export async function mount(root: Root, pathname: string, basePath: string) {
  let apiUrls = publicApiUrls
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    // Locally, every region's portal is served by the mocks on this origin.
    const { setupWorker } = await import('msw/browser')
    const { portalHandlers } = await import('@/mocks/portalHandlers')
    await setupWorker(...portalHandlers).start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    })
    apiUrls = Object.fromEntries(
      REGION_IDS.map((id) => [id, publicApiUrls[id] ?? window.location.origin]),
    )
  }
  const queryClient = createQueryClient()
  document.title = 'Billing'
  root.render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <PortalSurface
            pathname={pathname}
            basePath={basePath}
            apiUrls={apiUrls}
            ownApiOrigin={ownApiOrigin()}
          />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}
