/** Whether the page may send the customer to `url`: https, or http on localhost for local dev. */
export function isSafeNavigationUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol === 'https:') return true
  return parsed.protocol === 'http:' && parsed.hostname === 'localhost'
}
