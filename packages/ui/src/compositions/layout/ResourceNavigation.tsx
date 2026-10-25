import type { ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The section strip on a detail page: Overview / Entitlements / Credit Grants…
 *
 * The line-variant treatment from the design direction: a row of labels with a
 * rule under the active one: but built as a `<nav>` of buttons with
 * `aria-current`, not a tab widget. On a detail page these switch the whole
 * content region below (usually URL-addressable, `?tab=`), which is navigation
 * between sub-views, not a `tablist` whose panels live inside it. Modelling it as
 * tabs would promise panels that are rendered by the page instead, leaving a
 * screen-reader user with tabs that control nothing.
 *
 * The page owns the selected value and what each section renders, so this is
 * presentation only: it says which sections exist and which is current, and
 * reports a click. Point it at a `?tab=` search param and the sections become
 * deep-linkable for free: see `PlanDetailPage`.
 *
 * The row scrolls horizontally rather than wrapping, so a resource with six
 * sections keeps them on one line on a phone (the responsive rule for detail
 * navigation) instead of stacking into a block that pushes the content down.
 */
export const ResourceNavigationProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Detail-page section nav in the line-tab treatment, as a <nav> with aria-current: navigation, not a tablist.',
})

export interface ResourceNavItem {
  id: string
  label: string
  /** A count beside the label: open invoices, linked charges. */
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
        // The rule runs the full width; the active item's underline sits on
        // top of it, so switching sections slides the mark along one line.
        'border-b',
        className,
      )}
    >
      <ul className="-mb-px flex items-center gap-7 overflow-x-auto">
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
                  // Same strip as the reference `DetailTabs` (line variant):
                  // text-sm medium, 60% foreground until active, 2px underline.
                  'text-foreground/60 hover:text-foreground relative inline-flex items-center gap-1.5 pb-3 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:outline-ring focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2',
                  'after:bg-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:opacity-0 after:transition-opacity',
                  active && 'text-foreground after:opacity-100',
                  item.disabled && 'pointer-events-none opacity-50',
                )}
              >
                {item.icon}
                {item.label}
                {item.count !== undefined ? (
                  <span className="text-muted-foreground text-xs tabular-nums">{item.count}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
