import type { Payment, PaymentQuery } from '@fp/domain'
import { usePayments, useEntityIntegrationColumns } from '@fp/query'
import { PaymentGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

export interface PaymentListPageProps {
  query: PaymentQuery
  onQueryChange: (query: PaymentQuery) => void
  onCreate?: () => void
  onPaymentClick?: (payment: Payment) => void
}

/**
 * The wiring layer, and nothing else: the same shape as `InvoiceListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL. Recording a payment and opening one
 * are navigation, so the route supplies both.
 */
export function PaymentListPage({
  query,
  onQueryChange,
  onCreate,
  onPaymentClick,
}: PaymentListPageProps) {
  const payments = usePayments(query)

  const failure = toListFailure(payments.error, 'payments')
  const rows = payments.data?.payments ?? []
  const integrationMappings = useEntityIntegrationColumns(
    'payment',
    rows.map((payment) => payment.id),
  )
  const total = payments.data?.total ?? 0
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <>
      <PageBody>
        <ListState
          isLoading={payments.isPending}
          error={failure}
          // The filters narrow the page fetched, so an empty page under a filter
          // says nothing about the ledger; only the server's total does.
          isEmpty={rows.length === 0 && total === 0 && !isFiltered}
          isFiltered={isFiltered}
          hasRows={payments.data !== undefined}
          isRefreshing={payments.isFetching && !payments.isPending}
          isProvisional={payments.isPlaceholderData}
          isRetrying={payments.isFetching && payments.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          onRetry={() => void payments.refetch()}
          onClearFilters={clearFilters}
          emptyTitle="No payments yet"
          emptyDescription="Payments appear here as they are collected against invoices, successful or failed."
        >
          <PaymentGrid
            integrationMappings={integrationMappings}
            payments={rows}
            total={total}
            query={query}
            onQueryChange={onQueryChange}
            {...(onCreate ? { onCreate } : {})}
            {...(onPaymentClick ? { onPaymentClick } : {})}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>
    </>
  )
}
