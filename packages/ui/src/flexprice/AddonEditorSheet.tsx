import { type CreateAddon } from '@fp/domain'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/primitives/sheet'
import { provenance } from '@ui/provenance'
import { AddonForm } from './AddonForm'

/**
 * The add-on editor, as a right-hand drawer.
 *
 * A drawer rather than a page or a modal: it keeps the list visible behind it —
 * V1's own choice for add-on details — so creating one in context does not lose
 * the place. A modal would be wrong for a record with several fields; a page
 * would throw the list away.
 *
 * Presentational: it owns nothing but the form's field values. The page decides
 * when it is open, which mode it is in, and what a submit does.
 */
export const AddonEditorSheetProvenance = provenance({
  source: 'composition',
  composes: ['ui/sheet'],
  note: 'The add-on details form in a drawer, so the list stays visible behind it.',
})

export interface AddonEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreateAddon
  onSubmit: (addon: CreateAddon) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function AddonEditorSheet({
  open,
  onOpenChange,
  mode,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: AddonEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === 'create' ? 'New add-on' : 'Edit add-on'}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Create the add-on. Charges and entitlements are added afterwards.'
              : 'Update the add-on’s details. Its charges are edited separately.'}
          </SheetDescription>
        </SheetHeader>

        {/*
         * Remounting the form per open (create) or per record (edit) resets
         * react-hook-form's defaults — without the key, opening the drawer for a
         * second add-on would show the first one's values.
         */}
        <div className="flex-1 overflow-y-auto p-4">
          <AddonForm
            key={`${mode}:${defaultValue?.lookupKey ?? 'new'}`}
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
