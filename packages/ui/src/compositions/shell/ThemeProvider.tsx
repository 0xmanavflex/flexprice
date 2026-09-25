import type { ReactNode } from 'react'
import { ThemeProvider as NextThemeProvider } from 'next-themes'
import { provenance } from '@ui/provenance'

/**
 * Theming, wrapped so the app never names the library.
 *
 * `next-themes` is a dependency of this package because the vendored blocks
 * use it. Re-exporting it here keeps it that way: an app mounts `ThemeProvider`
 * and reads nothing about how it works, so swapping the implementation is a
 * change in one file rather than in every entry point.
 *
 * The defaults are not negotiable per app and so are not props. `class`,
 * because our dark tokens live under a `.dark` selector. `system`, so someone
 * who has never opened the toggle gets what their OS asked for. And
 * transitions suppressed on change, because otherwise every colour on screen
 * animates at once and it reads as a fault rather than a preference.
 */
export const ThemeProviderProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'next-themes with our defaults fixed, so apps do not restate them.',
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  )
}
