import { type DunningRow, useDunning } from '@fp/query'
import { formatMoney } from '@fp/domain'
import { CollectionsSummary, DunningGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { failed, qualityOf } from '../home/queryView'
import { toListFailure } from '../shared/listFailure'

export interface DunningListPageProps {
  onCustomerClick?: (customer: DunningRow) => void
}

/**
 * The wiring layer for Dunning: what is overdue, and who owes it.
 *
 * One read of the finalized invoices feeds both the two totals and the table
 * of customers behind the overdue one, so the rows always add up to the card.
 * Nothing here is paged by the server — there is no tenant-wide endpoint — so
 * the table keeps its own search, sort and paging.
 */
export function DunningListPage({ onCustomerClick }: DunningListPageProps) {
  const dunning = useDunning()
  const failure = toListFailure(dunning.error, 'overdue invoices')
  const rows = dunning.data?.rows ?? []

  return (
    <PageBody>
      <CollectionsSummary {...collectionsProps(dunning)} />
      <ListState
        isLoading={dunning.isPending}
        error={failure}
        isEmpty={rows.length === 0}
        isFiltered={false}
        hasRows={dunning.data !== undefined}
        isRefreshing={dunning.isFetching && !dunning.isPending}
        isProvisional={dunning.isPlaceholderData}
        isRetrying={dunning.isFetching && dunning.isError}
        {...(failure ? { failureKind: failure.kind } : {})}
        onRetry={() => void dunning.refetch()}
        onClearFilters={() => undefined}
        emptyTitle="Nothing overdue"
        emptyDescription={
          dunning.data?.isPartial
            ? 'None found in the newest finalized invoices read. Older unpaid invoices are not checked.'
            : 'No finalized invoice is past its due date or has a failed payment.'
        }
      >
        <DunningGrid customers={rows} {...(onCustomerClick ? { onCustomerClick } : {})} />
      </ListState>
    </PageBody>
  )
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

type CollectionsQuery = ReturnType<typeof useDunning>

/**
 * The summary's props, shaped data-first like every other panel.
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
 * and the summary replaces the hints with its own loading / unavailable copy.
 *
 * With a summary, a total that is `null` means nothing is owed, so it is the
 * dash and a plain statement, not "$0.00". The currency is the one the totals
 * were summed in; none is assumed when there is nothing to sum.
 */
function collectionsCells(summary: Summary | undefined) {
  if (!summary) {
    return [
      { label: 'Total overdue', value: null, hint: '' },
      { label: 'Total outstanding', value: null, hint: '' },
    ]
  }
  const floor = summary.isPartial ? 'at least ' : ''
  const currency = summary.outstanding?.currency
  const inCurrency = currency ? ` in ${currency}` : ''
  return [
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
    {
      label: 'Total outstanding',
      value: summary.outstanding ? formatMoney(summary.outstanding) : null,
      hint: summary.outstanding
        ? `${floor}${plural(summary.unpaidCount, 'unpaid invoice')}${inCurrency}`
        : summary.isPartial
          ? 'None found in the invoices read'
          : 'No unpaid invoices',
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
