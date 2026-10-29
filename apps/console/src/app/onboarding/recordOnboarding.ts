/**
 * Appends a completed onboarding to the team's Google Sheet, through a Google
 * Apps Script web app (`VITE_GOOGLE_SHEETS_WEB_APP_URL`). Ported from V1's
 * `OnboardingApi.recordOnboardingData`, including what V1 learned the hard way.
 *
 * **It never throws.** The sheet is telemetry: onboarding has already saved the
 * tenant when this runs, and a dead sheet must not stand between someone and
 * their dashboard. Every failure is reported instead (`console.error` and
 * PostHog's `captureError`), because a break nobody sees stays broken until
 * someone notices the sheet has stopped filling.
 */
import type { OnboardingSheetRow } from '@fp/domain'
import { captureError } from '@/app/analytics'
import { env } from '@/env'

/** V1's limit: long enough for a cold Apps Script start, short enough to give up. */
export const SHEET_TIMEOUT_MS = 10_000

/**
 * Apps Script serves its own failures as an HTTP **200** `text/html` page, not
 * an error status, so `res.ok` alone reports a dead deployment as a success.
 * These are the markers it renders. `No such user` means the account that owns
 * the deployment no longer exists: in V1 that silently stopped every row.
 */
export const APPS_SCRIPT_ERROR_MARKERS = [
  'No such user',
  'Script function not found',
  'Authorization is required',
  'Sorry, unable to open the file',
  'Sorry, unable to open the page',
  'The script completed but did not return anything',
] as const

/** The Apps Script error rendered in a response, or `null` when it looks like a real result. */
export function findAppsScriptError(body: string, contentType: string | null): string | null {
  const marker = APPS_SCRIPT_ERROR_MARKERS.find((m) => body.includes(m))
  if (marker) return marker
  // A healthy deployment answers with what its ContentService returns. An HTML
  // document titled "Error" means Google rendered a page of its own and doPost
  // never ran.
  if (contentType?.includes('text/html') && /<title>\s*Error\s*<\/title>/i.test(body)) {
    return 'Apps Script returned an error page'
  }
  return null
}

/** Leaves the email out: the failure context does not need personal data. */
function reportFailure(
  reason: string,
  row: OnboardingSheetRow,
  extra: Record<string, unknown> = {},
) {
  // Only the reason and ids: nothing the person typed, and never the sheet's
  // response, which can echo customer data back.
  const context = { reason, tenantId: row.tenantId, ...extra }
  console.error('[onboarding] Failed to record onboarding to the Google Sheet.', context)
  captureError(new Error(`Onboarding sheet recording failed: ${reason}`), context)
}

export interface RecordOnboardingDeps {
  /** Defaults to `env.googleSheetsWebAppUrl`. */
  url?: string | null
  fetch?: typeof fetch
  timeoutMs?: number
}

export async function recordOnboarding(
  row: OnboardingSheetRow,
  deps: RecordOnboardingDeps = {},
): Promise<void> {
  const url = deps.url === undefined ? env.googleSheetsWebAppUrl : deps.url
  if (!url) {
    // Under mocks the variable is ignored on purpose; anywhere else it is a missing setting.
    if (!env.useMocks) reportFailure('VITE_GOOGLE_SHEETS_WEB_APP_URL is not configured', row)
    return
  }

  const doFetch = deps.fetch ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), deps.timeoutMs ?? SHEET_TIMEOUT_MS)

  try {
    const res = await doFetch(url, {
      method: 'POST',
      // `text/plain` keeps this a "simple" request, so the browser sends no CORS
      // preflight (Apps Script does not answer OPTIONS). The script still reads
      // the raw JSON body. `application/json` would trigger the preflight.
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(row),
      signal: controller.signal,
    })
    const body = await res.text().catch(() => '')
    if (!res.ok) {
      reportFailure(`HTTP ${res.status} ${res.statusText}`, row, { status: res.status })
      return
    }
    const scriptError = findAppsScriptError(body, res.headers.get('content-type'))
    if (scriptError) reportFailure(scriptError, row, { status: res.status })
  } catch (error) {
    // A cross-origin response the browser will not let us read lands here too,
    // so the row may in fact have been written. Still reported: an unreadable
    // response means working and broken can no longer be told apart.
    const reason = controller.signal.aborted
      ? `Request timed out after ${Math.round((deps.timeoutMs ?? SHEET_TIMEOUT_MS) / 1000)}s`
      : `Request failed: ${error instanceof Error ? error.message : 'unknown error'}`
    reportFailure(reason, row)
  } finally {
    clearTimeout(timeout)
  }
}
