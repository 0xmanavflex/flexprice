import { ApiError, useCreateFeature } from '@fp/query'
import { FeatureForm } from '@fp/ui/flexprice'

export interface FeatureCreatePageProps {
  onCreated: () => void
  onCancel: () => void
}

/**
 * Creating a feature, as a page.
 *
 * V1 does this at `/features/add` too, so the comparison is like-for-like: the
 * change is what the page contains, not where it lives. `AddFeature.tsx` is
 * 1,106 lines holding a bespoke form hook, four state slices and two validator
 * callbacks. This is the wiring.
 */
export function FeatureCreatePage({ onCreated, onCancel }: FeatureCreatePageProps) {
  const create = useCreateFeature()

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto p-6">
      <FeatureForm
        onSubmit={(draft) => create.mutate(draft, { onSuccess: onCreated })}
        onCancel={onCancel}
        isSubmitting={create.isPending}
        submitError={toMessage(create.error)}
      />
    </main>
  )
}

function toMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    // Field-level detail the API sent, when it sent any — a duplicate lookup
    // key is the common case and is worth naming precisely.
    const detail = error.details ? Object.values(error.details)[0] : undefined
    if (detail) return detail
    if (error.kind === 'forbidden') return 'You do not have permission to create features.'
    return error.message
  }
  return 'Could not create the feature.'
}
