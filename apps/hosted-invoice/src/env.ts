/**
 * Build-time configuration. The only module that reads `import.meta.env`.
 *
 * `VITE_HOSTED_INVOICE_API_URLS` maps each region in a hosted link to the
 * origin of that region's API, e.g. `{"us":"https://us.api.flexprice.io"}`.
 * There are no defaults: a region the deployment does not list has no page.
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
    console.warn('[hosted-invoice] VITE_HOSTED_INVOICE_API_URLS is not valid JSON and is ignored.')
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
      console.warn(`[hosted-invoice] VITE_HOSTED_INVOICE_API_URLS.${id} is not a URL and is ignored.`)
    }
  }
  return out
}

export const env = {
  apiUrls: parseApiUrls(import.meta.env.VITE_HOSTED_INVOICE_API_URLS as string | undefined),
}
