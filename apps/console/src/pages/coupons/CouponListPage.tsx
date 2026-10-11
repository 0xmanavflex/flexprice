import { type Coupon, type CouponQuery } from '@fp/domain'
import { ApiError, useCoupons } from '@fp/query'
import { CouponGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { TicketPercentIcon } from '@fp/ui/icons'
import { Button } from '@fp/ui/primitives'

export interface CouponListPageProps {
  query: CouponQuery
  onQueryChange: (query: CouponQuery) => void
  onOpenCoupon: (coupon: Coupon) => void
  onCreateCoupon: () => void
}

/**
 * The wiring layer, and nothing else — the same shape as `AddonListPage`.
 *
 * Replaces V1's `Coupons.tsx`. Fetches, turns an error into a sentence, and
 * hands the grid plain props. The query lives in the URL; create is a full page
 * (`CouponFormPage`) and names rename inline in the row.
 */
export function CouponListPage({
  query,
  onQueryChange,
  onOpenCoupon,
  onCreateCoupon,
}: CouponListPageProps) {
  const coupons = useCoupons(query)
  const onCreate = onCreateCoupon
  const failure = toFailure(coupons.error)
  const rows = coupons.data?.coupons ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <PageBody>
      <ListState
        isLoading={coupons.isPending}
        error={failure}
        isEmpty={rows.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={() => void coupons.refetch()}
        onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
        createAction={<Button onClick={onCreate}>New coupon</Button>}
        emptyIcon={<TicketPercentIcon aria-hidden />}
        emptyTitle="No coupons yet"
        emptyDescription="Coupons apply a discount to a contract or an invoice — once, for a set number of periods, or forever. Create the first to offer one."
      >
        <CouponGrid
          coupons={rows}
          total={coupons.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onCouponClick={onOpenCoupon}
          onCreate={onCreate}
          onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
        />
      </ListState>
    </PageBody>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to coupons here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading coupons.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading coupons.', canRetry: true }
}
