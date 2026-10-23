import type { CreateAddon } from '@fp/domain'
import { useAddon, useCreateAddon, useUpdateAddon } from '@fp/query'
import { AddonForm } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import { toSubmitError } from './addonMessages'

export type AddonFormPageProps = {
  /** Back to where the person came from (the list or the detail page). */
  onCancel: () => void
  onNavigateToList: () => void
} & (
  | { mode: 'create'; onDone: (addonId: string) => void }
  | { mode: 'edit'; addonId: string; onDone: (addonId: string) => void }
)

/**
 * Create or edit an add-on on its own page.
 *
 * Same form both ways (`AddonForm`). Create ends on the new add-on's detail
 * page, where charges and entitlements are added; edit returns to where it
 * came from. The data layer is the hooks the dialog used.
 */
export function AddonFormPage(props: AddonFormPageProps) {
  const { onCancel, onNavigateToList } = props
  const create = useCreateAddon()
  const update = useUpdateAddon()
  const existing = useAddon(props.mode === 'edit' ? props.addonId : '')

  if (props.mode === 'create') {
    return (
      <AddonForm
        mode="create"
        trail={[{ label: 'Add-ons', onClick: onNavigateToList }, { label: 'Create add-on' }]}
        onCancel={onCancel}
        isSubmitting={create.isPending}
        // The API's refusal is a toast (MutationToasts); validation stays in the form.
        submitError={null}
        onSubmit={(draft: CreateAddon) =>
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
          title="This add-on could not be loaded"
          detail="Try again, or go back."
          onRetry={existing.error ? () => void existing.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  const addon = existing.data
  return (
    <AddonForm
      mode="edit"
      defaultValue={{
        name: addon.name,
        lookupKey: addon.lookupKey,
        description: addon.description,
      }}
      trail={[
        { label: 'Add-ons', onClick: onNavigateToList },
        { label: 'Add-on details', onClick: () => props.onDone(addon.id) },
        { label: 'Edit' },
      ]}
      onCancel={onCancel}
      isSubmitting={update.isPending}
      submitError={toSubmitError(update.error)}
      onSubmit={(draft: CreateAddon) =>
        update.mutate({ id: addon.id, draft }, { onSuccess: () => props.onDone(addon.id) })
      }
    />
  )
}
