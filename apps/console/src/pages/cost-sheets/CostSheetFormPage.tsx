import { costSheetToEdit, type CreateCostSheet } from '@fp/domain'
import { useCostSheet, useCreateCostSheet, useUpdateCostSheet } from '@fp/query'
import { CostSheetForm } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import { toSubmitError } from './costSheetMessages'

export type CostSheetFormPageProps = {
  /** Back to where the person came from (the list or the detail page). */
  onCancel: () => void
  onNavigateToList: () => void
} & (
  | { mode: 'create'; onDone: (costSheetId: string) => void }
  | { mode: 'edit'; costSheetId: string; onDone: (costSheetId: string) => void }
)

/**
 * Create or edit a cost sheet on its own page.
 *
 * Same form both ways (`CostSheetForm`). Create ends on the new cost sheet's
 * detail page; edit returns to where it came from.
 */
export function CostSheetFormPage(props: CostSheetFormPageProps) {
  const { onCancel, onNavigateToList } = props
  const create = useCreateCostSheet()
  const update = useUpdateCostSheet()
  const existing = useCostSheet(props.mode === 'edit' ? props.costSheetId : '')

  if (props.mode === 'create') {
    return (
      <CostSheetForm
        mode="create"
        trail={[
          { label: 'Cost sheets', onClick: onNavigateToList },
          { label: 'Create cost sheet' },
        ]}
        onCancel={onCancel}
        isSubmitting={create.isPending}
        // The API's refusal is a toast (MutationToasts); validation stays in the form.
        submitError={null}
        onSubmit={(draft: CreateCostSheet) =>
          create.mutate(draft, {
            onSuccess: (created) => {
              // The create response is the record itself (or wraps it under `costsheet`).
              const wire = created as { id?: string; costsheet?: { id?: string } }
              props.onDone(wire.id ?? wire.costsheet?.id ?? '')
            },
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
          title="This cost sheet could not be loaded"
          detail="Try again, or go back."
          onRetry={existing.error ? () => void existing.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  const costSheet = existing.data
  return (
    <CostSheetForm
      mode="edit"
      defaultValue={costSheetToEdit(costSheet)}
      trail={[
        { label: 'Cost sheets', onClick: onNavigateToList },
        { label: 'Cost sheet details', onClick: () => props.onDone(costSheet.id) },
        { label: 'Edit' },
      ]}
      onCancel={onCancel}
      isSubmitting={update.isPending}
      submitError={toSubmitError(update.error)}
      onSubmit={(draft: CreateCostSheet) =>
        update.mutate({ id: costSheet.id, draft }, { onSuccess: () => props.onDone(costSheet.id) })
      }
    />
  )
}
