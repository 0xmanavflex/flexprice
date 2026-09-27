import { type Coupon, type CouponQuery } from '@fp/domain'
import { ApiError, useCatalogStats, useCoupons } from '@fp/query'
import { CouponFilters, CouponGrid, StatCards } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { TicketPercentIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface CouponListPageProps {
  query: CouponQuery
  onQueryChange: (query: CouponQuery) => void
  onCreate: () => void
  onOpenCoupon: (coupon: Coupon) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `AddonListPage`.
 *
 * Replaces V1's `Coupons.tsx`. Fetches, turns an error into a sentence, and
 * hands the grid plain props. No `useState`: the query lives in the URL.
 */
export function CouponListPage({ query, onQueryChange, onCreate, onOpenCoupon }: CouponListPageProps) {
  const coupons = useCoupons(query)
  const stats = useCatalogStats('coupons')

  const failure = toFailure(coupons.error)
  const rows = coupons.data?.coupons ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discounts a customer can redeem against a subscription or an invoice."
        action={<Button onClick={onCreate}>New coupon</Button>}
      />

      <PageBody>
        {stats.total !== 0 ? (
          <StatCards
            isLoading={stats.isPending}
            stats={[
              { label: 'Coupons', value: stats.total },
              { label: 'Published', value: stats.published },
              { label: 'Archived', value: stats.archived },
            ]}
          />
        ) : null}

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
          emptyDescription="Coupons apply a discount to a subscription or an invoice — once, for a set number of periods, or forever. Create the first to offer one."
        >
          <CouponGrid
            coupons={rows}
            total={coupons.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onCouponClick={onOpenCoupon}
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
            filters={
              <CouponFilters
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
