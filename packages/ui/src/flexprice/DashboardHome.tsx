import { Page as Dashboard4 } from '@ui/components/blocks/dashboard-4/page'
import { Source, provenance } from '@ui/provenance'

/**
 * The Home dashboard.
 *
 * The ReUI premium block `dashboard-4`, mounted exactly as installed — its own
 * Frame layout, tabbed metric switcher, composed area chart, ranked agent bars
 * and integration list, with the block's own sample data unchanged. It is a
 * starting point to wire to real billing data later; for now it is the block
 * verbatim.
 *
 * It lives behind `flexprice/` so the app can mount it while the one-seam rule
 * keeps `components/blocks/*` out of the rest of the tree — the block is the
 * one thing the app is allowed to reach only through here.
 */
export const DashboardHomeProvenance = provenance({
  source: Source.REUI,
  registry: ['dashboard-4'],
  note: 'ReUI premium block dashboard-4, mounted as installed with its sample data as the Home page.',
})

export function DashboardHome() {
  return <Dashboard4 />
}
