import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_RAW_EVENT_QUERY,
  GroupEntityType,
  eventPropertyNames,
  type CreateFeature,
  type EditFeature,
} from '@fp/domain'
import {
  useCreateFeature,
  useFeature,
  useGroupPicker,
  useRawEvents,
  useUpdateFeature,
} from '@fp/query'
import { FeatureForm } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import { expressionFieldError, toSubmitError } from './featureMessages'

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
 * The data layer is the hooks the dialogs used: nothing about saving changed.
 */
export function FeatureFormPage(props: FeatureFormPageProps) {
  const { onCancel } = props
  const create = useCreateFeature()
  const update = useUpdateFeature()
  const existing = useFeature(props.mode === 'edit' ? props.featureId : '')
  // Type-filtered and paged: a label past the first hundred remains selectable.
  const groups = useGroupPicker(GroupEntityType.Feature)
  const groupOptions = useMemo(
    () => (groups.data?.groups ?? []).map((group) => ({ value: group.id, label: group.name })),
    [groups.data],
  )
  const eventProperties = useEventProperties()
  const formProps = { onCancel, groups: groupOptions, ...eventProperties }

  if (props.mode === 'create') {
    return (
      <FeatureForm
        mode="create"
        trail={[{ label: 'Features', onClick: onCancel }, { label: 'Create feature' }]}
        {...formProps}
        isSubmitting={create.isPending}
        submitError={toSubmitError(create.error)}
        expressionError={expressionFieldError(create.error)}
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
      expressionError={expressionFieldError(update.error)}
      onSubmit={(draft: EditFeature) =>
        update.mutate({ id: feature.id, draft }, { onSuccess: () => props.onDone(feature.id) })
      }
    />
  )
}

/**
 * The property names on recent events with the name typed into the form: the
 * variables a custom expression can use. The name is read after a pause in
 * typing, and nothing is fetched until there is one.
 */
function useEventProperties() {
  const [typed, setTyped] = useState('')
  const [eventName, setEventName] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setEventName(typed), 400)
    return () => window.clearTimeout(timer)
  }, [typed])
  const events = useRawEvents(
    { ...DEFAULT_RAW_EVENT_QUERY, search: eventName, pageSize: 50 },
    { enabled: eventName.length > 0 },
  )
  const eventProperties = useMemo(
    () => (eventName ? eventPropertyNames(events.data?.events ?? [], eventName) : []),
    [events.data, eventName],
  )
  return { eventProperties, onEventNameChange: setTyped }
}
