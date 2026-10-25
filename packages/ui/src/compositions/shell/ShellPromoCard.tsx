import { useState } from 'react'
import { XIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A small promo / announcement card for the foot of the sidebar.
 *
 * The shape ReUI's app-shell blocks use: an illustration, a title, a line of
 * copy and a call to action, pinned above the account. It lives in the sidebar's
 * `pinned` slot, which the rail hides when collapsed: a promo has no business
 * competing with navigation in a 64px column.
 *
 * Dismissible, and the dismissal sticks: with a `dismissKey` the card writes to
 * `localStorage` so it does not come back on the next load. The read is guarded
 * (private-mode browsers throw), and the card simply shows if the read fails:
 * a promo you cannot hide is a nuisance; a promo that vanishes is not a bug.
 */
export const ShellPromoCardProvenance = provenance({
  source: 'composition',
  composes: ['ui/button'],
  note: 'Sidebar promo card, in the app-shell block shape; dismissal persists to localStorage.',
})

export interface ShellPromoCardProps {
  title: string
  description: string
  /** The action the card exists to prompt. */
  cta?: { label: string; onClick: () => void }
  /**
   * A `localStorage` key under which a dismissal is remembered across loads.
   * Omit it and the card is still dismissible, just for the session.
   */
  dismissKey?: string
  className?: string
}

export function ShellPromoCard({ title, description, cta, dismissKey, className }: ShellPromoCardProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissKey) return false
    try {
      return localStorage.getItem(dismissKey) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    if (!dismissKey) return
    try {
      localStorage.setItem(dismissKey, '1')
    } catch {
      /* private-mode browser: it stays dismissed for this session at least */
    }
  }

  return (
    <section
      aria-label={title}
      className={cn('bg-card text-card-foreground relative overflow-hidden rounded-xl border p-3', className)}
    >
      {/* Always dismissible; a `dismissKey` only decides whether the dismissal
          is remembered across loads. */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute end-1 top-1 z-10 opacity-50 hover:opacity-100"
      >
        <XIcon aria-hidden />
      </Button>

      {/* A brand-tinted illustration, drawn rather than shipped as an asset. */}
      <div
        aria-hidden
        className="from-primary/25 via-primary/10 mb-2.5 h-16 w-full rounded-lg bg-gradient-to-br to-transparent"
      />

      <p className="pe-5 text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>

      {cta ? (
        <Button type="button" variant="outline" size="sm" onClick={cta.onClick} className="mt-2.5 w-full">
          {cta.label}
        </Button>
      ) : null}
    </section>
  )
}
