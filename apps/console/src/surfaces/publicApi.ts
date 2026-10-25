/**
 * Where the public surfaces send their requests: one API origin per region.
 *
 * The console talks to the one API its deployment was built for
 * (`VITE_FLEXPRICE_API_URL`). A public page cannot: a hosted invoice link
 * (`/us/<token>`) and a customer portal link (`/us?token=…`) name their region
 * in the URL, and one deployment serves every
 * region's links. So the browser picks the API itself, from this map: there
 * is no edge router in front choosing a build per region.
 *
 * `VITE_PUBLIC_API_URLS` maps each region to that region's API origin, e.g.
 * `{"us":"https://us.api.flexprice.io","in":"https://api.cloud.flexprice.io"}`.
 * There are no defaults: a region the deployment does not list has no page,
 * rather than a request sent to a guessed host.
 *
 * These routes are public (`/public/v1`, a token in the link instead of a
 * session) and are called with plain `fetch` from `@fp/api`, never the SDK:
 * the SDK is generated for the authenticated API and will not carry them.
 */
export type RegionId = 'in' | 'us' | 'ca' | 'staging'

export const REGION_IDS: readonly RegionId[] = ['in', 'us', 'ca', 'staging']

export type ApiUrls = Partial<Record<RegionId, string>>

export function parseApiUrls(raw: string | undefined): ApiUrls {
  const value = raw?.trim()
  if (!value) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    console.warn('[flexprice] VITE_PUBLIC_API_URLS is not valid JSON and is ignored.')
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null) return {}

  const out: ApiUrls = {}
  for (const id of REGION_IDS) {
    const entry = (parsed as Record<string, unknown>)[id]
    if (typeof entry !== 'string' || entry.length === 0) continue
    try {
      out[id] = new URL(entry).origin
    } catch {
      console.warn(`[flexprice] VITE_PUBLIC_API_URLS.${id} is not a URL and is ignored.`)
    }
  }
  return out
}

export const publicApiUrls: ApiUrls = parseApiUrls(
  import.meta.env.VITE_PUBLIC_API_URLS as string | undefined,
)
