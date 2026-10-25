import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * How many rows fit on screen right now.
 *
 * A fixed page size is always wrong: 25 rows leaves half a laptop screen empty
 * and overflows a short window, so the reader either scrolls inside a table
 * that is itself inside a scrolling page, or stares at whitespace. Measuring
 * instead means the last row sits just above the footer at any height.
 *
 * It measures rather than guesses, because row height is not ours to predict:
 * a two-line cell, a badge, a denser theme all change it, and a hard-coded
 * constant would silently drift the day someone adds a subtitle to a cell.
 *
 * Returns `null` until a real measurement exists. Callers must treat that as
 * "keep whatever page size you already had": returning a default would flash
 * the wrong number of rows on first paint, and in jsdom: where every height
 * is 0: it would otherwise settle on a nonsense value forever.
 */
export interface ViewportPageSizeOptions {
  /** The scrolling area the table sits in. */
  containerRef: React.RefObject<HTMLElement | null>
  /** Chrome inside the container that is not rows: a toolbar, a footer. */
  reservedHeight?: number
  /** Never propose fewer than this, however short the window. */
  minRows?: number
  enabled?: boolean
}

export function useViewportPageSize({
  containerRef,
  reservedHeight = 0,
  minRows = 5,
  enabled = true,
}: ViewportPageSizeOptions): number | null {
  const [capacity, setCapacity] = useState<number | null>(null)
  // Held in a ref as well so the measure callback can compare without being
  // re-created on every change, which would restart the observers.
  const latest = useRef<number | null>(null)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const available = container.clientHeight
    // Zero means not laid out yet: first paint, a hidden tab, or jsdom.
    // Measuring it would produce `minRows` and then never correct itself.
    if (available === 0) return

    const head = container.querySelector('thead')
    const row = container.querySelector('tbody tr')
    const rowHeight = row?.getBoundingClientRect().height ?? 0
    // Before any row exists there is nothing to divide by.
    if (rowHeight === 0) return

    const headHeight = head?.getBoundingClientRect().height ?? 0
    const rows = Math.floor((available - headHeight - reservedHeight) / rowHeight)
    const next = Math.max(minRows, rows)

    if (next !== latest.current) {
      latest.current = next
      setCapacity(next)
    }
  }, [containerRef, reservedHeight, minRows])

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    let frame = 0
    // Coalesced: a resize fires a burst, and each measurement reads layout.
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    schedule()

    const resize = new ResizeObserver(schedule)
    resize.observe(container)

    // Rows arriving, or changing height, is not a resize of the container:
    // but it does change how many fit.
    const mutation = new MutationObserver(schedule)
    mutation.observe(container, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutation.disconnect()
    }
  }, [containerRef, enabled, measure])

  return enabled ? capacity : null
}
