import { useEffect, useState } from 'react'

/**
 * The value, after it has stopped changing for `ms`.
 *
 * For search and filter inputs: the box updates on every keystroke, but the
 * query key: and so the request: follows only once typing pauses. Without it
 * a six-letter search is six requests, five of which are answered after they
 * stopped mattering.
 *
 * The first render returns the value as given, so a page opened with a filter
 * already set does not wait to apply it.
 */
export function useDebouncedValue<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (Object.is(debounced, value)) return
    return scheduleSettle(() => setDebounced(value), ms)
  }, [value, ms, debounced])

  return debounced
}

/**
 * The timer half of the hook, apart from React so it can be tested under node.
 * Returns the cancel function an effect hands back.
 */
export function scheduleSettle(settle: () => void, ms: number): () => void {
  if (ms <= 0) {
    settle()
    return () => undefined
  }
  const timer = setTimeout(settle, ms)
  return () => clearTimeout(timer)
}
