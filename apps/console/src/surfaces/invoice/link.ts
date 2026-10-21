import { type ApiUrls, REGION_IDS, type RegionId } from '../publicApi'

export interface HostedInvoiceLink {
  region: RegionId
  token: string
  apiOrigin: string
}

/**
 * Reads `/<region>/<token>` from a path. One trailing slash is accepted;
 * anything else, or a region the deployment has no API for, is not a link.
 * The token is passed through untouched.
 */
export function parseHostedInvoiceLink(
  pathname: string,
  apiUrls: ApiUrls,
): HostedInvoiceLink | null {
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const segments = path.split('/')
  if (segments.length !== 3 || segments[0] !== '') return null

  const [, region, token] = segments
  if (!region || !token) return null

  // Only known regions: a plain object also answers `constructor`, `toString` and the like.
  if (!(REGION_IDS as readonly string[]).includes(region)) return null
  const apiOrigin = apiUrls[region as RegionId]
  if (!apiOrigin) return null
  return { region: region as RegionId, token, apiOrigin }
}
