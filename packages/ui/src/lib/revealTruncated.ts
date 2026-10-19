import type { MouseEvent } from 'react'

/**
 * Shows the full text of whatever is cut off under the pointer.
 *
 * Table cells truncate with an ellipsis so rows stay one line. Attached once
 * to a table (`onMouseOver`), this walks from the hovered element up to its
 * cell and, for any element whose text overflows, sets `title` to that text,
 * so the browser's tooltip shows it whole. Text that fits gets no tooltip, and
 * a title the markup set on purpose is never replaced.
 */
export function revealTruncated(event: MouseEvent<HTMLElement>): void {
  let element = event.target instanceof HTMLElement ? event.target : null
  const boundary = event.currentTarget
  while (element && element !== boundary) {
    const auto = element.dataset['autoTitle'] === 'true'
    if (!element.hasAttribute('title') || auto) {
      const overflowing = element.scrollWidth > element.clientWidth + 1
      const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (overflowing && text) {
        element.title = text
        element.dataset['autoTitle'] = 'true'
      } else if (auto) {
        // It fits again (a wider window): drop the tooltip it no longer needs.
        element.removeAttribute('title')
        delete element.dataset['autoTitle']
      }
    }
    if (element.tagName === 'TD' || element.tagName === 'TH') break
    element = element.parentElement
  }
}
