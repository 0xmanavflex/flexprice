import { useMemo, useState } from 'react'
import {
  DEFAULT_FEATURE_QUERY,
  isFeatureQueryFiltered,
  DEFAULT_GROUP_QUERY,
  GroupEntityType,
  type CloneFeature,
  type Feature,
  type FeatureQuery,
} from '@fp/domain'
import {
  useCloneFeature,
  useDeleteFeature,
  useFeatureLinkage,
  useFeatures,
  useGroups,
} from '@fp/query'
import { FeatureCloneDialog, FeatureGrid, type FeatureLinkage } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toSubmitError } from './featureMessages'
import { FeatureEntitlementDialog } from './FeatureEntitlementDialog'
import { toListFailure } from '../shared/listFailure'

export interface FeatureListPageProps {
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  onCreateFeature: () => void
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
  onEditFeature,
  onOpenFeature,
}: FeatureListPageProps) {
  const features = useFeatures(query)
  const clone = useCloneFeature()
  const remove = useDeleteFeature()

  const [cloning, setCloning] = useState<Feature | null>(null)
  const [deleting, setDeleting] = useState<Feature | null>(null)
  const [entitling, setEntitling] = useState<Feature | null>(null)

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
  const failure = toListFailure(features.error, 'features')
  const rows = useMemo(() => features.data?.features ?? [], [features.data])

  /*
   * Group names for the Group chip.
   *
   * The feature carries only `groupId`: `POST /features/search` refuses
   * `expand=groups` with a 400, so the names are a second read. Narrowed to
   * feature groups server-side, so a hundred price groups cannot crowd them
   * out of the page.
   */
  const groups = useGroups({
    ...DEFAULT_GROUP_QUERY,
    pageSize: 100,
    entityType: GroupEntityType.Feature,
  })
  const groupNames = useMemo(
    () => new Map((groups.data?.groups ?? []).map((group) => [group.id, group.name])),
    [groups.data],
  )

  /*
   * Plans, entitlements and subscriptions per feature, for the rows on screen.
   * A plan counts when it grants the feature (an entitlement) *or* prices it
   * (a charge on its meter), and its name is read for exactly the plans found
   *: not looked up in the first page of plans, which left any plan past it
   * showing as a raw id.
   */
  const linked = useFeatureLinkage(rows)
  const linkage = useMemo(() => {
    const out = new Map<string, FeatureLinkage>()
    for (const [featureId, entry] of linked.byFeature) {
      out.set(featureId, {
        plans: entry.plans,
        entitlements: entry.entitlements,
        subscriptions: entry.subscriptions,
      })
    }
    return out
  }, [linked.byFeature])
  const isFiltered = isFeatureQueryFiltered(query)
  // Back to the default view (published features), not to every status.
  const clearFilters = () =>
    onQueryChange({
      ...query,
      search: '',
      types: [],
      statuses: [],
      filters: DEFAULT_FEATURE_QUERY.filters ?? [],
      page: 1,
    })

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
          features match these filters" in the table body: replacing the whole
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
          createAction={<Button onClick={onCreate}>New feature</Button>}
          emptyTitle="Nothing is being measured yet"
          emptyDescription="A feature is what you meter or gate: API calls, seats, SSO. Plans price them and entitlements limit them, so this is the first thing to create."
        >
          <FeatureGrid
            features={rows}
            groupName={(groupId) => groupNames.get(groupId)}
            filterOptions={{
              group_id: (groups.data?.groups ?? []).map((group) => ({
                value: group.id,
                label: group.name,
              })),
            }}
            linkage={linkage}
            linkageLoading={linked.isPending}
            onCreateEntitlement={setEntitling}
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

      <FeatureEntitlementDialog feature={entitling} onClose={() => setEntitling(null)} />

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
        title="Delete feature"
        description={`Archiving ${deleting?.name ?? 'this feature'} is refused while plans or contracts still grant it: remove those entitlements first. Once archived, the feature is no longer offered for new plans or contracts.`}
        confirmLabel="Delete feature"
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
