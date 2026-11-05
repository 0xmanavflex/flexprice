/**
 * Which app this page load is: the console, or one of the public surfaces.
 *
 * One build and one deployment serve all of them. The domain decides: every
 * surface's domain points at the same project, and `main.tsx` asks this module
 * which surface the hostname belongs to *before* any router mounts, then loads
 * only that surface. A hosted invoice or the customer portal never downloads
 * the console, and the console never downloads them: each is its own chunk.
 *
 * Hosts are the primary signal. A path prefix (`/i/…`, `/p/…`) is the fallback, for
 * any host that names no surface: localhost, a `*.vercel.app` preview, or a
 * deployment where adding a domain is not possible. Everything else is the
 * console, which is also what an unconfigured deployment gets.
 *
 * Pure and total, so it is tested as a table.
 */
export type Surface = 'console' | 'invoice' | 'portal'

/** The public surfaces: everything but the console. */
export type PublicSurface = Exclude<Surface, 'console'>

export const PUBLIC_SURFACES: readonly PublicSurface[] = ['invoice', 'portal']

/**
 * The path prefix each public surface answers on when the host does not name
 * it. Short on purpose: these end up in links customers are sent.
 */
export const SURFACE_PATH_PREFIX: Record<PublicSurface, string> = {
  invoice: '/i',
  portal: '/p',
}

/** The hosts each public surface answers on. Lowercase, no scheme or port. */
export type SurfaceHosts = Record<PublicSurface, readonly string[]>

export const DEFAULT_SURFACE_HOSTS: SurfaceHosts = {
  invoice: ['invoice.flexprice.io', 'invoices.flexprice.io'],
  portal: ['portal.flexprice.io', 'billing.flexprice.io'],
}

export interface SurfaceMatch {
  surface: Surface
  /**
   * The part of the path that selected the surface, to strip before the
   * surface reads its own path: `'/i'` or `'/p'` when matched by prefix, `''` by host.
   */
  basePath: string
}

export function surfaceFor(
  location: { hostname: string; pathname: string },
  hosts: SurfaceHosts = DEFAULT_SURFACE_HOSTS,
): SurfaceMatch {
  const hostname = location.hostname.toLowerCase()
  for (const surface of PUBLIC_SURFACES) {
    if (hosts[surface].includes(hostname)) return { surface, basePath: '' }
  }
  for (const surface of PUBLIC_SURFACES) {
    const prefix = SURFACE_PATH_PREFIX[surface]
    if (location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)) {
      return { surface, basePath: prefix }
    }
  }
  return { surface: 'console', basePath: '' }
}

/** The path as the surface sees it, with the prefix that selected it removed. */
export function surfacePath(pathname: string, basePath: string): string {
  if (!basePath) return pathname
  const rest = pathname.slice(basePath.length)
  return rest.startsWith('/') ? rest : `/${rest}`
}

/**
 * `VITE_SURFACE_HOSTS`, e.g. `{"invoice":["invoice-dev.flexprice.io"]}`.
 *
 * Replaces the default list for each surface it names and keeps the rest, so
 * a staging deployment can add its own host without restating production.
 * Anything unreadable falls back to the defaults.
 */
export function parseSurfaceHosts(raw: string | undefined): SurfaceHosts {
  const value = raw?.trim()
  if (!value) return DEFAULT_SURFACE_HOSTS
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    console.warn('[flexprice] VITE_SURFACE_HOSTS is not valid JSON and is ignored.')
    return DEFAULT_SURFACE_HOSTS
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SURFACE_HOSTS

  const out: SurfaceHosts = { ...DEFAULT_SURFACE_HOSTS }
  for (const surface of PUBLIC_SURFACES) {
    const entry = (parsed as Record<string, unknown>)[surface]
    if (!Array.isArray(entry)) continue
    out[surface] = entry
      .filter((host): host is string => typeof host === 'string' && host.length > 0)
      .map((host) => host.trim().toLowerCase())
  }
  return out
}

/**
 * The portal domain this deployment names explicitly in `VITE_SURFACE_HOSTS`
 * (its first `portal` host), or null. Only an explicit entry counts: the
 * built-in defaults are production's, and a dev or preview console must not
 * send its customers' tokens there.
 */
export function configuredPortalHost(raw: string | undefined): string | null {
  try {
    const parsed = JSON.parse(raw?.trim() || 'null') as { portal?: unknown } | null
    const first = Array.isArray(parsed?.portal) ? parsed.portal[0] : undefined
    return typeof first === 'string' && first.trim() ? first.trim().toLowerCase() : null
  } catch {
    return null
  }
}
