import { useState } from 'react'
import { type Coupon, type CouponQuery } from '@fp/domain'
import { useArchiveCoupon, useCoupons } from '@fp/query'
import { CouponGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

export interface CouponListPageProps {
  query: CouponQuery
  onQueryChange: (query: CouponQuery) => void
  onOpenCoupon: (coupon: Coupon) => void
  onCreateCoupon: () => void
  onEditCoupon: (coupon: Coupon) => void
}

/**
 * The wiring layer, and nothing else: the same shape as `AddonListPage`.
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
  onEditCoupon,
}: CouponListPageProps) {
  const coupons = useCoupons(query)
  const archive = useArchiveCoupon()
  const [archiving, setArchiving] = useState<Coupon | null>(null)
  const onCreate = onCreateCoupon
  const failure = toListFailure(coupons.error, 'coupons')
  const rows = coupons.data?.coupons ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
      <PageBody>
        <ListState
          isLoading={coupons.isPending}
          error={failure}
          isEmpty={rows.length === 0 && (coupons.data?.total ?? 0) === 0 && !isFiltered}
          hasRows={rows.length > 0}
          isRefreshing={coupons.isFetching && !coupons.isPending}
          isProvisional={coupons.isPlaceholderData}
          isRetrying={coupons.isFetching && coupons.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          isFiltered={isFiltered}
          onRetry={() => void coupons.refetch()}
          onClearFilters={() =>
            onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })
          }
          createAction={<Button onClick={onCreate}>New coupon</Button>}
          emptyTitle="No coupons yet"
          emptyDescription="Coupons apply a discount to a contract or an invoice: once, for a set number of periods, or forever. Create the first to offer one."
        >
          <CouponGrid
            coupons={rows}
            total={coupons.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onCouponClick={onOpenCoupon}
            onEdit={onEditCoupon}
            onArchive={setArchiving}
            onCreate={onCreate}
            onClearFilters={() =>
              onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })
            }
          />
        </ListState>
      </PageBody>

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(null)
            archive.reset()
          }
        }}
        title={`Archive ${archiving?.name ?? 'this coupon'}?`}
        description="The coupon stops being offered, but its redemption history is kept."
        confirmLabel="Archive coupon"
        destructive
        isPending={archive.isPending}
        error={archive.isError ? 'Could not archive the coupon. Try again.' : null}
        onConfirm={() => {
          if (archiving) archive.mutate(archiving.id, { onSuccess: () => setArchiving(null) })
        }}
      />
    </>
  )
}
