import { StrictMode } from 'react'
import type { Root } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@fp/query'
import './styles.css'
import { InvoiceSurface } from './InvoiceSurface'

/**
 * Boot the hosted invoice surface.
 *
 * Deliberately none of the console's providers: no session, no sign-in
 * redirect, no environment, no region switch. The link's token is the only
 * credential, so an expired or wrong link is a "not found" page here: never
 * a bounce to `/sign-in`, which is what an authenticated shell would do with
 * the API's 401.
 */
export function mount(root: Root, pathname: string) {
  const queryClient = createQueryClient()
  document.title = 'Invoice'
  root.render(
    <StrictMode>
      {/* No ThemeProvider: the page is light only, like the invoice PDF and the gateway's checkout. */}
      <QueryClientProvider client={queryClient}>
        <InvoiceSurface pathname={pathname} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
