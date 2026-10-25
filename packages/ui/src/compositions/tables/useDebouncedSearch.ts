import { useCallback, useEffect, useRef, useState } from 'react'

/** How long typing must pause before the query is pushed to the route. */
export const SEARCH_DEBOUNCE_MS = 250

/**
 * Local input state for a search field whose real value lives in the URL.
 *
 * Typing updates `draft` immediately (so the field never lags or drops
 * characters) and pushes to the route after a pause, so each keystroke does not
 * become a history entry and a request. `commit` (Enter, blur) pushes now, and
 * `clear` empties the field and the route together.
 *
 * `value` is the route's copy. When it changes to something this hook did not
 * itself push: "Clear filters", back/forward, a saved view: the draft follows
 * it. When it merely echoes what was pushed, the draft is left alone, so a
 * slow round trip cannot overwrite what the user has typed since.
 */
export function useDebouncedSearch(
  value: string,
  onChange: (value: string) => void,
  delay: number = SEARCH_DEBOUNCE_MS,
) {
  const [draft, setDraft] = useState(value)
  const pushed = useRef(value)
  const typed = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(onChange)
  latest.current = onChange

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = undefined
  }, [])

  const push = useCallback(
    (next: string) => {
      cancel()
      pushed.current = next
      latest.current(next)
    },
    [cancel],
  )

  useEffect(() => {
    if (value === pushed.current) return
    cancel()
    pushed.current = value
    typed.current = value
    setDraft(value)
  }, [value, cancel])

  useEffect(() => cancel, [cancel])

  const update = useCallback(
    (next: string) => {
      typed.current = next
      setDraft(next)
      cancel()
      timer.current = setTimeout(() => push(next), delay)
    },
    [cancel, push, delay],
  )

  const commit = useCallback(() => {
    if (timer.current === undefined) return
    push(typed.current)
  }, [push])

  const clear = useCallback(() => {
    typed.current = ''
    setDraft('')
    push('')
  }, [push])

  return { draft, update, commit, clear }
}
