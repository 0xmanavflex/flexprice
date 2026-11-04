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
 * `https://portal.flexprice.io/us`. The token arrives once in the query string
 * and is moved to session storage straight away, so it is not left in the
 * address bar, the history, or a `Referer`.
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
  }
}

/** The address for a location: what `parsePortalLocation` reads back. */
export function portalHref(location: Omit<PortalLocation, 'apiOrigin'>, basePath: string): string {
  const segments = [location.region, location.view === 'overview' ? null : location.view].filter(
    Boolean,
  )
  const path = `${basePath}/${segments.join('/')}`.replace(/\/$/, '') || '/'
  const params = new URLSearchParams()
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

const storageKey = (region: RegionId | null) => `fp:portal:${region ?? 'own'}`

/**
 * The session token: from the link when it carries one (kept for this tab),
 * else the one this tab already holds. Returns the address to show with the
 * token taken out, when it was there.
 */
export function takePortalToken(
  region: RegionId | null,
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): { token: string | null; cleanSearch: string | null } {
  const params = new URLSearchParams(search)
  const fromLink = params.get('token')?.trim()
  if (fromLink) {
    try {
      storage?.setItem(storageKey(region), fromLink)
    } catch {
      // Storage blocked: the token still works for this page load.
    }
    params.delete('token')
    const rest = params.toString()
    return { token: fromLink, cleanSearch: rest ? `?${rest}` : '' }
  }
  try {
    return { token: storage?.getItem(storageKey(region)) ?? null, cleanSearch: null }
  } catch {
    return { token: null, cleanSearch: null }
  }
}
