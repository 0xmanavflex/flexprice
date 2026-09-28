import { type EditCoupon } from '@fp/domain'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/primitives/sheet'
import { provenance } from '@ui/provenance'
import { CouponForm } from './CouponForm'

/**
 * The coupon editor, as a right-hand drawer.
 *
 * A drawer so the detail page stays visible behind it — the same choice add-ons
 * and groups make. Editing a coupon is a rename (the discount is immutable), so
 * the form is small; the drawer shows the code and discount as read-only
 * context. Presentational: the page owns open/close and the mutation.
 */
export const CouponEditorSheetProvenance = provenance({
  source: 'composition',
  composes: ['ui/sheet'],
  note: 'The coupon rename form in a drawer, so the detail page stays behind it.',
})

export interface CouponEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValue: EditCoupon
  summary?: { code: string; discount: string }
  onSubmit: (coupon: EditCoupon) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function CouponEditorSheet({
  open,
  onOpenChange,
  defaultValue,
  summary,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: CouponEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Edit coupon</SheetTitle>
          <SheetDescription>
            Rename the coupon. Its discount, cadence and redemption window are fixed once created.
          </SheetDescription>
        </SheetHeader>

        {/* Remounting per open resets react-hook-form's defaults, so a second
            open shows the current name rather than the last one edited. */}
        <div className="flex-1 overflow-y-auto p-4">
          <CouponForm
            key={defaultValue.name}
            defaultValue={defaultValue}
            {...(summary ? { summary } : {})}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
