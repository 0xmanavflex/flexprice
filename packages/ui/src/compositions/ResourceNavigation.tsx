import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The section strip on a detail page: Overview / Entitlements / Credit Grants…
 *
 * The line-variant treatment from the design direction — a row of labels with a
 * rule under the active one — but built as a `<nav>` of buttons with
 * `aria-current`, not a tab widget. On a detail page these switch the whole
 * content region below (usually URL-addressable, `?tab=`), which is navigation
 * between sub-views, not a `tablist` whose panels live inside it. Modelling it as
 * tabs would promise panels that are rendered by the page instead, leaving a
 * screen-reader user with tabs that control nothing.
 *
 * The page owns the selected value and what each section renders, so this is
 * presentation only: it says which sections exist and which is current, and
 * reports a click. Point it at a `?tab=` search param and the sections become
 * deep-linkable for free — see `PlanDetailPage`.
 *
 * The row scrolls horizontally rather than wrapping, so a resource with six
 * sections keeps them on one line on a phone (the responsive rule for detail
 * navigation) instead of stacking into a block that pushes the content down.
 */
export const ResourceNavigationProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Detail-page section nav in the line-tab treatment, as a <nav> with aria-current — navigation, not a tablist.',
})

export interface ResourceNavItem {
  id: string
  label: string
  /** A count beside the label — open invoices, linked charges. */
  count?: number
  /** An icon before the label. */
  icon?: ReactNode
  disabled?: boolean
}

export interface ResourceNavigationProps {
  items: ResourceNavItem[]
  /** The current section's id. */
  value: string
  onChange: (id: string) => void
  /** Names the navigation for assistive tech, e.g. "Plan sections". */
  label: string
  className?: string
}

export function ResourceNavigation({
  items,
  value,
  onChange,
  label,
  className,
}: ResourceNavigationProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        // The rule runs the full width; each active item's own underline sits on
        // top of it, so switching sections slides the mark along one line.
        'border-b',
        className,
      )}
    >
      <ul className="-mb-px flex items-center gap-5 overflow-x-auto">
        {items.map((item) => {
          const active = item.id === value
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onChange(item.id)}
                disabled={item.disabled}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // `text-muted-foreground` for the inactive label rather than a
                  // `text-foreground/60` blend: the blend computes to 4.27:1 on
                  // white and fails the contrast check, where the muted token is
                  // validated for exactly this small-secondary use across the app.
                  'relative inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 pt-1 pb-2.5 text-sm font-medium text-muted-foreground transition-colors',
                  'hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active && 'border-foreground text-foreground',
                  item.disabled && 'pointer-events-none opacity-50',
                )}
              >
                {item.icon}
                {item.label}
                {item.count !== undefined ? (
                  <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
