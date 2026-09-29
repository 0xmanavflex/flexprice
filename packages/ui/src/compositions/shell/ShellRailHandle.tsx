import { useSidebar } from '@ui/primitives/sidebar'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * The collapse handle, on the seam between the sidebar and the page.
 *
 * Taken from ReUI's Flux template, which puts it exactly where the hand
 * already is: the edge you are about to drag. The trigger in the sidebar
 * header still exists and still works — this is the one people find without
 * being told, because it is on the boundary it moves.
 *
 * At rest it is two four-pixel bars, quiet enough to ignore. On hover they
 * fold into a chevron pointing the way the sidebar will go, and the word
 * appears beside it. Nothing about it is an icon until you approach it, which
 * is the only reason a permanent control on the edge of the content is
 * tolerable at all.
 *
 * `fixed`, and positioned by the same custom property that sizes the sidebar,
 * so it tracks the edge through the collapse transition instead of jumping
 * when it ends.
 */
export const ShellRailHandleProvenance = provenance({
  source: 'composition',
  composes: ['ui/sidebar'],
  note: "Flux's edge collapse handle: two bars that fold into a chevron on hover.",
})

const BAR =
  'bg-foreground/40 block h-2 w-0.5 group-focus-visible/rail:bg-foreground/60 transition-all duration-100 ease-linear group-hover/rail:bg-foreground/60 motion-reduce:transition-none'

export function ShellRailHandle() {
  const { state, toggleSidebar, isMobile } = useSidebar()
  const isOpen = state === 'expanded'

  /*
   * Not rendered at all below `lg`, rather than hidden with a class.
   *
   * There is no seam to sit on while the sidebar is a sheet, and a `hidden`
   * button still keeps its bars in the tree — which is how two grey ticks
   * ended up measurable just inside the content card's left edge. Removing the
   * subtree is the only thing that reliably suppresses its descendants.
   */
  if (isMobile) return null

  return (
    <button
      type="button"
      aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      aria-expanded={isOpen}
      onClick={toggleSidebar}
      style={{
        // The sidebar's own two widths, so the handle rides the transition
        // rather than snapping to the end of it.
        left: isOpen
          ? 'var(--sidebar-width)'
          : 'calc(var(--sidebar-width-icon) + var(--spacing) * 4)',
      }}
      className="group/rail focus-visible:ring-ring fixed top-1/2 z-30 hidden h-12 w-7 -translate-y-1/2 cursor-pointer items-center rounded-md pl-2 transition-[left] duration-200 ease-linear outline-none focus-visible:ring-2 motion-reduce:transition-none lg:flex"
    >
      <span className="flex flex-col items-center">
        {/* The chevron points where the sidebar is going, not where it is. */}
        <span
          aria-hidden
          className={cn(
            BAR,
            'origin-bottom rounded-t-full',
            isOpen
              ? 'group-hover/rail:rotate-40 group-focus-visible/rail:rotate-40'
              : 'group-hover/rail:-rotate-40 group-focus-visible/rail:-rotate-40',
          )}
        />
        <span
          aria-hidden
          className={cn(
            BAR,
            'origin-top rounded-b-full',
            isOpen
              ? 'group-hover/rail:-rotate-40 group-focus-visible/rail:-rotate-40'
              : 'group-hover/rail:rotate-40 group-focus-visible/rail:rotate-40',
          )}
        />
      </span>

      {/*
        Not a tooltip component: a tooltip on a control this small and this
        close to the content would open on every pass of the cursor towards
        the page. This only exists while the handle itself is hovered.
      */}
      <span
        aria-hidden
        className="border-border bg-foreground text-background pointer-events-none absolute left-full -ml-2 -translate-x-0.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap opacity-0 shadow-xs shadow-black/5 transition-all duration-200 ease-out group-hover/rail:translate-x-0 group-hover/rail:opacity-100 group-focus-visible/rail:translate-x-0 group-focus-visible/rail:opacity-100"
      >
        {isOpen ? 'Collapse' : 'Expand'}
      </span>
    </button>
  )
}
