import { type PaymentQuery } from '@fp/domain'
import { ApiError, usePayments } from '@fp/query'
import { PaymentGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { CreditCardIcon } from 'lucide-react'

export interface PaymentListPageProps {
  query: PaymentQuery
  onQueryChange: (query: PaymentQuery) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `InvoiceListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL. And no create button — payments
 * arrive as money is collected against invoices, they are not authored here, so
 * the page is read-only.
 */
export function PaymentListPage({ query, onQueryChange }: PaymentListPageProps) {
  const payments = usePayments(query)

  const failure = toFailure(payments.error)
  const rows = payments.data?.payments ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
      <PageBody>
        <ListState
          isLoading={payments.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void payments.refetch()}
          onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
          emptyIcon={<CreditCardIcon aria-hidden />}
          emptyTitle="No payments yet"
          emptyDescription="Payments appear here as they are collected against invoices, successful or failed."
        >
          <PaymentGrid
            payments={rows}
            total={payments.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
          />
        </ListState>
      </PageBody>
    </>
  )
}

/**
 * Turns a failure into something a person can act on.
 *
 * `ListState` takes a message and whether a retry can help; it has no business
 * knowing what an `ApiError` is. A permission error cannot be retried, so it
 * says so rather than inviting someone to keep pressing a button that fails.
 */
function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to payments here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading payments.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading payments.', canRetry: true }
}
