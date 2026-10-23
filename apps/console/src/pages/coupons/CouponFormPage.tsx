import {
  CouponType,
  formatMoney,
  type Coupon,
  type CreateCoupon,
  type EditCoupon,
} from '@fp/domain'
import { useCoupon, useCreateCoupon, useUpdateCoupon } from '@fp/query'
import { CouponCreateForm, CouponForm } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import { toSubmitError } from './couponMessages'

export type CouponFormPageProps = {
  /** Back to where the person came from (the list or the detail page). */
  onCancel: () => void
  onNavigateToList: () => void
} & (
  | { mode: 'create'; onDone: (couponId: string) => void }
  | { mode: 'edit'; couponId: string; onDone: (couponId: string) => void }
)

/**
 * Create or edit a coupon on its own page.
 *
 * Create collects the whole coupon (`CouponCreateForm`) because the discount,
 * cadence and window cannot change afterwards; edit is a rename
 * (`CouponForm`) with the fixed parts shown as read-only context. Create ends
 * on the new coupon's detail page; edit returns to where it came from.
 */
export function CouponFormPage(props: CouponFormPageProps) {
  const { onCancel, onNavigateToList } = props
  const create = useCreateCoupon()
  const update = useUpdateCoupon()
  const existing = useCoupon(props.mode === 'edit' ? props.couponId : '')

  if (props.mode === 'create') {
    return (
      <CouponCreateForm
        trail={[{ label: 'Coupons', onClick: onNavigateToList }, { label: 'Create coupon' }]}
        onCancel={onCancel}
        isSubmitting={create.isPending}
        // The API's refusal is a toast (MutationToasts); validation stays in the form.
        submitError={null}
        onSubmit={(draft: CreateCoupon) =>
          create.mutate(draft, {
            onSuccess: (created) => props.onDone((created as { id?: string }).id ?? ''),
          })
        }
      />
    )
  }

  if (existing.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }
  if (existing.error || !existing.data) {
    return (
      <PageBody>
        <AppFailure
          title="This coupon could not be loaded"
          detail="Try again, or go back."
          onRetry={existing.error ? () => void existing.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  const coupon = existing.data
  return (
    <CouponForm
      defaultValue={{ name: coupon.name }}
      summary={{ code: coupon.code, discount: discountText(coupon) }}
      trail={[
        { label: 'Coupons', onClick: onNavigateToList },
        { label: 'Coupon details', onClick: () => props.onDone(coupon.id) },
        { label: 'Edit' },
      ]}
      onCancel={onCancel}
      isSubmitting={update.isPending}
      submitError={toSubmitError(update.error)}
      onSubmit={(draft: EditCoupon) =>
        update.mutate({ id: coupon.id, draft }, { onSuccess: () => props.onDone(coupon.id) })
      }
    />
  )
}

/** The discount, drawn from whichever field the type populates. */
function discountText(coupon: Coupon): string {
  if (coupon.type === CouponType.Percentage) return `${coupon.percentageOff ?? '0'}% off`
  return coupon.amountOff ? `${formatMoney(coupon.amountOff)} off` : '—'
}
