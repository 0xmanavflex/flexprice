import { Toaster } from '@fp/ui/pages'
import { env } from '@/env'
import { VERSION_TOASTER_ID, useVersionCheck } from './useVersionCheck'

/**
 * The "New version available" prompt, bottom-right on every page (V1's
 * placement). It has a toaster of its own so it shows wherever someone is,
 * not only on pages that mount one, and never stacks with a page's toasts.
 */
export function VersionCheck() {
  useVersionCheck({ currentVersion: env.appVersion, enabled: env.isProd })
  return <Toaster id={VERSION_TOASTER_ID} position="bottom-right" richColors={false} />
}
