import { type CreatePriceUnit } from '@fp/domain'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/primitives/sheet'
import { provenance } from '@ui/provenance'
import { PriceUnitForm } from './PriceUnitForm'

/**
 * The price-unit editor, as a right-hand drawer.
 *
 * A drawer rather than a page or a modal — V1's own choice, and there is no
 * detail page to navigate to — so creating or editing one keeps the list
 * visible behind it. Presentational: it owns nothing but the form's field
 * values. The page decides when it is open, which mode it is in, and what a
 * submit does.
 */
export const PriceUnitEditorSheetProvenance = provenance({
  source: 'composition',
  composes: ['ui/sheet'],
  note: 'The price-unit details form in a drawer, so the list stays visible behind it.',
})

export interface PriceUnitEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreatePriceUnit
  onSubmit: (priceUnit: CreatePriceUnit) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function PriceUnitEditorSheet({
  open,
  onOpenChange,
  mode,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: PriceUnitEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === 'create' ? 'New price unit' : 'Edit price unit'}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Define a unit to charge in — its code, symbol, and the rate it converts to a currency at.'
              : 'Update the price unit’s name. Its code, symbol, currency and rate are fixed once created.'}
          </SheetDescription>
        </SheetHeader>

        {/*
         * Remounting the form per open (create) or per record (edit) resets
         * react-hook-form's defaults — without the key, opening the drawer for a
         * second unit would show the first one's values.
         */}
        <div className="flex-1 overflow-y-auto p-4">
          <PriceUnitForm
            key={`${mode}:${defaultValue?.code ?? 'new'}`}
            mode={mode}
            {...(defaultValue ? { defaultValue } : {})}
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
