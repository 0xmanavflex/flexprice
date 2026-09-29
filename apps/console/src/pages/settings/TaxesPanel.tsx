import { Link } from '@tanstack/react-router'
import { DEFAULT_TAX_RATE_QUERY } from '@fp/domain'
import { useTaxRates } from '@fp/query'
import { Section } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { PanelError, Panel, toFailure } from './panelKit'

/**
 * Taxes: a signpost, not a second tax screen.
 *
 * `/taxes` is a real page with a grid, filters, paging and a URL-backed query.
 * Rebuilding any of that here would mean two places to fix a bug and two
 * places that can disagree about what a rate is — the first thing a reader
 * does when two screens show different numbers is stop trusting both.
 *
 * So this tab does the two things a settings entry should: it says how many
 * rates are configured, so the tab is not a dead end, and it hands over.
 * The count comes from the same hook the list page uses, so it cannot drift.
 */
export function TaxesPanel() {
  // One row is enough: `pagination.total` is the number, and fetching a page
  // of twenty-five to count them would be twenty-four wasted rows.
  const rates = useTaxRates({ ...DEFAULT_TAX_RATE_QUERY, pageSize: 1 })
  const failure = toFailure(rates.error, 'your tax rates')

  return (
    <Panel>
      <Section
        title="Taxes"
        description="Which tax is added to an invoice, and where each rate applies."
        actions={
          /*
           * A real link, rendered with the button's styling — so it can be
           * middle-clicked, opened in a new tab and copied, which a `<button>`
           * that calls `navigate()` cannot.
           *
           * `nativeButton={false}` is required, not decorative: Base UI's
           * `Button` assumes it is rendering a `<button>` and, told otherwise,
           * adds the keyboard and role handling an `<a>` needs to behave like
           * one. Leaving it out logs a warning and ships an anchor with button
           * semantics half-applied.
           */
          <Button size="sm" nativeButton={false} render={<Link to="/taxes" search={{} as never} />}>
            Open tax rates
          </Button>
        }
      >
        {failure ? (
          <PanelError failure={failure} onRetry={() => void rates.refetch()} />
        ) : rates.isPending ? (
          <p className="text-muted-foreground text-sm">Counting your tax rates…</p>
        ) : (
          <p className="text-sm">
            {rates.data?.total === 0
              ? 'No tax rates are configured yet.'
              : `${rates.data?.total ?? 0} tax rate${rates.data?.total === 1 ? '' : 's'} configured.`}{' '}
            <span className="text-muted-foreground">
              Rates are managed on their own page, where they can be searched and filtered.
            </span>
          </p>
        )}
      </Section>
    </Panel>
  )
}
