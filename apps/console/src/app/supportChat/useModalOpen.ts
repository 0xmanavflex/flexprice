import { useEffect, useState } from 'react'

/**
 * An open dialog or sheet, by its ARIA role rather than the kit's internals. The
 * kit's dialogs do not set `aria-modal`, so this also matches an open popover;
 * hiding the chat launcher under one of those too does no harm.
 */
const MODAL_SELECTOR = '[role="dialog"], [role="alertdialog"]'

/** The support chat's own window is not one of the console's modals. */
const isOwnModal = (element: Element) => !element.closest('[class*="PylonChat"]')

export function isModalOpen(root: ParentNode = document): boolean {
  return Array.from(root.querySelectorAll(MODAL_SELECTOR)).some(isOwnModal)
}

/**
 * Whether a dialog or sheet is open anywhere in the console. Watched on
 * the document, because dialogs render in portals outside any one tree.
 */
export function useModalOpen(): boolean {
  const [open, setOpen] = useState(() => typeof document !== 'undefined' && isModalOpen())
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const update = () => setOpen(isModalOpen())
    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role'],
    })
    update()
    return () => observer.disconnect()
  }, [])
  return open
}
