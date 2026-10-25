/**
 * Where a region lives, and which one a browser is already in.
 *
 * Pure on purpose, and separate from `region.tsx`: the provider reads
 * `import.meta.env`, which a unit test cannot load, while these two functions
 * are the part worth testing. Getting `regionOfOrigin` wrong shows a switcher
 * inviting someone to move to the region they are in; getting `regionHref`
 * wrong drops the page they were on.
 */
export type RegionId = 'in' | 'us' | 'ca'

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** The region whose canonical origin: or alias: matches where the browser is. */
export function regionOfOrigin(
  origin: string,
  urls: Record<RegionId, string>,
  aliases: Record<RegionId, string[]>,
): RegionId | null {
  for (const id of Object.keys(urls) as RegionId[]) {
    const candidates = [urls[id], ...(aliases[id] ?? [])]
    if (candidates.some((url) => safeOrigin(url) === origin)) return id
  }
  return null
}

/** Where picking `id` should send a browser currently at `path`. */
export function regionHref(
  id: RegionId,
  urls: Record<RegionId, string>,
  path: string,
  search: string,
): string {
  return `${urls[id]}${path}${search}`
}
