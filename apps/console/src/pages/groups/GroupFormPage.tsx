import { type CreateGroup } from '@fp/domain'
import { ApiError, useCreateGroup, serverReason } from '@fp/query'
import { GroupForm } from '@fp/ui/pages'

export interface GroupFormPageProps {
  onCancel: () => void
  /** Called with the new group's id, or `''` when the response did not name one. */
  onDone: (groupId: string) => void
}

/**
 * Create a group on a compact full page, `/groups/new`.
 *
 * Three fields and no update route, so it is create only. Success lands on the
 * new group's detail page.
 */
export function GroupFormPage({ onCancel, onDone }: GroupFormPageProps) {
  const create = useCreateGroup()

  return (
    <GroupForm
      trail={[{ label: 'Groups', onClick: onCancel }, { label: 'Create group' }]}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      // The API's refusal is a toast (MutationToasts); validation stays in the form.
      submitError={null}
      onSubmit={(draft: CreateGroup) =>
        create.mutate(draft, {
          onSuccess: (created) => onDone((created as { id?: string }).id ?? ''),
        })
      }
    />
  )
}

/** A save failure, as a sentence the form can show inline. */
export function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change groups here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? 'Could not save the group. Try again.'
    }
  }
  return 'Could not save the group. Try again.'
}
