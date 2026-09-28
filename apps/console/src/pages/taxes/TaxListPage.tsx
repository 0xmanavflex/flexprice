import { type TaxRateQuery } from '@fp/domain'
import { ApiError, useTaxRates } from '@fp/query'
import { TaxRateFilters, TaxRateGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'
import { PercentIcon } from 'lucide-react'

export interface TaxListPageProps {
  query: TaxRateQuery
  onQueryChange: (query: TaxRateQuery) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL. Read-only for now — there is no
 * editor yet, so the list neither creates nor opens a rate.
 */
export function TaxListPage({ query, onQueryChange }: TaxListPageProps) {
  const taxRates = useTaxRates(query)

  const failure = toFailure(taxRates.error)
  const rows = taxRates.data?.taxRates ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
      <PageBody>
        <ListState
          isLoading={taxRates.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void taxRates.refetch()}
          onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
          emptyIcon={<PercentIcon aria-hidden />}
          emptyTitle="No tax rates yet"
          emptyDescription="Tax rates decide what is added to an invoice, and where each rate applies."
        >
          <TaxRateGrid
            taxRates={rows}
            total={taxRates.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
            filters={
              <TaxRateFilters
                statuses={query.statuses}
                onStatusesChange={(statuses) => onQueryChange({ ...query, statuses, page: 1 })}
              />
            }
          />
        </ListState>
      </PageBody>
    </>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to tax rates here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading tax rates.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading tax rates.', canRetry: true }
}
