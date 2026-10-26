import type { CaptureResult, PostHog, Properties } from 'posthog-js'
import { env } from '@/env'

/**
 * Product analytics: PostHog, as V1 runs it (`core/services/posthog`).
 *
 * - **Off by default.** On only with `VITE_POSTHOG_ENABLED=true` and a project
 *   key, and never under mocks: Storybook, the E2E suite and local fixture
 *   runs send nothing.
 * - **Loaded only when on.** `posthog-js` is imported dynamically, so a
 *   deployment without analytics never downloads it.
 * - **The same people as V1.** Identified by email with V1's person
 *   properties, so someone moving between the dashboards stays one person in
 *   a shared project.
 * - **Split by region.** Every event carries `region`, `app` and
 *   `app_version`; each region's deployment sets its own key and host.
 *
 * Calls made before the library has loaded are queued and replayed once it
 * has, so an identify on the first render is not lost.
 */
export interface AnalyticsConfig {
  enabled: boolean
  key: string
  host: string
  useMocks: boolean
  region: string | null
  appVersion: string | null
}

/** Who is signed in, as V1 identifies them. */
export interface AnalyticsUser {
  id: string
  email: string
  tenantId?: string | undefined
  tenantName?: string | undefined
}

const fromEnv = (): AnalyticsConfig => ({
  enabled: env.posthog.enabled,
  key: env.posthog.key,
  host: env.posthog.host,
  useMocks: env.useMocks,
  region: env.region,
  appVersion: env.appVersion,
})

/**
 * Query parameters that can carry a credential: a sign-in or reset token, an
 * OAuth code or state, a signed link. Their values never leave the browser.
 */
const SENSITIVE_PARAM = /token|code|state|secret|password|signature|session|key|auth/i

/**
 * A URL as it may be sent: no fragment (Supabase puts access and refresh
 * tokens there), sensitive query values redacted, and the token in a hosted
 * invoice path (`/i/<region>/<token>`) replaced. Anything that is not a URL is
 * returned unchanged.
 */
export function scrubUrl(value: string): string {
  const absolute = /^https?:\/\//i.test(value)
  if (!absolute && !value.startsWith('/')) return value
  let url: URL
  try {
    url = new URL(value, 'https://scrub.invalid')
  } catch {
    return value
  }
  url.hash = ''
  for (const name of [...url.searchParams.keys()]) {
    if (SENSITIVE_PARAM.test(name)) url.searchParams.set(name, 'redacted')
  }
  url.pathname = url.pathname.replace(/^(\/i\/[^/]+\/)[^/]+/, '$1redacted')
  return absolute ? url.toString() : `${url.pathname}${url.search}`
}

function scrubProperties(properties: Properties | undefined): Properties | undefined {
  if (!properties) return properties
  const out: Properties = {}
  for (const [name, value] of Object.entries(properties)) {
    out[name] = typeof value === 'string' ? scrubUrl(value) : value
  }
  return out
}

/** `before_send`: every URL-shaped property scrubbed, on every event. */
export function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event
  const scrubbed: CaptureResult = { ...event, properties: scrubProperties(event.properties) ?? {} }
  const set = scrubProperties(event.$set)
  const setOnce = scrubProperties(event.$set_once)
  if (set) scrubbed.$set = set
  if (setOnce) scrubbed.$set_once = setOnce
  return scrubbed
}

let client: PostHog | null = null
let loading: Promise<PostHog | null> | null = null
let queue: Array<(posthog: PostHog) => void> = []

export function analyticsEnabled(config: AnalyticsConfig = fromEnv()): boolean {
  return config.enabled && config.key.length > 0 && !config.useMocks
}

/** Loads and starts PostHog when it is configured; resolves to `null` when it is not. */
export function startAnalytics(config: AnalyticsConfig = fromEnv()): Promise<PostHog | null> {
  if (!analyticsEnabled(config)) return Promise.resolve(null)
  loading ??= import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(config.key, {
        api_host: config.host,
        // The console is a single-page app: count route changes as page views.
        capture_pageview: 'history_change',
        capture_pageleave: true,
        // Uncaught errors and rejections, as V1's error logging sends them.
        capture_exceptions: true,
        // Sign-in, sign-up and password-reset links carry their tokens in the
        // fragment, and the first page view can be captured before the route
        // removes it. Never send fragments (events and replays alike), and
        // scrub sensitive query values from every event.
        disable_capture_url_hashes: true,
        before_send: scrubEvent,
        // The console shows customers, invoices and payments. Clicks are
        // recorded without the clicked element's text, and recordings (which
        // follow the project's own setting, as in V1) mask every input and
        // every piece of text: they show where people go, not what they see.
        mask_all_text: true,
        session_recording: { maskAllInputs: true, maskTextSelector: '*' },
      })
      posthog.register({
        app: 'console',
        region: config.region ?? 'self-hosted',
        // Every build is stamped (`app-version.ts`); `unknown` keeps the
        // property present on one that somehow was not.
        app_version: config.appVersion ?? 'unknown',
      })
      client = posthog
      const pending = queue
      queue = []
      for (const call of pending) call(posthog)
      return posthog
    })
    .catch((error: unknown) => {
      // An ad blocker or a network failure must never break the console.
      console.warn('[flexprice] analytics could not be loaded', error)
      queue = []
      return null
    })
  return loading
}

function withClient(call: (posthog: PostHog) => void) {
  if (client) call(client)
  else if (loading) queue.push(call)
}

/** Ties this browser's events to the signed-in person (V1's `posthog.identify`). */
export function identifyUser(user: AnalyticsUser) {
  withClient((posthog) =>
    posthog.identify(user.email, {
      id: user.id,
      email: user.email,
      ...(user.tenantName ? { name: user.tenantName, tenant_name: user.tenantName } : {}),
      ...(user.tenantId ? { tenant_id: user.tenantId } : {}),
    }),
  )
}

/** Forgets the person on sign-out, so the next one on this browser starts fresh. */
export function resetAnalytics() {
  withClient((posthog) => posthog.reset())
}

/** Reports an error a boundary caught, which `capture_exceptions` cannot see. */
export function captureError(error: unknown, properties: Record<string, unknown> = {}) {
  withClient((posthog) => posthog.captureException(error, properties))
}

/** Test-only: forget the loaded client between tests. */
export function resetAnalyticsModuleForTests() {
  client = null
  loading = null
  queue = []
}
