import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/** ⌘D / Ctrl+D flips light and dark. Renders nothing. */
export function ThemeShortcut() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Autofill and some extensions dispatch keydown events with no `key`.
      if (
        (event.key as string | undefined)?.toLowerCase() !== 'd' ||
        !(event.metaKey || event.ctrlKey)
      )
        return
      if (event.altKey || event.shiftKey) return
      // Claimed over the browser's "bookmark this page".
      event.preventDefault()
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [resolvedTheme, setTheme])

  return null
}
