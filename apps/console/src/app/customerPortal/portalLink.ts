import type { ApiUrls } from '@/surfaces/publicApi'
import { SURFACE_PATH_PREFIX } from '@/surfaces/surface'

/**
 * The link to one customer's portal, as V1 builds it: this console's own
 * address, the portal path, and the session token the API just minted.
 *
 * V1 opened `<origin>/customer-portal?token=…`. Here the portal is the
 * `portal` surface of the same deployment, at `/p`: `/p/<region>?token=…`
 * when the deployment names its region and has that region's API in
 * `VITE_PUBLIC_API_URLS`, otherwise `/p?token=…`, which the portal serves
 * from the console's own API. Either way the link opens the portal this
 * deployment serves, never a guessed host.
 *
 * `portalHost`: the portal's own domain, when the deployment names one in
 * `VITE_SURFACE_HOSTS`. The customer then sees that domain (portal.flexprice.io),
 * not the console's: the console's address in a customer's link, and on the
 * page a card gateway sends them back to, read as the merchant's admin. The
 * portal host serves the portal at its root, so there is no `/p`.
 */
export function customerPortalLink(
  sessionToken: string,
  where: {
    origin: string
    region: string | null
    publicApiUrls: ApiUrls
    portalHost?: string | null
  },
): string {
  const regional =
    where.region !== null &&
    (where.publicApiUrls as Record<string, string | undefined>)[where.region]
  const prefix = where.portalHost ? '' : SURFACE_PATH_PREFIX.portal
  const path = `${prefix}${regional ? `/${where.region}` : ''}` || '/'
  const url = new URL(path, where.portalHost ? `https://${where.portalHost}` : where.origin)
  url.searchParams.set('token', sessionToken)
  return url.toString()
}
