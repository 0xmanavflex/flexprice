import { type PriceUnit, type PriceUnitQuery } from '@fp/domain'
import { ApiError, usePriceUnits } from '@fp/query'
import { PriceUnitGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { CoinsIcon } from '@fp/ui/icons'
import { Button } from '@fp/ui/primitives'

export interface PriceUnitListPageProps {
  query: PriceUnitQuery
  onQueryChange: (query: PriceUnitQuery) => void
  onOpenPriceUnit: (priceUnit: PriceUnit) => void
  onCreatePriceUnit: () => void
}

/**
 * The price-unit surface: a list, a full page to create one, and a detail page.
 *
 * The list stays URL-driven (a filtered view is a link). Creating is
 * `/price-units/new`; the only thing that can change afterwards is the name,
 * which is renamed inline in the name cell or edited in place on the detail page.
 */
export function PriceUnitListPage({
  query,
  onQueryChange,
  onOpenPriceUnit,
  onCreatePriceUnit,
}: PriceUnitListPageProps) {
  const priceUnits = usePriceUnits(query)

  const failure = toFailure(priceUnits.error)
  const rows = priceUnits.data?.priceUnits ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={priceUnits.isPending}
        error={failure}
        isEmpty={rows.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={() => void priceUnits.refetch()}
        onClearFilters={clearFilters}
        createAction={<Button onClick={onCreatePriceUnit}>New price unit</Button>}
        emptyIcon={<CoinsIcon aria-hidden />}
        emptyTitle="No price units yet"
        emptyDescription="Price units let you charge in credits, tokens or minutes instead of a currency, each pinned to a base currency by a conversion rate. Create the first to price in one."
      >
        <PriceUnitGrid
          priceUnits={rows}
          total={priceUnits.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onPriceUnitClick={onOpenPriceUnit}
          onCreate={onCreatePriceUnit}
          onClearFilters={clearFilters}
        />
      </ListState>
    </PageBody>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to price units here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading price units.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading price units.', canRetry: true }
}
