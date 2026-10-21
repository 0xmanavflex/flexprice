import { ApiError, ErrorKind } from '@fp/query'

export type PageKind = 'loading' | 'invalid' | 'failed' | 'invoice'

/**
 * Which page to show. An invoice already on screen stays when a later refresh
 * fails; the error pages are only for a first load that did not succeed.
 */
export function pageKind(query: { data: unknown; error: unknown; isPending: boolean }): PageKind {
  if (query.data) return 'invoice'
  if (query.error instanceof ApiError && query.error.kind === ErrorKind.NotFound) return 'invalid'
  if (query.error) return 'failed'
  return 'loading'
}
