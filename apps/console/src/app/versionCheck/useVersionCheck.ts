import { useEffect } from 'react'
import { toast } from '@fp/ui/pages'

/**
 * Tells someone with the console open that a newer build is live, as V1's
 * `useVersionCheck` does.
 *
 * Every five minutes (and once on load) it reads `/meta.json`, which each
 * build publishes with its version (`app-version.ts`). When that differs from
 * the version this tab was built with, a toast offers **Update** (reload into
 * the new build) or **Not now** (remember this version and stay quiet about
 * it). Production builds only: a dev server has no `meta.json` to compare.
 */

export const VERSION_TOASTER_ID = 'app-version'
export const VERSION_TOAST_ID = 'version-check-notification'
/** The version someone chose "Not now" for — V1's key, so the choice carries over. */
export const LAST_DISMISSED_VERSION = 'lastDismissedVersion'
export const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000

export interface VersionCheckOptions {
  /** This tab's version; `null` turns the check off. */
  currentVersion: string | null
  enabled: boolean
  intervalMs?: number
  /** Injectable for tests. */
  reload?: () => void
}

function dismissedVersion(): string | null {
  try {
    return localStorage.getItem(LAST_DISMISSED_VERSION)
  } catch {
    return null
  }
}

function dismiss(version: string) {
  try {
    localStorage.setItem(LAST_DISMISSED_VERSION, version)
  } catch {
    /* private mode: it asks again next time, which is harmless */
  }
}

/** The live build's version, or `null` when it cannot be read. */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/meta.json?t=${Date.now()}`, { cache: 'no-cache' })
    if (!response.ok) return null
    const meta = (await response.json()) as { versionId?: unknown }
    return typeof meta.versionId === 'string' && meta.versionId ? meta.versionId : null
  } catch {
    return null
  }
}

export function useVersionCheck({
  currentVersion,
  enabled,
  intervalMs = VERSION_CHECK_INTERVAL_MS,
  reload = () => window.location.reload(),
}: VersionCheckOptions) {
  useEffect(() => {
    if (!enabled || !currentVersion) return

    let cancelled = false
    const check = async () => {
      const latest = await fetchLatestVersion()
      if (cancelled || !latest || latest === currentVersion) return
      if (dismissedVersion() === latest) return
      toast.info('New version available', {
        id: VERSION_TOAST_ID,
        toasterId: VERSION_TOASTER_ID,
        description: 'A new software version is available for download.',
        duration: Infinity,
        closeButton: true,
        cancel: { label: 'Not now', onClick: () => dismiss(latest) },
        action: { label: 'Update', onClick: () => reload() },
      })
    }

    void check()
    const timer = setInterval(() => void check(), intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled, currentVersion, intervalMs, reload])
}
