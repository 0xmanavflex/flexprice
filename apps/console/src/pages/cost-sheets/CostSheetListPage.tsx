import { type CostSheet, type CostSheetQuery } from '@fp/domain'
import { ApiError, useCostSheets } from '@fp/query'
import { CostSheetFilters, CostSheetGrid } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { SheetIcon } from 'lucide-react'

export interface CostSheetListPageProps {
  query: CostSheetQuery
  onQueryChange: (query: CostSheetQuery) => void
  onOpenCostSheet: (costSheet: CostSheet) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL. Read-only for now — creating and
 * editing a cost sheet is a later surface, the same way coupons shipped a list
 * before its editor.
 */
export function CostSheetListPage({
  query,
  onQueryChange,
  onOpenCostSheet,
}: CostSheetListPageProps) {
  const costSheets = useCostSheets(query)

  const failure = toFailure(costSheets.error)
  const rows = costSheets.data?.costSheets ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <>
      <PageHeader
        title="Cost Sheets"
        description="What each unit of usage costs you, so margin is visible against what you charge."
      />

      <PageBody>
        <ListState
          isLoading={costSheets.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void costSheets.refetch()}
          onClearFilters={clearFilters}
          emptyIcon={<SheetIcon aria-hidden />}
          emptyTitle="No cost sheets yet"
          emptyDescription="Cost sheets record what usage costs you, so margin can be measured against what you charge. They appear here once created."
        >
          <CostSheetGrid
            costSheets={rows}
            total={costSheets.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onCostSheetClick={onOpenCostSheet}
            onClearFilters={clearFilters}
            filters={
              <CostSheetFilters
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
        return { message: 'You do not have access to cost sheets here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading cost sheets.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading cost sheets.', canRetry: true }
}
