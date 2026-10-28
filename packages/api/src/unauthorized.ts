/**
 * Where a 401 from a raw `fetch` route is reported.
 *
 * The SDK client reports its own 401s through its response hook; the raw
 * routes (`request()` in `settings.ts`) bypass that hook, so
 * `createFlexpriceClient` registers its notifier here and `request()` calls it.
 */
let handler: ((credential: string) => void) | undefined

export function setRawUnauthorizedHandler(next: ((credential: string) => void) | undefined): void {
  handler = next
}

export function reportRawUnauthorized(credential: string): void {
  handler?.(credential)
}
