import { type CreatePlan } from '@fp/domain'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/primitives/sheet'
import { provenance } from '@ui/provenance'
import { PlanForm } from './PlanForm'

/**
 * The plan editor, as a right-hand drawer.
 *
 * The same drawer shape as `AddonEditorSheet` — the list stays visible behind
 * it, V1's own choice for plan details — carrying the plan form instead. The
 * page owns when it is open and what a submit does.
 */
export const PlanEditorSheetProvenance = provenance({
  source: 'composition',
  composes: ['ui/sheet'],
  note: 'The plan details form in a drawer, so the list stays visible behind it.',
})

export interface PlanEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreatePlan
  onSubmit: (plan: CreatePlan) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function PlanEditorSheet({
  open,
  onOpenChange,
  mode,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: PlanEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{mode === 'create' ? 'New plan' : 'Edit plan'}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Create the plan. Charges and entitlements are added afterwards.'
              : 'Update the plan’s details. Its charges are edited separately.'}
          </SheetDescription>
        </SheetHeader>

        {/*
         * Remounting the form per record resets react-hook-form's defaults —
         * without the key, opening the drawer for a second plan would show the
         * first one's values. Create keys on a constant, so it resets each open.
         */}
        <div className="flex-1 overflow-y-auto p-4">
          <PlanForm
            key={mode === 'edit' ? `edit:${defaultValue?.name ?? ''}:${defaultValue?.lookupKey ?? ''}` : 'create'}
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
