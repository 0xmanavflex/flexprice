import { useState } from 'react'
import { type Coupon, type CouponQuery } from '@fp/domain'
import { ApiError, useCatalogStats, useCoupons, useCreateCoupon, useUpdateCoupon } from '@fp/query'
import { CouponEditorDialog, CouponGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { TicketPercentIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface CouponListPageProps {
  query: CouponQuery
  onQueryChange: (query: CouponQuery) => void
  onOpenCoupon: (coupon: Coupon) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `AddonListPage`.
 *
 * Replaces V1's `Coupons.tsx`. Fetches, turns an error into a sentence, and
 * hands the grid plain props. The query lives in the URL; the create dialog is
 * the one piece of local state.
 */
export function CouponListPage({ query, onQueryChange, onOpenCoupon }: CouponListPageProps) {
  const coupons = useCoupons(query)
  const update = useUpdateCoupon()
  const create = useCreateCoupon()
  const [creating, setCreating] = useState(false)
  const onCreate = () => setCreating(true)
  const close = () => {
    setCreating(false)
    create.reset()
  }
  // The server's counts for the status dropdown — one `limit: 1` request each,
  // read for `pagination.total`, never counted off the page on screen.
  const stats = useCatalogStats('coupons')

  const failure = toFailure(coupons.error)
  const rows = coupons.data?.coupons ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
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
          emptyDescription="Coupons apply a discount to a subscription or an invoice — once, for a set number of periods, or forever. Create the first to offer one."
        >
          <CouponGrid
            coupons={rows}
            total={coupons.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onCouponClick={onOpenCoupon}
            onRename={(coupon, name) =>
              update.mutateAsync({ id: coupon.id, draft: { name } }).then(() => undefined, () => undefined)
            }
            onCreate={onCreate}
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
            statusCounts={{
              total: stats.total,
              published: stats.published,
              archived: stats.archived,
            }}
          />
        </ListState>
      </PageBody>

      <CouponEditorDialog
        mode="create"
        open={creating}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        onSubmit={(draft) => create.mutate(draft, { onSuccess: close })}
        isSubmitting={create.isPending}
        submitError={toSubmitError(create.error)}
      />
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

function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change coupons here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the coupon. Try again.'
    }
  }
  return 'Could not save the coupon. Try again.'
}
