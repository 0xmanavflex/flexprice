import { type Payment, type PaymentQuery, formatMoney } from '@fp/domain'
import { useCollectionsSummary, usePayments } from '@fp/query'
import { CollectionsSummary, PaymentGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { CreditCardIcon } from '@fp/ui/icons'
import { failed, qualityOf } from '../home/queryView'
import { toListFailure } from '../shared/listFailure'

export interface PaymentListPageProps {
  query: PaymentQuery
  onQueryChange: (query: PaymentQuery) => void
  onCreate?: () => void
  onPaymentClick?: (payment: Payment) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `InvoiceListPage`.
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
  const collections = useCollectionsSummary()

  const failure = toListFailure(payments.error, 'payments')
  const rows = payments.data?.payments ?? []
  const total = payments.data?.total ?? 0
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <>
      <PageBody>
        <CollectionsSummary {...collectionsProps(collections)} />
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
          emptyIcon={<CreditCardIcon aria-hidden />}
          emptyTitle="No payments yet"
          emptyDescription="Payments appear here as they are collected against invoices, successful or failed."
        >
          <PaymentGrid
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

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

type CollectionsQuery = ReturnType<typeof useCollectionsSummary>

/**
 * The strip's props, shaped data-first like every other panel.
 *
 * Data on screen beats a spinner or an error: with a summary, the figures show
 * (a failed refresh keeps them, flagged stale). Without one, a real error is
 * "Unavailable" with a retry and anything else is still loading. Nothing in
 * here ever turns "not loaded" into a zero.
 */
function collectionsProps(query: CollectionsQuery) {
  const summary = query.data
  const quality = qualityOf(query)

  if (!summary) {
    return failed(query)
      ? {
          cells: collectionsCells(undefined),
          isUnavailable: true,
          onRetry: quality.onRetry,
          isRetrying: quality.isRetrying,
        }
      : { cells: collectionsCells(undefined), isLoading: true }
  }

  return {
    cells: collectionsCells(summary),
    notes: collectionsNotes(summary),
    stale: quality.stale,
    refreshing: quality.refreshing,
    updatedAt: quality.updatedAt,
    onRetry: quality.onRetry,
    isRetrying: quality.isRetrying,
  }
}

type Summary = NonNullable<CollectionsQuery['data']>

/**
 * The two cells. Labels only when there is no summary: they carry no figure,
 * and the strip replaces the hints with its own loading / unavailable copy.
 *
 * With a summary, a total that is `null` means nothing is owed, so it is the
 * dash and a plain statement, not "$0.00". The currency is the one the totals
 * were summed in; none is assumed when there is nothing to sum.
 */
function collectionsCells(summary: Summary | undefined) {
  if (!summary) {
    return [
      { label: 'Total outstanding', value: null, hint: '' },
      { label: 'Total overdue', value: null, hint: '' },
    ]
  }
  const floor = summary.isPartial ? 'at least ' : ''
  const currency = summary.outstanding?.currency
  const inCurrency = currency ? ` in ${currency}` : ''
  return [
    {
      label: 'Total outstanding',
      value: summary.outstanding ? formatMoney(summary.outstanding) : null,
      hint: summary.outstanding
        ? `${floor}${plural(summary.unpaidCount, 'unpaid invoice')}${inCurrency}`
        : summary.isPartial
          ? 'None found in the invoices read'
          : 'No unpaid invoices',
    },
    {
      label: 'Total overdue',
      value: summary.overdue && summary.overdueCount > 0 ? formatMoney(summary.overdue) : null,
      hint:
        summary.overdueCount > 0
          ? `${floor}${plural(summary.overdueCount, 'invoice')} past their due date or failed${inCurrency}`
          : summary.isPartial
            ? 'None found in the invoices read'
            : 'No invoices past their due date or failed',
      ...(summary.overdueCount > 0 ? { tone: 'danger' as const } : {}),
    },
  ]
}

/**
 * What the figures leave out, said next to them.
 *
 * `summariseCollections` totals one currency (the one most unpaid invoices are
 * in, not necessarily the largest by amount) and only counts the rest, so a
 * multi-currency ledger gets a "Multiple currencies" note instead of a sum that
 * silently mixes them or silently drops them. A per-currency breakdown needs
 * the query layer; until then this is the honest ceiling.
 */
function collectionsNotes(summary: Summary): string[] {
  const notes: string[] = []
  const currency = summary.outstanding?.currency
  if (summary.otherCurrencies > 0) {
    notes.push(
      `Multiple currencies: totals are in ${currency ?? 'one currency'} only, the currency most unpaid invoices are in. ${plural(summary.otherCurrencies, 'unpaid invoice')} in other currencies ${summary.otherCurrencies === 1 ? 'is' : 'are'} not included.`,
    )
  }
  if (summary.isPartial) {
    notes.push(
      'Read from the newest finalized invoices only. Older unpaid invoices are not counted, so these figures are minimums.',
    )
  }
  return notes
}
