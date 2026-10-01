import { useState } from 'react'
import { ApiError, useFeature, useUpdateFeature } from '@fp/query'
import { FeatureDetailView, type FeatureTab } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'

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

  return (
    <FeatureDetailView
      feature={data}
      tab={tab}
      onTabChange={setTab}
      onBack={onNavigateToList}
      onEditConfiguration={() => onEdit(featureId)}
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
