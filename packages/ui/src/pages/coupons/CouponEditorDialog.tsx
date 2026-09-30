import { type CreateCoupon, type EditCoupon } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { CouponCreateForm } from './CouponCreateForm'
import { CouponForm } from './CouponForm'

/**
 * The coupon editor, as a centred dialog.
 *
 * Two modes on one container. `create` collects the whole coupon — type,
 * discount, cadence, redemption limits and window — because none of that can be
 * changed later. `edit` is a rename (the discount is immutable), so the form is
 * small and shows the code and discount as read-only context. A dialog so the
 * list or detail page stays visible behind it. Presentational: the page owns
 * open/close and the mutation.
 */
export const CouponEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'Coupon create (full fields) and rename in a dialog, so the page stays behind it.',
})

interface CouponEditorDialogBase {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export interface CouponCreateDialogProps extends CouponEditorDialogBase {
  mode: 'create'
  defaultValue?: CreateCoupon
  onSubmit: (coupon: CreateCoupon) => void
}

export interface CouponEditDialogProps extends CouponEditorDialogBase {
  mode?: 'edit'
  defaultValue: EditCoupon
  summary?: { code: string; discount: string }
  onSubmit: (coupon: EditCoupon) => void
}

export type CouponEditorDialogProps = CouponCreateDialogProps | CouponEditDialogProps

export function CouponEditorDialog(props: CouponEditorDialogProps) {
  const { open, onOpenChange, isSubmitting = false, submitError = null } = props

  if (props.mode === 'create') {
    return (
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="New coupon"
        description="A discount customers can redeem. Its type, amount and duration are fixed once created."
        size="lg"
      >
        <CouponCreateForm
          {...(props.defaultValue ? { defaultValue: props.defaultValue } : {})}
          onSubmit={props.onSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      </FormDialog>
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit coupon"
      description="Rename the coupon. Its discount, cadence and redemption window are fixed once created."
    >
      <CouponForm
        key={props.defaultValue.name}
        defaultValue={props.defaultValue}
        {...(props.summary ? { summary: props.summary } : {})}
        onSubmit={props.onSubmit}
        onCancel={() => onOpenChange(false)}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </FormDialog>
  )
}
