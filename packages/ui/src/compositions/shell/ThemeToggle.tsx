import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from '@ui/icons'
import { useTheme } from 'next-themes'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'

/**
 * Light and dark, as one button.
 *
 * Two states, not three. `next-themes` also offers `system`, and a three-way
 * control has to be a menu: which is a lot of chrome for a preference most
 * people set once. `system` is still the *initial* value, so someone who has
 * never touched this gets what their OS asked for; pressing it just pins the
 * one they are looking at.
 *
 * `aria-pressed` rather than a label that changes: the control is "dark mode",
 * and whether it is on is state, not a different control.
 */
export const ThemeToggleProvenance = provenance({
  source: 'composition',
  composes: ['ui/button'],
  note: 'next-themes in one button. Two states; system remains the initial value.',
})

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  /*
   * Nothing is known about the theme until the client has run. Rendering the
   * moon on the server and the sun on hydration is a visible flip on every
   * load, so the icon is held back for one paint and the button keeps its
   * size meanwhile.
   */
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Dark mode"
      aria-pressed={mounted ? isDark : undefined}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="text-muted-foreground hover:text-foreground"
    >
      {mounted ? (
        isDark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />
      ) : (
        <span aria-hidden className="size-4" />
      )}
    </Button>
  )
}
