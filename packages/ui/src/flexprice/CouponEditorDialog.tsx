import { type EditCoupon } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { CouponForm } from './CouponForm'

/**
 * The coupon editor, as a centred dialog.
 *
 * A dialog so the detail page stays visible behind it — the same choice add-ons
 * and groups make. Editing a coupon is a rename (the discount is immutable), so
 * the form is small; the dialog shows the code and discount as read-only
 * context. Presentational: the page owns open/close and the mutation.
 */
export const CouponEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The coupon rename form in a dialog, so the detail page stays behind it.',
})

export interface CouponEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValue: EditCoupon
  summary?: { code: string; discount: string }
  onSubmit: (coupon: EditCoupon) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function CouponEditorDialog({
  open,
  onOpenChange,
  defaultValue,
  summary,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: CouponEditorDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={'Edit coupon'}
      description={
        'Rename the coupon. Its discount, cadence and redemption window are fixed once created.'
      }
    >
      <CouponForm
        key={defaultValue.name}
        defaultValue={defaultValue}
        {...(summary ? { summary } : {})}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </FormDialog>
  )
}
