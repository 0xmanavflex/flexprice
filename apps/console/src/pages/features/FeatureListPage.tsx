import { type Feature, type FeatureQuery } from '@fp/domain'
import { ApiError, useFeatures } from '@fp/query'
import { FeatureGrid } from '@fp/ui/flexprice'

export interface FeatureListPageProps {
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  onCreate: () => void
  onOpenFeature: (feature: Feature) => void
}

/**
 * The wiring layer, and nothing else.
 *
 * Replaces V1's `Features.tsx`, which additionally owns drawer state for
 * editing and reaches into `FeatureApi` directly. This fetches, turns an error
 * into a sentence, and hands the grid plain props. No `useState`: the query
 * lives in the URL.
 */
export function FeatureListPage({
  query,
  onQueryChange,
  onCreate,
  onOpenFeature,
}: FeatureListPageProps) {
  const features = useFeatures(query)

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Features</h1>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium"
        >
          New feature
        </button>
      </div>

      <FeatureGrid
        features={features.data?.features ?? []}
        total={features.data?.total ?? 0}
        query={query}
        onQueryChange={onQueryChange}
        isLoading={features.isPending}
        error={toMessage(features.error)}
        onRetry={() => void features.refetch()}
        onFeatureClick={onOpenFeature}
      />
    </main>
  )
}

function toMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to features in this environment.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again to continue.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return error.message
    }
  }
  return 'Something went wrong loading features.'
}
