import { PORTAL_RANGES, PORTAL_VIEWS, type PortalRange, type PortalView } from '@fp/domain'
import { type ApiUrls, REGION_IDS, type RegionId } from '../publicApi'

/**
 * The customer portal's address: `/<region>[/<view>][?range=…&invoice=…]`.
 *
 * The merchant mints a session (`GET /customers/portal/{external_id}`) and the
 * API answers `{ url: "<CustomerPortal.URL>?token=…" }`; each region's
 * `CustomerPortal.URL` is this surface plus its region, e.g.
 * `https://portal.flexprice.io/us`. The token arrives once in the query string
 * and is moved to session storage straight away, so it is not left in the
 * address bar, the history, or a `Referer`.
 */
export interface PortalLocation {
  region: RegionId
  apiOrigin: string
  view: PortalView
  range: PortalRange
  invoiceId: string | null
}

const DEFAULT_RANGE: PortalRange = '30d'

export function parsePortalLocation(
  pathname: string,
  search: string,
  apiUrls: ApiUrls,
): PortalLocation | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 1 || segments.length > 2) return null
  const [region, view = 'overview'] = segments
  if (!region || !(REGION_IDS as readonly string[]).includes(region)) return null
  const apiOrigin = apiUrls[region as RegionId]
  if (!apiOrigin) return null
  if (!(PORTAL_VIEWS as readonly string[]).includes(view)) return null
  const params = new URLSearchParams(search)
  const range = params.get('range')
  return {
    region: region as RegionId,
    apiOrigin,
    view: view as PortalView,
    range: PORTAL_RANGES.some((r) => r.id === range) ? (range as PortalRange) : DEFAULT_RANGE,
    invoiceId: params.get('invoice') || null,
  }
}

/** The address for a location: what `parsePortalLocation` reads back. */
export function portalHref(location: Omit<PortalLocation, 'apiOrigin'>, basePath: string): string {
  const path = `${basePath}/${location.region}${location.view === 'overview' ? '' : `/${location.view}`}`
  const params = new URLSearchParams()
  if (location.view === 'usage' && location.range !== DEFAULT_RANGE)
    params.set('range', location.range)
  if (location.invoiceId) params.set('invoice', location.invoiceId)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

const storageKey = (region: RegionId) => `fp:portal:${region}`

/**
 * The session token: from the link when it carries one (kept for this tab),
 * else the one this tab already holds. Returns the address to show with the
 * token taken out, when it was there.
 */
export function takePortalToken(
  region: RegionId,
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
