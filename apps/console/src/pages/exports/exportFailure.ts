import { ApiError, serverReason } from '@fp/query'

/** A failed write as an `Error` whose message the dialog can show as is. */
export function writeError(error: unknown, fallback: string): Error {
  if (error instanceof ApiError)
    return new Error(serverReason(error) ?? (error.message || fallback))
  return error instanceof Error && error.message ? error : new Error(fallback)
}
