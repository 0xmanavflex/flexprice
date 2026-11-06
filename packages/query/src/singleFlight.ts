import { useCallback, useRef } from 'react'
import type { MutateOptions, UseMutationResult } from '@tanstack/react-query'

/**
 * A no-argument mutation whose `mutate` ignores calls while one is running. A
 * queued sync has no idempotency key, so a double-click would queue the push
 * twice; `isPending` alone is read too late to stop the second click.
 */
export function useSingleFlight<TData, TError>(
  mutation: UseMutationResult<TData, TError, void>,
): UseMutationResult<TData, TError, void> {
  const running = useRef(false)
  const { mutate: run } = mutation
  const mutate = useCallback(
    (_: void, options?: MutateOptions<TData, TError, void>) => {
      if (running.current) return
      running.current = true
      run(undefined, {
        ...options,
        onSettled: (...args) => {
          running.current = false
          options?.onSettled?.(...args)
        },
      })
    },
    [run],
  )
  return { ...mutation, mutate } as UseMutationResult<TData, TError, void>
}
