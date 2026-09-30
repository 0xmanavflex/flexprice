import { type CostSheet, type CostSheetQuery } from '@fp/domain'
import { ApiError, useCostSheets } from '@fp/query'
import { CostSheetGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { SheetIcon } from 'lucide-react'
import { env } from '@/env'

export interface CostSheetListPageProps {
  query: CostSheetQuery
  onQueryChange: (query: CostSheetQuery) => void
  onOpenCostSheet: (costSheet: CostSheet) => void
}

/** Where a cost sheet is created today. No origin configured, no link. */
const LEGACY_PATH = '/product-catalog/cost-sheets'

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL. Read-only for now — creating and
 * editing a cost sheet is a later surface, the same way coupons shipped a list
 * before its editor.
 *
 * The create action is a hand-off for the same reason as `GroupListPage`:
 * this page replaced a placeholder that linked out to where a cost sheet can
 * be made, the real list dropped that link, and nothing in the console
 * replaced it. `POST /costs` exists in the SDK and is not wired here yet, so
 * the offer points at the dashboard that can serve it today.
 */
export function CostSheetListPage({
  query,
  onQueryChange,
  onOpenCostSheet,
}: CostSheetListPageProps) {
  const costSheets = useCostSheets(query)

  const createHref = env.legacyConsoleUrl ? `${env.legacyConsoleUrl}${LEGACY_PATH}` : null

  /*
   * Built once and handed to the grid, which is now the only thing that
   * renders it.
   *
   * `ListState` still publishes a `createAction` through its offer context,
   * but `EntityList` does not read that context — it takes `primaryAction`
   * and `empty.actions` directly. Leaving the button only on `ListState`
   * would have quietly removed the one route to creating a cost sheet.
   */
  const createAction = createHref ? (
    <Button
      size="sm"
      render={
        // A new tab, so nothing open in the console is lost.
        <a href={createHref} rel="noreferrer" target="_blank" />
      }
    >
      New cost sheet
    </Button>
  ) : null

  const failure = toFailure(costSheets.error)
  const rows = costSheets.data?.costSheets ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <>
      <PageBody>
        <ListState
          isLoading={costSheets.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void costSheets.refetch()}
          onClearFilters={clearFilters}
          {...(createAction ? { createAction } : {})}
          emptyIcon={<SheetIcon aria-hidden />}
          emptyTitle="No cost sheets yet"
          emptyDescription={
            createHref
              ? 'Cost sheets record what usage costs you, so margin can be measured against what you charge. Create the first in the current dashboard.'
              : 'Cost sheets record what usage costs you, so margin can be measured against what you charge. Creating one is not in this console yet — use POST /costs, or the current dashboard.'
          }
        >
          <CostSheetGrid
            costSheets={rows}
            total={costSheets.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onCostSheetClick={onOpenCostSheet}
            onClearFilters={clearFilters}
            {...(createAction ? { primaryAction: createAction, emptyActions: createAction } : {})}
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
