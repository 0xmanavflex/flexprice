import { type InvoiceQuery } from '@fp/domain'
import { ApiError, useInvoices } from '@fp/query'
import { InvoiceGrid } from '@fp/ui/flexprice'

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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Invoices</h1>

      <InvoiceGrid
        invoices={invoices.data?.invoices ?? []}
        total={invoices.data?.total ?? 0}
        query={query}
        onQueryChange={onQueryChange}
        isLoading={invoices.isPending}
        error={toMessage(invoices.error)}
        onRetry={() => void invoices.refetch()}
      />
    </main>
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
