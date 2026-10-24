import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  type Addon,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreditGrant,
  type EditCreditGrant,
  type EditEntitlement,
  type Entitlement,
  CreditGrantScope,
  DEFAULT_FEATURE_QUERY,
  EntitlementEntityType,
  FeatureType,
  PriceEntityType,
  creditGrantToEdit,
  entitlementToEdit,
} from '@fp/domain'
import {
  useAddon,
  useCreateBulkEntitlements,
  useCreateCreditGrant,
  useCreditGrants,
  useDeleteAddon,
  useDeleteCreditGrant,
  useDeleteEntitlement,
  useEntitlements,
  useFeatures,
  usePrices,
  useUpdateAddon,
  useUpdateCreditGrant,
  useUpdateEntitlement,
} from '@fp/query'
import {
  AddonSubscriptionsView,
  CatalogDetailFrame,
  CatalogStatusBadge,
  CreditGrantCreateForm,
  CreditGrantEditForm,
  CreditGrantTable,
  EntitlementCreateForm,
  EntitlementEditForm,
  EntitlementTable,
  type FeatureOption,
  Pill,
} from '@fp/ui/pages'
import { ConfirmDialog, EditableCard, FormDialog, MetadataCard } from '@fp/ui/compositions'
import { ArchiveIcon, PencilIcon, PuzzleIcon } from '@fp/ui/icons'
import { detailGate } from '../shared/detailGate'
import { subTab } from '../shared/subTab'
import { CatalogCharges } from '../shared/CatalogCharges'

export interface AddonDetailPageProps {
  addonId: string
  /** Open with the details already in edit mode (the list row's Edit). */
  startEditing?: boolean
  onNavigateToList: () => void
}

/** The tabs, in order. Overview leads with the add-on's prices. */
type AddonTab = 'charges' | 'entitlements' | 'credit-grants' | 'subscriptions' | 'information'

/**
 * One add-on, in full.
 *
 * The shared detail shell — a large title with its status badge and lookup key,
 * an Edit action, and a metric rail of the numbers that say what the add-on
 * bills — then a set of tabs that mirror the plan: the prices it carries, the
 * entitlements it grants, the credit grants it hands subscribers, and the record
 * itself. An add-on shares a plan's charges, entitlements, and credit grants, so
 * it reuses the exact same read tables and editors rather than restating them.
 *
 * Name and description edit in place on the Information tab (`EditableFields`):
 * the header Edit turns them all into inputs at once, with no edit page. Adding or editing an entitlement or credit grant opens its
 * form in a `FormDialog`.
 *
 * The page fetches and composes; every relational section is a presentational
 * component from `@fp/ui`, and every destructive action passes through a
 * `ConfirmDialog` — a charge is terminated, an entitlement or grant removed, only
 * after a confirming beat.
 */
export function AddonDetailPage({
  addonId,
  startEditing = false,
  onNavigateToList,
}: AddonDetailPageProps) {
  const addon = useAddon(addonId)
  const update = useUpdateAddon()
  const remove = useDeleteAddon()
  // Fetched here too (deduped by react-query) so the rail can carry real counts.
  const prices = usePrices(PriceEntityType.Addon, addonId)
  const entitlements = useEntitlements(EntitlementEntityType.Addon, addonId)
  const grants = useCreditGrants(CreditGrantScope.Addon, addonId)

  const [tab, setTab] = useState<AddonTab>(startEditing ? 'information' : 'charges')
  const [archiving, setArchiving] = useState(false)

  if (!addon.data) {
    return detailGate(addon, {
      noun: 'this add-on',
      listName: 'add-ons',
      onBack: onNavigateToList,
      recordPath: `/addons/${encodeURIComponent(addonId)}`,
    })
  }

  const data = addon.data
  const chargeCount = (prices.data ?? []).length
  const entitlementCount = (entitlements.data ?? []).length
  const badges = (
    <>
      <CatalogStatusBadge status={data.status} />
      <Pill>
        {chargeCount} {chargeCount === 1 ? 'charge' : 'charges'}
      </Pill>
    </>
  )

  return (
    <CatalogDetailFrame
      listLabel="Add-ons"
      onBack={onNavigateToList}
      icon={<PuzzleIcon />}
      title={data.name}
      badges={badges}
      id={data.lookupKey || data.id}
      menuLabel="Add-on actions"
      menu={[
        {
          id: 'edit-details',
          label: 'Edit details',
          icon: <PencilIcon className="text-muted-foreground" aria-hidden />,
          onSelect: () => setTab('information'),
        },
        {
          id: 'archive',
          label: 'Archive',
          icon: <ArchiveIcon aria-hidden />,
          destructive: true,
          disabled: data.status === 'archived',
          onSelect: () => setArchiving(true),
        },
      ]}
      tab={tab}
      onTabChange={(next) => setTab(next as AddonTab)}
      tabs={[
        {
          value: 'charges',
          label: 'Charges',
          ...(prices.data ? { count: chargeCount } : {}),
          content: (
            <CatalogCharges
              entityType={PriceEntityType.Addon}
              entityId={addonId}
              noun="add-on"
              emptyDescription="This add-on bills nothing until it has a charge."
            />
          ),
        },
        {
          value: 'entitlements',
          label: 'Entitlements',
          ...(entitlements.data ? { count: entitlementCount } : {}),
          content: <EntitlementsTab addonId={addonId} />,
        },
        {
          value: 'credit-grants',
          label: 'Credit grants',
          ...(grants.data ? { count: grants.data.length } : {}),
          content: <CreditGrantsTab addonId={addonId} />,
        },
        { value: 'subscriptions', label: 'Contracts', content: <AddonSubscriptionsView /> },
        {
          value: 'information',
          label: 'Information',
          content: (
            <InformationTab
              addon={data}
              onSave={(patch) =>
                update
                  .mutateAsync({
                    id: data.id,
                    draft: {
                      name: data.name,
                      lookupKey: data.lookupKey,
                      description: data.description,
                      ...patch,
                    },
                  })
                  .then(() => undefined)
              }
            />
          ),
        },
      ]}
    >
      <ConfirmDialog
        open={archiving}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(false)
            remove.reset()
          }
        }}
        title="Archive add-on"
        description={`Archive ${data.name}? Subscriptions already using it keep it, but it can no longer be added.`}
        confirmLabel="Archive add-on"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not archive the add-on. Try again.' : null}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => {
              setArchiving(false)
              onNavigateToList()
            },
          })
        }
      />
    </CatalogDetailFrame>
  )
}

/** Entitlements — what the add-on includes of each feature. Removal is confirmed. */
function EntitlementsTab({ addonId }: { addonId: string }) {
  const navigate = useNavigate()
  const entitlements = useEntitlements(EntitlementEntityType.Addon, addonId)
  const features = useFeatures({ ...DEFAULT_FEATURE_QUERY, pageSize: 100, filters: [] })
  const create = useCreateBulkEntitlements()
  const updateEntitlement = useUpdateEntitlement()
  const remove = useDeleteEntitlement()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Entitlement | null>(null)
  const [target, setTarget] = useState<Entitlement | null>(null)

  // Only features not already entitled can be added — a feature is granted once.
  const granted = new Set((entitlements.data ?? []).map((e) => e.featureId))
  const toOption = (f: NonNullable<typeof features.data>['features'][number]): FeatureOption => ({
    id: f.id,
    name: f.name,
    type: f.type,
    ...(f.type === FeatureType.Metered && f.unitPlural ? { unit: f.unitPlural } : {}),
  })
  const allFeatures = features.data?.features ?? []
  const options = allFeatures.filter((f) => !granted.has(f.id)).map(toOption)
  const editingFeature = editing ? allFeatures.find((f) => f.id === editing.featureId) : undefined

  const submit = (draft: CreateEntitlement) => {
    create.mutate(
      { entityType: EntitlementEntityType.Addon, entityId: addonId, entitlements: [draft] },
      { onSuccess: () => setAdding(false) },
    )
  }

  const submitEdit = (draft: EditEntitlement) => {
    if (!editing) return
    updateEntitlement.mutate({ id: editing.id, draft }, { onSuccess: () => setEditing(null) })
  }

  const close = () => {
    setTarget(null)
    remove.reset()
  }

  const form = adding ? (
    <EntitlementCreateForm
      features={options}
      onSubmit={submit}
      onCancel={() => setAdding(false)}
      isSubmitting={create.isPending}
      submitError={create.isError ? 'Could not add the entitlement. Try again.' : null}
    />
  ) : editing ? (
    <EntitlementEditForm
      feature={
        editingFeature
          ? toOption(editingFeature)
          : {
              id: editing.featureId,
              name: editing.featureName ?? 'Feature',
              type: editing.featureType,
            }
      }
      defaultValue={entitlementToEdit(editing)}
      onSubmit={submitEdit}
      onCancel={() => setEditing(null)}
      isSubmitting={updateEntitlement.isPending}
      submitError={updateEntitlement.isError ? 'Could not save the entitlement. Try again.' : null}
    />
  ) : undefined

  return (
    <>
      <EntitlementTable
        showTitle
        entitlements={entitlements.data ?? []}
        {...subTab(entitlements, 'entitlements')}
        onAdd={() => setAdding(true)}
        onEdit={(entitlement) => setEditing(entitlement)}
        onDelete={(entitlement) => setTarget(entitlement)}
        onOpenFeature={(featureId) =>
          void navigate({ to: '/features/$featureId', params: { featureId } })
        }
      />
      <FormDialog
        open={adding || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false)
            setEditing(null)
          }
        }}
        title={editing ? 'Edit entitlement' : 'Add entitlement'}
      >
        {form}
      </FormDialog>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Remove this entitlement?"
        description={`“${target?.featureName || 'This feature'}” will no longer be included in the add-on.`}
        confirmLabel="Remove entitlement"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not remove the entitlement. Try again.' : null}
        onConfirm={() => {
          if (target) remove.mutate(target.id, { onSuccess: () => setTarget(null) })
        }}
      />
    </>
  )
}

/** Credit Grants — the balances the add-on hands its subscribers. Removal is confirmed. */
function CreditGrantsTab({ addonId }: { addonId: string }) {
  const grants = useCreditGrants(CreditGrantScope.Addon, addonId)
  const create = useCreateCreditGrant()
  const updateGrant = useUpdateCreditGrant()
  const remove = useDeleteCreditGrant()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CreditGrant | null>(null)
  const [target, setTarget] = useState<CreditGrant | null>(null)

  const submit = (grant: CreateCreditGrant) => {
    create.mutate(
      { scope: CreditGrantScope.Addon, id: addonId, grant },
      { onSuccess: () => setAdding(false) },
    )
  }

  const submitEdit = (draft: EditCreditGrant) => {
    if (!editing) return
    updateGrant.mutate({ id: editing.id, draft }, { onSuccess: () => setEditing(null) })
  }

  const close = () => {
    setTarget(null)
    remove.reset()
  }

  const form = adding ? (
    <CreditGrantCreateForm
      onSubmit={submit}
      onCancel={() => setAdding(false)}
      isSubmitting={create.isPending}
      submitError={create.isError ? 'Could not create the grant. Try again.' : null}
    />
  ) : editing ? (
    <CreditGrantEditForm
      defaultValue={creditGrantToEdit(editing)}
      onSubmit={submitEdit}
      onCancel={() => setEditing(null)}
      isSubmitting={updateGrant.isPending}
      submitError={updateGrant.isError ? 'Could not save the grant. Try again.' : null}
    />
  ) : undefined

  return (
    <>
      <CreditGrantTable
        showTitle
        grants={grants.data ?? []}
        {...subTab(grants, 'credit grants')}
        onAdd={() => setAdding(true)}
        onEdit={(grant) => setEditing(grant)}
        onDelete={(grant) => setTarget(grant)}
      />
      <FormDialog
        open={adding || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false)
            setEditing(null)
          }
        }}
        title={editing ? 'Edit credit grant' : 'Add credit grant'}
      >
        {form}
      </FormDialog>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Remove this credit grant?"
        description={`“${target?.name || 'This grant'}” will no longer be included in the add-on.`}
        confirmLabel="Remove grant"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not remove the grant. Try again.' : null}
        onConfirm={() => {
          if (target) remove.mutate(target.id, { onSuccess: () => setTarget(null) })
        }}
      />
    </>
  )
}

/**
 * Information — one pencil edits the name and description in place; the rest
 * is read-only. The metadata card beside it edits, adds and removes fields.
 */
function InformationTab({
  addon,
  onSave,
}: {
  addon: Addon
  onSave: (patch: {
    name?: string
    description?: string
    metadata?: Record<string, string>
  }) => Promise<void>
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-3">
      <EditableCard
        className="xl:col-span-2"
        title="Add-on details"
        locked={addon.status === 'archived'}
        fields={[
          { key: 'name', label: 'Name', value: addon.name, required: true },
          {
            // Integrations key off it, so the API never lets it change.
            key: 'lookupKey',
            label: 'Lookup key',
            value: addon.lookupKey,
            display: <span className="font-mono text-[13px]">{addon.lookupKey}</span>,
            readOnly: true,
          },
          { key: 'created', label: 'Created', value: formatDate(addon.createdAt), readOnly: true },
          { key: 'updated', label: 'Updated', value: formatDate(addon.updatedAt), readOnly: true },
          {
            key: 'description',
            label: 'Description',
            value: addon.description ?? '',
            multiline: true,
            placeholder: 'No description',
          },
        ]}
        onSave={(changes) => onSave(changes)}
      />
      <MetadataCard
        metadata={addon.metadata ?? {}}
        {...(addon.status === 'archived'
          ? {}
          : { onSave: (metadata: Record<string, string>) => onSave({ metadata }) })}
      />
    </div>
  )
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}
