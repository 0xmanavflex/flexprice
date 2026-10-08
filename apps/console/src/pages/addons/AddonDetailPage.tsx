import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  type Addon,
  type Charge,
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
  ApiError,
  useAddon,
  useCreateBulkEntitlements,
  useCreateCreditGrant,
  useCreditGrants,
  useDeleteCreditGrant,
  useDeleteEntitlement,
  useEntitlements,
  useFeatures,
  usePrices,
  useTerminatePrice,
  useUpdateAddon,
  useUpdateCreditGrant,
  useUpdateEntitlement,
} from '@fp/query'
import {
  AddonSubscriptionsView,
  CatalogDetailFrame,
  CatalogStatusBadge,
  ChargeTable,
  CreditGrantCreateForm,
  CreditGrantEditForm,
  CreditGrantTable,
  EntitlementCreateForm,
  EntitlementEditForm,
  EntitlementTable,
  type FeatureOption,
  Pill,
} from '@fp/ui/pages'
import {
  AppFailure,
  ConfirmDialog,
  EditableCard,
  FormDialog,
  LoadingRows,
  PageBody,
} from '@fp/ui/compositions'
import { PuzzleIcon } from 'lucide-react'

export interface AddonDetailPageProps {
  addonId: string
  /** Open with the details already in edit mode (the list row's Edit). */
  startEditing?: boolean
  /** Open the full edit form. */
  onEdit?: () => void
  onNavigateToList: () => void
}

/** The tabs, in order. Overview leads with the add-on's prices. */
type AddonTab = 'charges' | 'entitlements' | 'subscriptions' | 'information'

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
  onEdit,
  onNavigateToList,
}: AddonDetailPageProps) {
  const addon = useAddon(addonId)
  const update = useUpdateAddon()
  // Fetched here too (deduped by react-query) so the rail can carry real counts.
  const prices = usePrices(PriceEntityType.Addon, addonId)
  const entitlements = useEntitlements(EntitlementEntityType.Addon, addonId)

  const [tab, setTab] = useState<AddonTab>(startEditing ? 'information' : 'charges')

  if (addon.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (addon.error) {
    return (
      <PageBody>
        <AppFailure
          title={failureTitle(addon.error)}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={() => void addon.refetch()}
        />
      </PageBody>
    )
  }

  if (!addon.data) {
    return (
      <PageBody>
        <AppFailure
          title="This add-on no longer exists"
          detail="It may have been deleted. Everything else in the catalogue still works."
          onRetry={onNavigateToList}
        />
      </PageBody>
    )
  }

  const data = addon.data
  const chargeCount = (prices.data ?? []).length
  const entitlementCount = (entitlements.data ?? []).length
  const badges = (
    <>
      <Pill>
        {chargeCount} {chargeCount === 1 ? 'charge' : 'charges'}
      </Pill>
      <Pill>
        {entitlementCount} {entitlementCount === 1 ? 'entitlement' : 'entitlements'}
      </Pill>
      {data.status === 'archived' ? <CatalogStatusBadge status={data.status} /> : null}
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
      onEdit={() => setTab('information')}
      menuLabel="Add-on actions"
      menu={[
        ...(onEdit ? [{ id: 'edit', label: 'Edit add-on', onSelect: onEdit }] : []),
        {
          id: 'entitlements',
          label: 'Manage entitlements',
          onSelect: () => setTab('entitlements'),
        },
        { id: 'charges', label: 'View charges', onSelect: () => setTab('charges') },
      ]}
      tab={tab}
      onTabChange={(next) => setTab(next as AddonTab)}
      tabs={[
        {
          value: 'charges',
          label: 'Charges',
          ...(prices.isPending ? {} : { count: chargeCount }),
          content: <PricesTab addonId={addonId} />,
        },
        {
          value: 'entitlements',
          label: 'Entitlements',
          ...(entitlements.isPending ? {} : { count: entitlementCount }),
          content: (
            <div className="flex flex-col gap-5">
              <EntitlementsTab addonId={addonId} />
              <CreditGrantsTab addonId={addonId} />
            </div>
          ),
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
    />
  )
}

/** Charges — the prices this add-on carries. Terminating one is confirmed first. */
function PricesTab({ addonId }: { addonId: string }) {
  const charges = usePrices(PriceEntityType.Addon, addonId)
  const terminate = useTerminatePrice()
  const [target, setTarget] = useState<Charge | null>(null)

  if (charges.isPending) return <LoadingRows />

  const close = () => {
    setTarget(null)
    terminate.reset()
  }

  return (
    <>
      {/*
        No add flow yet — an add-on has no charges builder route — so `onAdd` is
        omitted, and with it the "add a charge" instruction: telling someone to
        do a thing this surface offers no way to do is worse than saying
        nothing. The empty copy names the add-on rather than inheriting the
        table's plan wording.
      */}
      <ChargeTable
        charges={charges.data ?? []}
        emptyDescription="This add-on bills nothing until it has a charge."
        onTerminate={(charge) => setTarget(charge)}
      />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Terminate this charge?"
        description={`“${target?.displayName || target?.meterName || 'This charge'}” will stop billing on this add-on. Past invoices that referenced it are unaffected.`}
        confirmLabel="Terminate charge"
        destructive
        isPending={terminate.isPending}
        error={terminate.isError ? 'Could not terminate the charge. Try again.' : null}
        onConfirm={() => {
          if (target) terminate.mutate({ id: target.id }, { onSuccess: () => setTarget(null) })
        }}
      />
    </>
  )
}

/** Entitlements — what the add-on includes of each feature. Removal is confirmed. */
function EntitlementsTab({ addonId }: { addonId: string }) {
  const navigate = useNavigate()
  const entitlements = useEntitlements(EntitlementEntityType.Addon, addonId)
  const features = useFeatures({ ...DEFAULT_FEATURE_QUERY, pageSize: 100 })
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

  if (entitlements.isPending) return <LoadingRows />

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
        entitlements={entitlements.data ?? []}
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

  if (grants.isPending) return <LoadingRows />

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
        grants={grants.data ?? []}
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

/** Information — one pencil edits the name and description in place; the rest is read-only. */
function InformationTab({
  addon,
  onSave,
}: {
  addon: Addon
  onSave: (patch: { name?: string; description?: string }) => Promise<void>
}) {
  return (
    <EditableCard
      className="max-w-3xl"
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
        {
          key: 'status',
          label: 'Status',
          value: addon.status,
          display: <CatalogStatusBadge status={addon.status} />,
          readOnly: true,
        },
        {
          key: 'id',
          label: 'Add-on ID',
          value: addon.id,
          display: <span className="font-mono text-[13px]">{addon.id}</span>,
          readOnly: true,
        },
        { key: 'created', label: 'Created', value: formatDate(addon.createdAt), readOnly: true },
        { key: 'updated', label: 'Updated', value: formatDate(addon.updatedAt), readOnly: true },
        {
          key: 'description',
          label: 'Description',
          value: addon.description ?? '',
          multiline: true,
          placeholder: 'Add a description',
        },
      ]}
      onSave={(changes) => onSave(changes)}
    />
  )
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to this add-on.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again.'
      case 'network':
        return 'Could not reach Flexprice.'
      default:
        return 'This add-on could not be loaded.'
    }
  }
  return 'This add-on could not be loaded.'
}
