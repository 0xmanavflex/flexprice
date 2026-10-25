import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/**
 * Starts the mock API, and refuses quietly if it was not asked for.
 *
 * `onUnhandledRequest: 'warn'` on purpose: a request the corpus does not cover
 * should be visible in the console rather than silently failing or silently
 * hitting a real backend. That warning is how an uncovered endpoint gets found.
 */
export async function startMocks(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'warn',
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  console.info('[mocks] serving the captured corpus: no requests reach a real backend')
}
