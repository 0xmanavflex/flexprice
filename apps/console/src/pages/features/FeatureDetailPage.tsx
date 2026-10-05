import { useState } from 'react'
import { type CloneFeature } from '@fp/domain'
import {
  ApiError,
  useCloneFeature,
  useDeleteFeature,
  useFeature,
  useUpdateFeature,
} from '@fp/query'
import { FeatureCloneDialog, FeatureDetailView, type FeatureTab } from '@fp/ui/pages'
import { AppFailure, ConfirmDialog, LoadingRows, PageBody } from '@fp/ui/compositions'
import { toSubmitError } from './featureMessages'

export interface FeatureDetailPageProps {
  onEdit: (featureId: string) => void
  featureId: string
  onNavigateToList: () => void
}

/**
 * One feature, in full: data and mutations here, the view in `@fp/ui`.
 *
 * Name and description save for real (per value, or together from the header
 * Edit, which opens Information). "Edit configuration" opens the stepped form.
 * The usage chart, plans-attached list and usage alerts are demo content in the
 * view, labelled as such: V2 has no read hook for any of them yet.
 */
export function FeatureDetailPage({ featureId, onNavigateToList, onEdit }: FeatureDetailPageProps) {
  const feature = useFeature(featureId)
  const [tab, setTab] = useState<FeatureTab>('overview')
  const update = useUpdateFeature()
  const clone = useCloneFeature()
  const remove = useDeleteFeature()
  const [cloning, setCloning] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (feature.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (feature.error) {
    return (
      <PageBody>
        <AppFailure
          title={failureTitle(feature.error)}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={() => void feature.refetch()}
        />
      </PageBody>
    )
  }

  if (!feature.data) {
    return (
      <PageBody>
        <AppFailure
          title="This feature no longer exists"
          detail="It may have been deleted. Everything else in the catalogue still works."
          onRetry={onNavigateToList}
        />
      </PageBody>
    )
  }

  const data = feature.data

  const closeClone = () => {
    setCloning(false)
    clone.reset()
  }
  const closeDelete = () => {
    setDeleting(false)
    remove.reset()
  }
  const submitClone = (draft: CloneFeature) =>
    clone.mutate({ id: data.id, draft }, { onSuccess: closeClone })

  return (
    <>
      <FeatureDetailView
        feature={data}
        tab={tab}
        onTabChange={setTab}
        onBack={onNavigateToList}
        onEditConfiguration={() => onEdit(featureId)}
        onDuplicate={() => setCloning(true)}
        onDelete={() => setDeleting(true)}
        onSave={(changes) =>
          update.mutateAsync({
            id: data.id,
            draft: {
              name: changes.name ?? data.name,
              ...(changes.description !== undefined ? { description: changes.description } : {}),
            },
          })
        }
      />
      <FeatureCloneDialog
        open={cloning}
        onOpenChange={(open) => {
          if (!open) closeClone()
        }}
        source={data}
        onSubmit={submitClone}
        isSubmitting={clone.isPending}
        submitError={toSubmitError(clone.error, 'clone')}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title="Delete feature"
        description={`Delete ${data.name}? Plans and entitlements that use it lose it.`}
        confirmLabel="Delete feature"
        destructive
        isPending={remove.isPending}
        error={toSubmitError(remove.error, 'delete')}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => {
              closeDelete()
              onNavigateToList()
            },
          })
        }
      />
    </>
  )
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to this feature.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again.'
      case 'network':
        return 'Could not reach Flexprice.'
      default:
        return 'This feature could not be loaded.'
    }
  }
  return 'This feature could not be loaded.'
}
