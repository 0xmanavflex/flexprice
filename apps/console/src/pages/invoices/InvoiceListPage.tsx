import { type InvoiceQuery } from '@fp/domain'
import { ApiError, useInvoices } from '@fp/query'
import { ReceiptIcon } from 'lucide-react'
import { InvoiceFilters, InvoiceGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'

export interface InvoiceListPageProps {
  query: InvoiceQuery
  onQueryChange: (query: InvoiceQuery) => void
}

/**
 * The wiring layer, and deliberately nothing else.
 *
 * The page is where `@fp/query` and `@fp/ui` are allowed to meet. It fetches,
 * turns an error into a sentence, and hands the grid plain props. It contains
 * no table logic, and `InvoiceGrid` contains no fetching — neither knows the
 * other's business, which is the whole architectural claim being tested here.
 *
 * Note what is absent: any `useState`. The query lives in the URL, so this
 * component has nothing to remember.
 */
export function InvoiceListPage({ query, onQueryChange }: InvoiceListPageProps) {
  const invoices = useInvoices(query)

  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const rows = invoices.data?.invoices ?? []

  return (
    <>
      <PageBody>
        {/*
         * Through `ListState`, like every other list — not a hand-rolled early
         * return, which is what this was.
         *
         * The distinction matters here more than anywhere else in the console.
         * Replacing the grid with a first-run panel also removes the toolbar,
         * and the toolbar is where the status filter lives. An invoice the
         * default query does not return — a skipped one, say — then leaves the
         * ledger looking empty with no control on screen to go and find it.
         * The reader is told "no invoices yet" and given no way to discover
         * that this is false. `ListState` keeps the toolbar up and puts the
         * first-run copy inside the table body instead.
         */}
        <ListState
          isLoading={invoices.isPending}
          error={
            invoices.error ? { message: toMessage(invoices.error) ?? '', canRetry: true } : null
          }
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void invoices.refetch()}
          emptyIcon={<ReceiptIcon aria-hidden />}
          emptyTitle="No invoices yet"
          emptyDescription="Invoices are produced when a subscription's billing period closes. Create a plan and subscribe a customer, and the first one will appear here."
          onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
        >
          <InvoiceGrid
            invoices={rows}
            total={invoices.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            isLoading={invoices.isPending}
            error={toMessage(invoices.error)}
            onRetry={() => void invoices.refetch()}
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
            /*
             * The status facet, in the toolbar beside Sort — the same slot
             * every other list screen fills. Without it the ledger could only
             * be narrowed by hand-editing the URL, which is how a tenant whose
             * only invoice was skipped ended up looking at an empty list.
             */
            filters={
              <InvoiceFilters
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

/**
 * Turns a failure into something a person can act on.
 *
 * The grid takes a string, not an error: it has no business knowing what an
 * `ApiError` is, and a component that branches on `kind` cannot be told to
 * render the forbidden state in a story.
 */
function toMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to invoices in this environment.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again to continue.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return error.message
    }
  }
  return 'Something went wrong loading invoices.'
}
