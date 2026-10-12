import { useMemo, useState } from 'react'
import { type CloneFeature, type Feature, type FeatureQuery } from '@fp/domain'
import { useCloneFeature, useDeleteFeature, useFeatureLinkage, useFeatures } from '@fp/query'
import { FeatureCloneDialog, FeatureGrid, type ProductLinkage } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { GaugeIcon } from '@fp/ui/icons'
import { Button } from '@fp/ui/primitives'
import { toSubmitError } from './featureMessages'
import { toListFailure } from '../shared/listFailure'

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
  const failure = toListFailure(features.error, 'products')
  const rows = useMemo(() => features.data?.features ?? [], [features.data])

  /*
   * Plans, entitlements and subscriptions per product, for the rows on screen.
   * A plan counts when it grants the product (an entitlement) *or* prices it
   * (a charge on its meter), and its name is read for exactly the plans found
   * — not looked up in the first page of plans, which left any plan past it
   * showing as a raw id.
   */
  const linked = useFeatureLinkage(rows)
  const linkage = useMemo(() => {
    const out = new Map<string, ProductLinkage>()
    for (const [featureId, entry] of linked.byFeature) {
      out.set(featureId, {
        plans: entry.plans,
        entitlements: entry.entitlements,
        subscriptions: entry.subscriptions,
      })
    }
    return out
  }, [linked.byFeature])
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
          isEmpty={rows.length === 0 && (features.data?.total ?? 0) === 0 && !isFiltered}
          hasRows={rows.length > 0}
          isRefreshing={features.isFetching && !features.isPending}
          isProvisional={features.isPlaceholderData}
          isRetrying={features.isFetching && features.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
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
            linkageLoading={linked.isPending}
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
