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

/**
 * Parameters gateways add on the way back. A gateway that redirects to an address
 * saved on its connection (Moyasar's `success_url`, Paddle's `redirect_url`)
 * drops our marker, and these are then the only sign the visit is a return.
 */
const GATEWAY_RETURN_PARAMS: readonly (readonly string[])[] = [
  ['razorpay_payment_id'],
  ['razorpay_payment_link_id'],
  ['session_id'],
  ['_ptxn'],
  ['id', 'status'],
]

/** True when this visit is a gateway sending the customer back. */
export function isGatewayReturn(search: string): boolean {
  const params = new URLSearchParams(search)
  if (params.has(RETURNED_PARAM)) return true
  return GATEWAY_RETURN_PARAMS.some((names) => names.every((name) => params.has(name)))
}

/**
 * Outcomes a gateway writes into the return address when the payment did not go
 * through: Moyasar's `status`, Razorpay's payment-link status. Stripe and Paddle
 * say nothing here (their result arrives by webhook), so their returns read as
 * neither, and only a stated failure counts.
 */
const GATEWAY_FAILED_STATUS: readonly (readonly [string, readonly string[]])[] = [
  ['status', ['failed', 'cancelled', 'canceled', 'expired', 'voided']],
  ['razorpay_payment_link_status', ['cancelled', 'expired', 'failed']],
]

/** True when the gateway's own return parameters say the payment failed or was abandoned. */
export function gatewayReturnFailed(search: string): boolean {
  const params = new URLSearchParams(search)
  return GATEWAY_FAILED_STATUS.some(([name, failed]) =>
    failed.includes((params.get(name) ?? '').toLowerCase()),
  )
}

/**
 * Outcomes a gateway writes into the return address when the payment went
 * through: Moyasar's `status`, Razorpay's payment-link status. Stripe, Paddle and
 * our own `returned` marker say nothing, so a return from them is not a success:
 * the customer may have left checkout without paying.
 */
const GATEWAY_PAID_STATUS: readonly (readonly [string, readonly string[]])[] = [
  ['status', ['paid', 'captured']],
  ['razorpay_payment_link_status', ['paid']],
]

/** True only when the gateway's own return parameters say the payment went through. */
export function gatewayReturnPaid(search: string): boolean {
  const params = new URLSearchParams(search)
  return GATEWAY_PAID_STATUS.some(([name, paid]) =>
    paid.includes((params.get(name) ?? '').toLowerCase()),
  )
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
  try {
    // This tab's own token, which another tab's checkout cannot overwrite.
    sessionStorage.setItem(TAB_TOKEN_KEY, token)
  } catch {
    // Blocked storage: a same-tab return without our marker shows the notice instead.
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

/** Set in a tab that sends itself to a gateway; that same tab finds it on return. */
const LEFT_FOR_GATEWAY_KEY = 'flexprice.portal.leftForGateway'
/** The token of the session this tab left with, kept in the tab's own storage. */
const TAB_TOKEN_KEY = 'flexprice.portal.tabToken'

/**
 * Note that this tab is going to a gateway and will come back. Session storage
 * belongs to the tab and survives its round trip, so on return the portal knows
 * it is this tab's own session to restore even when the gateway dropped our
 * `returned` marker (a redirect address saved on the gateway's connection). It
 * starts empty in any other tab, so a bare visit never picks up a kept session.
 */
export function markLeavingForGateway() {
  try {
    sessionStorage.setItem(LEFT_FOR_GATEWAY_KEY, '1')
  } catch {
    // Blocked storage: the return still restores the session when the marker survives.
  }
}

/** Read once per page load, so a second read (React's strict-mode re-run) agrees. */
let leftForGateway: { token: string | null } | null = null

/**
 * When this page load is the tab that left for a gateway coming back: the token
 * it left with, from its own session storage. Never the origin-wide slot, which
 * another customer's checkout in another tab may have overwritten. Clears both.
 */
export function consumeLeftForGateway(): string | null {
  if (leftForGateway !== null) return leftForGateway.token
  let token: string | null = null
  try {
    if (sessionStorage.getItem(LEFT_FOR_GATEWAY_KEY) !== null)
      token = sessionStorage.getItem(TAB_TOKEN_KEY)?.trim() || null
    sessionStorage.removeItem(LEFT_FOR_GATEWAY_KEY)
    sessionStorage.removeItem(TAB_TOKEN_KEY)
  } catch {
    token = null
  }
  leftForGateway = { token }
  return token
}
