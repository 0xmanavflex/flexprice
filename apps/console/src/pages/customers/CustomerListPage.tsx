import { type CustomerQuery } from '@fp/domain'
import { ApiError, useCustomers } from '@fp/query'
import { CustomerFilters, CustomerGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'
import { UsersIcon } from 'lucide-react'

export interface CustomerListPageProps {
  query: CustomerQuery
  onQueryChange: (query: CustomerQuery) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * A read-only billing list: it fetches, turns an error into a sentence, and
 * hands the grid plain props. No create surface and no `useState` — the query
 * lives in the URL.
 */
export function CustomerListPage({ query, onQueryChange }: CustomerListPageProps) {
  const customers = useCustomers(query)

  const failure = toFailure(customers.error)
  const rows = customers.data?.customers ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
      <PageBody>
        <ListState
          isLoading={customers.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void customers.refetch()}
          onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
          emptyIcon={<UsersIcon aria-hidden />}
          emptyTitle="No customers yet"
          emptyDescription="Customers are who you bill. Each carries subscriptions, invoices and a payment history."
        >
          <CustomerGrid
            customers={rows}
            total={customers.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
            filters={
              <CustomerFilters
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
        return { message: 'You do not have access to customers here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading customers.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading customers.', canRetry: true }
}
