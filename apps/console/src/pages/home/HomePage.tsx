import { DashboardHome } from '@fp/ui/flexprice'

/**
 * Home.
 *
 * Renders the ReUI `dashboard-4` block as installed — its own layout and sample
 * data, unchanged. This replaces the Home placeholder; the block is a starting
 * point that will later read real revenue and usage.
 *
 * The shell's content region is `overflow-hidden` (list pages scroll their own
 * grid); a page that reads top to bottom owns its scroll. The block is taller
 * than the viewport, so it is wrapped here in `h-full overflow-y-auto` — the
 * same pattern the shell documents for forms — rather than editing the block.
 */
export function HomePage() {
  return (
    <div className="h-full overflow-y-auto">
      <DashboardHome />
    </div>
  )
}
