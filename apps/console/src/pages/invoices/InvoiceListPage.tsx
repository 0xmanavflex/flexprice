import { useNavigate } from '@tanstack/react-router'
import {
  DEFAULT_CUSTOMER_QUERY,
  type Invoice,
  type InvoiceQuery,
  isStoredInvoiceStatus,
} from '@fp/domain'
import { useCustomers, useInvoices, useEntityIntegrationColumns } from '@fp/query'
import { InvoiceGrid, Toaster } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { useInvoiceRowActions } from './useInvoiceRowActions'
import { toListFailure } from '../shared/listFailure'

export interface InvoiceListPageProps {
  query: InvoiceQuery
  onQueryChange: (query: InvoiceQuery) => void
  onCreate?: () => void
  onInvoiceClick?: (invoice: Invoice) => void
  onOpenCustomer?: (customerId: string) => void
  /** Row menu: record a payment against this invoice. */
  onRecordPayment?: (invoiceId: string) => void
  /** Row menu: credit part of this invoice. */
  onIssueCreditNote?: (invoiceId: string) => void
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
export function InvoiceListPage({
  query,
  onQueryChange,
  onCreate,
  onInvoiceClick,
  onOpenCustomer,
  onRecordPayment,
  onIssueCreditNote,
}: InvoiceListPageProps) {
  const invoices = useInvoices(query)
  const navigate = useNavigate()
  const { actionsFor, dialogs } = useInvoiceRowActions({
    onRecordPayment,
    onIssueCreditNote,
    onOpenCustomer,
    onEditInvoice: (invoiceId) =>
      void navigate({ to: '/invoices/$invoiceId/edit', params: { invoiceId } }),
    onOpenContract: (subscriptionId) =>
      void navigate({ to: '/contracts/$subscriptionId', params: { subscriptionId } }),
  })

  const isFiltered =
    query.search.length > 0 || query.statuses.length > 0 || (query.filters?.length ?? 0) > 0
  // The choices behind the Customer filter: the first hundred customers.
  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, page: 1, pageSize: 100 })
  const filterOptions = {
    customer_id: (customers.data?.customers ?? []).map((c) => ({ value: c.id, label: c.name })),
  }
  const fetched = invoices.data?.invoices ?? []
  const integrationMappings = useEntityIntegrationColumns(
    'invoice',
    fetched.map((invoice) => invoice.id),
  )
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })

  const failure = toListFailure(invoices.error, 'invoices')

  /*
   * `paid` and `overdue` are derived, so the request went out without them.
   *
   * `deriveInvoiceStatus` computes the first from a payment status and the
   * second from a balance plus a due date in the past; neither is a field, so
   * `toInvoiceFilter` drops them and the API answers with everything. Without
   * the pass below the reader would get an unfiltered ledger under a control
   * insisting it was filtered — the one failure mode a billing console must
   * not have.
   *
   * So the narrowing happens here, over the page that came back, and the grid
   * says on screen that it is page-local ("Filtered within this page").
   *
   * `total` is *not* corrected. It used to be overwritten with the narrowed
   * count, which made the footer claim the ledger had three invoices and, worse,
   * collapsed pagination to a single page — so the next page, where the other
   * paid invoices are, could never be reached. The server's total stays the
   * server's; the grid explains the difference.
   */
  const derived = query.statuses.filter((status) => !isStoredInvoiceStatus(status))
  const isPageLocal = derived.length > 0
  const rows: Invoice[] = isPageLocal
    ? fetched.filter((invoice) => derived.includes(invoice.status))
    : fetched
  const total = invoices.data?.total ?? 0

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
          error={failure}
          // A page-local filter can leave this page empty while the ledger is
          // not; only the server's total says whether anything exists.
          isEmpty={rows.length === 0 && total === 0 && !isFiltered}
          isFiltered={isFiltered}
          hasRows={fetched.length > 0}
          isRefreshing={invoices.isFetching && !invoices.isPending}
          isProvisional={invoices.isPlaceholderData}
          isRetrying={invoices.isFetching && invoices.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          onRetry={() => void invoices.refetch()}
          emptyTitle="No invoices yet"
          emptyDescription="Invoices are produced when a contract's billing period closes. Create a plan and subscribe a customer, and the first one will appear here."
          onClearFilters={clearFilters}
        >
          <InvoiceGrid
            integrationMappings={integrationMappings}
            invoices={rows}
            total={total}
            query={query}
            onQueryChange={onQueryChange}
            filterOptions={filterOptions}
            {...(isPageLocal ? { pageLocal: { fetchedCount: fetched.length } } : {})}
            {...(onCreate ? { onCreate } : {})}
            {...(onInvoiceClick ? { onInvoiceClick } : {})}
            extraActions={actionsFor}
            {...(onOpenCustomer ? { onOpenCustomer } : {})}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      {dialogs}
      <Toaster />
    </>
  )
}
