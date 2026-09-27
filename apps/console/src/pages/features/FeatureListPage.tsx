import { type Feature, type FeatureQuery } from '@fp/domain'
import { ApiError, useFeatures } from '@fp/query'
import { FeatureFilters, FeatureGrid } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { GaugeIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

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

  const failure = toFailure(features.error)
  const rows = features.data?.features ?? []
  const isFiltered =
    query.search.length > 0 || query.types.length > 0 || query.statuses.length > 0
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', types: [], statuses: [], page: 1 })

  return (
    <>
      <PageHeader
        title="Features"
        description="What you meter, and what customers are entitled to."
        action={<Button onClick={onCreate}>New feature</Button>}
      />

      <PageBody>
        {/*
          Every state comes from one place, so this screen cannot invent its
          own. Loading, both empties and both errors are inherited and already
          tested.
        */}
        {/*
          `isEmpty` is only true when the catalogue itself is empty. When a
          filter is responsible, the grid keeps its own toolbar and says "no
          features match these filters" in the table body — replacing the whole
          grid would take the search box away with it, leaving no way to undo
          the search that caused the emptiness.
        */}
        <ListState
          isLoading={features.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void features.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={onCreate}>New feature</Button>}
          emptyIcon={<GaugeIcon aria-hidden />}
          emptyTitle="Nothing is being measured yet"
          emptyDescription="A Feature is what you meter or gate — API calls, seats, SSO. Plans price them and entitlements limit them, so this is the first thing to create."
        >
          <FeatureGrid
            features={rows}
            total={features.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onFeatureClick={onOpenFeature}
            onClearFilters={clearFilters}
            filters={
              <FeatureFilters
                types={query.types}
                statuses={query.statuses}
                onChange={({ types, statuses }) =>
                  onQueryChange({ ...query, types, statuses, page: 1 })
                }
              />
            }
          />
        </ListState>
      </PageBody>
    </>
  )
}

/**
 * A failure, as a sentence and a judgement about whether retrying can help.
 *
 * `canRetry` is the important half: a permission error offers no retry, because
 * pressing the button again cannot change the answer.
 */
function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to features here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading features.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading features.', canRetry: true }
}
