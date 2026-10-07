import { useMemo, useState } from 'react'
import { type CloneFeature, DEFAULT_PLAN_QUERY, type Feature, type FeatureQuery } from '@fp/domain'
import {
  ApiError,
  useCloneFeature,
  useDeleteFeature,
  useFeatureLinkage,
  useFeatures,
  usePlans,
} from '@fp/query'
import { FeatureCloneDialog, FeatureGrid, type ProductLinkage } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { GaugeIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'
import { toSubmitError } from './featureMessages'

export interface FeatureListPageProps {
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  onCreateFeature: () => void
  /** Entitlements are granted by plans, so this goes to where one is added. */
  onCreateEntitlement: (feature: Feature) => void
  onEditFeature: (feature: Feature) => void
  onOpenFeature: (feature: Feature) => void
}

/**
 * The feature surface: a list. Create and edit are full pages (`FeatureFormPage`);
 * clone and delete are small confirmations that stay here. Names rename inline.
 */
export function FeatureListPage({
  query,
  onQueryChange,
  onCreateFeature,
  onCreateEntitlement,
  onEditFeature,
  onOpenFeature,
}: FeatureListPageProps) {
  const features = useFeatures(query)
  const clone = useCloneFeature()
  const remove = useDeleteFeature()

  const [cloning, setCloning] = useState<Feature | null>(null)
  const [deleting, setDeleting] = useState<Feature | null>(null)

  const onCreate = onCreateFeature
  const closeClone = () => {
    setCloning(null)
    clone.reset()
  }
  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  const submitClone = (draft: CloneFeature) => {
    if (cloning) clone.mutate({ id: cloning.id, draft }, { onSuccess: closeClone })
  }
  const failure = toFailure(features.error)
  const rows = useMemo(() => features.data?.features ?? [], [features.data])

  // Plans, entitlements and subscriptions per product, for the rows on screen.
  const rowIds = useMemo(() => rows.map((row) => row.id), [rows])
  const linked = useFeatureLinkage(rowIds)
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, pageSize: 100 }, { enabled: rowIds.length > 0 })
  const linkage = useMemo(() => {
    const names = new Map((plans.data?.plans ?? []).map((plan) => [plan.id, plan.name]))
    const out = new Map<string, ProductLinkage>()
    for (const [featureId, entry] of linked.byFeature) {
      out.set(featureId, {
        plans: entry.planIds.map((id) => ({ id, name: names.get(id) ?? id })),
        entitlements: entry.entitlements,
        subscriptions: entry.subscriptions,
      })
    }
    return out
  }, [linked.byFeature, plans.data])
  const isFiltered = query.search.length > 0 || query.types.length > 0 || query.statuses.length > 0
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', types: [], statuses: [], page: 1 })

  return (
    <>
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
          createAction={<Button onClick={onCreate}>New product</Button>}
          emptyIcon={<GaugeIcon aria-hidden />}
          emptyTitle="Nothing is being measured yet"
          emptyDescription="A product is what you meter or gate — API calls, seats, SSO. Plans price them and entitlements limit them, so this is the first thing to create."
        >
          {/*
            No onFeatureClick: the feature detail page is not built yet, and a
            row that navigates nowhere useful — the old behaviour dropped the
            name into the search box — is worse than a row that does nothing.
          */}
          <FeatureGrid
            features={rows}
            linkage={linkage}
            linkageLoading={linked.isPending || plans.isPending}
            onCreateEntitlement={onCreateEntitlement}
            total={features.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onFeatureClick={onOpenFeature}
            onCreate={onCreate}
            onEdit={onEditFeature}
            onClone={setCloning}
            onDelete={setDeleting}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <FeatureCloneDialog
        open={cloning !== null}
        onOpenChange={(open) => {
          if (!open) closeClone()
        }}
        source={cloning}
        onSubmit={submitClone}
        isSubmitting={clone.isPending}
        submitError={toSubmitError(clone.error, 'clone')}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title="Delete product"
        description={`Delete ${deleting?.name ?? 'this product'}? Plans and entitlements that use it lose it.`}
        confirmLabel="Delete product"
        destructive
        isPending={remove.isPending}
        error={toSubmitError(remove.error, 'delete')}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: closeDelete })
        }}
      />
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
        return { message: 'You do not have access to products here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading products.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading products.', canRetry: true }
}
