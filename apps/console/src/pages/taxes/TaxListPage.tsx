import { type TaxRateQuery } from '@fp/domain'
import { ApiError, useTaxRates } from '@fp/query'
import { TaxRateFilters, TaxRateGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { PercentIcon } from 'lucide-react'
import { env } from '@/env'

export interface TaxListPageProps {
  query: TaxRateQuery
  onQueryChange: (query: TaxRateQuery) => void
}

/** Where a tax rate is created today. No origin configured, no link. */
const LEGACY_PATH = '/billing/taxes'

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL. Read-only for now — there is no
 * editor yet, so the list does not open a rate.
 *
 * It does offer to create one, though, because "read-only for now" was being
 * paid for by the customer: the page it replaced offered "Create tax rate"
 * against the current dashboard, and this one offered nothing at all, from a
 * screen whose whole job is the rates. `POST /taxes/rates` is in the SDK and
 * unwired here, so the offer hands off rather than pretending.
 */
export function TaxListPage({ query, onQueryChange }: TaxListPageProps) {
  const taxRates = useTaxRates(query)

  const createHref = env.legacyConsoleUrl ? `${env.legacyConsoleUrl}${LEGACY_PATH}` : null

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
          {...(createHref
            ? {
                createAction: (
                  <Button
                    size="sm"
                    render={
                      // A new tab, so nothing open in the console is lost.
                      <a href={createHref} rel="noreferrer" target="_blank" />
                    }
                  >
                    New tax rate
                  </Button>
                ),
              }
            : {})}
          emptyIcon={<PercentIcon aria-hidden />}
          emptyTitle="No tax rates yet"
          emptyDescription={
            createHref
              ? 'Tax rates decide what is added to an invoice, and where each rate applies. Create the first in the current dashboard.'
              : 'Tax rates decide what is added to an invoice, and where each rate applies. Creating one is not in this console yet — use POST /taxes/rates, or the current dashboard.'
          }
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
