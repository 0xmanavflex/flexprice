import { PORTAL_RANGES, PORTAL_VIEWS, type PortalRange, type PortalView } from '@fp/domain'
import { type ApiUrls, REGION_IDS, type RegionId } from '../publicApi'

/**
 * The customer portal's address: `/<region>[/<view>][?range=…&invoice=…]`,
 * or `/[<view>]` with no region: this deployment's own portal, served by
 * the API the console itself uses (`ownApiOrigin`). The console's "Open
 * customer portal" builds that form when the deployment names no region, so
 * the link works without `VITE_PUBLIC_API_URLS`.
 *
 * The merchant mints a session (`GET /customers/portal/{external_id}`) and the
 * API answers `{ url: "<CustomerPortal.URL>?token=…" }`; each region's
 * `CustomerPortal.URL` is this surface plus its region, e.g.
 * `https://portal.flexprice.io/us`. The token stays in the query string for
 * as long as the portal is open: every address the portal moves to carries
 * it, so reload, back and a copied link all keep working, as the link the
 * merchant sent does.
 */
export interface PortalLocation {
  /** null: this deployment's own portal, on the console's own API. */
  region: RegionId | null
  apiOrigin: string
  view: PortalView
  /** null: the range the merchant's settings open Usage on. */
  range: PortalRange | null
  /** A calendar range on the Usage tab, `[start, end)` in local days; it replaces `range`. */
  customRange: { start: Date; end: Date } | null
  invoiceId: string | null
  /** The session token from the link: the portal's only credential. */
  token: string | null
}

export function parsePortalLocation(
  pathname: string,
  search: string,
  apiUrls: ApiUrls,
  ownApiOrigin: string | null = null,
): PortalLocation | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 2) return null
  const first = segments[0]
  const regional = first !== undefined && (REGION_IDS as readonly string[]).includes(first)
  // Region ids and view names never overlap, so the first segment says which form this is.
  const region = regional ? (first as RegionId) : null
  const rest = regional ? segments.slice(1) : segments
  if (rest.length > 1) return null
  const view = rest[0] ?? 'overview'
  const apiOrigin = region ? apiUrls[region] : ownApiOrigin
  if (!apiOrigin) return null
  if (!(PORTAL_VIEWS as readonly string[]).includes(view)) return null
  const params = new URLSearchParams(search)
  const range = params.get('range')
  return {
    region,
    apiOrigin,
    view: view as PortalView,
    range: PORTAL_RANGES.some((r) => r.id === range) ? (range as PortalRange) : null,
    customRange: readDays(params.get('from'), params.get('to')),
    invoiceId: params.get('invoice') || null,
    token: params.get('token')?.trim() || null,
  }
}

/** The address for a location: what `parsePortalLocation` reads back. */
export function portalHref(
  location: Omit<PortalLocation, 'apiOrigin' | 'token'> & { token?: string | null },
  basePath: string,
): string {
  const segments = [location.region, location.view === 'overview' ? null : location.view].filter(
    Boolean,
  )
  const path = `${basePath}/${segments.join('/')}`.replace(/\/$/, '') || '/'
  const params = new URLSearchParams()
  // The token first, as the merchant's link has it, and on every address.
  if (location.token) params.set('token', location.token)
  if (location.view === 'usage' && location.customRange) {
    params.set('from', dayText(location.customRange.start))
    params.set('to', dayText(new Date(location.customRange.end.getTime() - 1)))
  } else if (location.view === 'usage' && location.range !== null) {
    params.set('range', location.range)
  }
  if (location.invoiceId) params.set('invoice', location.invoiceId)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/** `YYYY-MM-DD`, in local time. */
function dayText(day: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

/** `from` and `to` (both inclusive, `YYYY-MM-DD`) as `[start, end)` local days; null when unreadable. */
function readDays(from: string | null, to: string | null): { start: Date; end: Date } | null {
  const day = (text: string | null) => {
    const match = text ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null
    if (!match) return null
    const [, y, m, d] = match.map(Number)
    const date = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const start = day(from)
  const last = day(to)
  if (!start || !last || last < start) return null
  return { start, end: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1) }
}

/** Marks the address a gateway sends the customer back to. */
export const RETURNED_PARAM = 'returned'

/**
 * Where a gateway sends the customer back: this page, without the token. The
 * token is the portal's only credential, and a gateway keeps its return
 * address. The gateway's own parameters from an earlier trip (Razorpay's `id`,
 * `state`) are dropped, so they do not pile up.
 */
export function returnUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('token')
  for (const key of [...url.searchParams.keys()])
    if (!PORTAL_PARAMS.has(key)) url.searchParams.delete(key)
  url.searchParams.set(RETURNED_PARAM, '1')
  return url.toString()
}

/** The query parameters the portal itself reads; anything else a gateway added. */
const PORTAL_PARAMS = new Set(['invoice', 'range', 'from', 'to'])

/**
 * The session a gateway's return lands back in. The return address carries no
 * token (above), and the gateway's page was opened in its own tab, which does
 * not share this tab's session storage, so the token is kept briefly in local
 * storage while the customer is away: the tab they come back to opens the
 * portal instead of a dead end. V1 did the same.
 */
const RETURN_KEY = 'flexprice.portal.return'
/** Long enough to fill in a card or a bank's check, not long enough to linger. */
const RETURN_TTL_MS = 60 * 60_000

export function rememberForReturn(token: string, now = Date.now()) {
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ token, at: now }))
  } catch {
    // Storage blocked: the returned tab asks the customer to go back instead.
  }
}

export function tokenForReturn(now = Date.now()): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(RETURN_KEY) ?? 'null') as {
      token?: unknown
      at?: unknown
    } | null
    if (typeof saved?.token !== 'string' || typeof saved.at !== 'number') return null
    if (now - saved.at > RETURN_TTL_MS) {
      localStorage.removeItem(RETURN_KEY)
      return null
    }
    return saved.token
  } catch {
    return null
  }
}
