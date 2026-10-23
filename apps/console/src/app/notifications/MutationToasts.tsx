import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, ErrorKind, isAccountLockedError } from '@fp/query'
import { toast, Toaster } from '@fp/ui/pages'

/** What a mutation asks to be told about: `meta: { notify: { success, error } }`. */
interface Notify {
  success?: string
  error?: string
}

function notifyOf(meta: Record<string, unknown> | undefined): Notify | null {
  const notify = meta?.['notify']
  return notify && typeof notify === 'object' ? (notify as Notify) : null
}

/**
 * The API's own reason, in a sentence someone can act on. Transport failures
 * and missing permissions get a plain explanation; anything else is the
 * server's message, which names the field it refused.
 */
export function failureMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.kind === ErrorKind.Network || error.kind === ErrorKind.Timeout) {
      return 'Could not reach Flexprice. Check your connection and try again.'
    }
    if (error.kind === ErrorKind.Forbidden && !error.message) {
      return 'You do not have permission to do that here.'
    }
    if (error.message) return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/**
 * The console's one toaster, bottom right, and the toasts every create raises.
 *
 * A mutation opts in with `meta.notify`: when it succeeds the `success` line
 * shows ("Contract created"); when the API refuses it, the API's reason shows,
 * under the `error` line. Client-side validation is not a toast — it stays in
 * the form, at the field and in the summary at the top. A locked account's
 * refusal is left to its own dialog (`AccountLock`).
 */
export function MutationToasts() {
  const queryClient = useQueryClient()

  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type !== 'updated') return
        const { mutation } = event
        // One toast per outcome: only the update that moves the status.
        if (event.action.type !== 'success' && event.action.type !== 'error') return
        const notify = notifyOf(mutation.options.meta)
        if (!notify) return
        if (mutation.state.status === 'success' && notify.success) {
          toast.success(notify.success)
        }
        if (mutation.state.status === 'error' && !isAccountLockedError(mutation.state.error)) {
          const fallback = notify.error ?? 'That did not work. Try again.'
          const reason = failureMessage(mutation.state.error, fallback)
          toast.error(notify.error ?? reason, {
            ...(notify.error && reason !== notify.error ? { description: reason } : {}),
          })
        }
      }),
    [queryClient],
  )

  return <Toaster position="bottom-right" richColors closeButton />
}
