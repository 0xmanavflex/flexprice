import { useMemo } from 'react'
import {
  DEFAULT_GROUP_QUERY,
  GroupEntityType,
  type CreateFeature,
  type EditFeature,
} from '@fp/domain'
import { useCreateFeature, useFeature, useGroups, useUpdateFeature } from '@fp/query'
import { FeatureForm } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import { toSubmitError } from './featureMessages'

export type FeatureFormPageProps = {
  onCancel: () => void
} & (
  | { mode: 'create'; onDone: (featureId: string) => void }
  | { mode: 'edit'; featureId: string; onDone: (featureId: string) => void }
)

/**
 * Create or edit a feature on its own page.
 *
 * Same single-page form both ways (`FeatureForm`). Create
 * ends on the new feature's detail page; edit returns to the one it came from.
 * The data layer is the hooks the dialogs used — nothing about saving changed.
 */
export function FeatureFormPage(props: FeatureFormPageProps) {
  const { onCancel } = props
  const create = useCreateFeature()
  const update = useUpdateFeature()
  const existing = useFeature(props.mode === 'edit' ? props.featureId : '')
  /*
   * Feature labels, narrowed by the server.
   *
   * This used to fetch the first hundred groups of *any* kind and keep the
   * feature ones in the browser. With a hundred price groups ahead of them
   * the picker came back empty, which reads as "there are no labels" — the
   * bug this page was reported for. `entityType` is a filter the search
   * endpoint honours, checked against the live API.
   */
  const groups = useGroups({
    ...DEFAULT_GROUP_QUERY,
    pageSize: 100,
    entityType: GroupEntityType.Feature,
  })
  const groupOptions = useMemo(
    () => (groups.data?.groups ?? []).map((group) => ({ value: group.id, label: group.name })),
    [groups.data],
  )
  const formProps = { onCancel, groups: groupOptions }

  if (props.mode === 'create') {
    return (
      <FeatureForm
        mode="create"
        trail={[{ label: 'Features', onClick: onCancel }, { label: 'Create feature' }]}
        {...formProps}
        isSubmitting={create.isPending}
        // The API's refusal is a toast (MutationToasts); validation stays in the form.
        submitError={null}
        onSubmit={(draft: CreateFeature) =>
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
          title="This feature could not be loaded"
          detail="Try again, or go back."
          onRetry={existing.error ? () => void existing.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  const feature = existing.data
  return (
    <FeatureForm
      mode="edit"
      feature={feature}
      trail={[
        { label: 'Features', onClick: onCancel },
        { label: 'Feature details', onClick: () => props.onDone(feature.id) },
        { label: 'Edit' },
      ]}
      {...formProps}
      isSubmitting={update.isPending}
      submitError={toSubmitError(update.error)}
      onSubmit={(draft: EditFeature) =>
        update.mutate({ id: feature.id, draft }, { onSuccess: () => props.onDone(feature.id) })
      }
    />
  )
}
