import { useState } from 'react'
import {
  type CreateEntitlement,
  type EditEntitlement,
  type EditCreditGrant,
  type CreateCreditGrant,
  type Charge,
  type CreateCharge,
  type CreditGrant,
  CreditGrantScope,
  type Entitlement,
  EntitlementEntityType,
  FeatureType,
  PLAN_STATUS_LABEL,
  PriceEntityType,
  PriceType,
  PlanStatus,
  chargeToDraft,
  creditGrantToEdit,
  entitlementToEdit,
} from '@fp/domain'
import {
  useArchivePlan,
  useClonePlan,
  useCreateBulkEntitlements,
  useCreateBulkPrices,
  useCreateCreditGrant,
  useCreditGrants,
  useDeleteCreditGrant,
  useDeleteEntitlement,
  useEntitlements,
  usePlan,
  usePrices,
  useSyncPlanPrices,
  useTerminatePrice,
  useUpdateCreditGrant,
  useUpdateEntitlement,
  useUpdatePlan,
  useUpdatePrice,
  toUpdatePriceRequest,
} from '@fp/query'
import {
  AddChargeDialog,
  CreditGrantCreateForm,
  CreditGrantEditForm,
  CreditGrantTable,
  EntitlementCreateForm,
  EntitlementEditForm,
  EntityHeader,
  type FeatureOption,
  PlanChargesView,
  PlanCustomerPreview,
  PlanEntitlementsView,
  pricingSummary,
} from '@fp/ui/pages'
import {
  AppFailure,
  ConfirmDialog,
  DetailList,
  DetailTabs,
  EditableFields,
  FormDialog,
  LoadingRows,
  Section,
} from '@fp/ui/compositions'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fp/ui/primitives'
import {
  CopyIcon,
  EyeOffIcon,
  LayersIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { usePlanFormOptions } from './planFormOptions'

/**
 * A plan's detail page — the hub where a plan is completed.
 *
 * Header: icon tile, name, status, lookup key as a copyable id, one primary Edit
 * and a ⋯ menu for the actions on the plan as a whole. Tabs: Charges,
 * Entitlements, Credit grants, Information. Beside the tabs, a persistent
 * "What customers see" preview reads the same charges, entitlements and grants.
 * Add and edit happen in dialogs; every destructive action goes through a
 * `ConfirmDialog` first.
 *
 * The page fetches and composes; every piece it renders is a presentational
 * component from `@fp/ui`.
 */

/**
 * The tabs, in order. The first id stays `overview` (the router strips it as the
 * default, so `/plans/:id` lands there) but it is labelled "Charges".
 */
export const PLAN_TABS = ['overview', 'entitlements', 'credit-grants', 'information'] as const
export type PlanTab = (typeof PLAN_TABS)[number]

export function parsePlanTab(value: unknown): PlanTab {
  return PLAN_TABS.includes(value as PlanTab) ? (value as PlanTab) : 'overview'
}

export interface PlanDetailPageProps {
  planId: string
  tab: PlanTab
  onTabChange: (tab: PlanTab) => void
  /** After archiving or duplicating, where to go. */
  onArchived: () => void
  onDuplicated: (planId: string) => void
  /** Open the full-page edit form. */
  onEdit: (planId: string) => void
  /** The breadcrumb's way back to the plans list. */
  onNavigateToList: () => void
}

/** Formats a date the same way across the page's few date fields. */
function formatDate(value: Date | null): string {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value) : '—'
}

export function PlanDetailPage({
  planId,
  tab,
  onTabChange,
  onArchived,
  onDuplicated,
  onEdit,
  onNavigateToList,
}: PlanDetailPageProps) {
  const plan = usePlan(planId)
  const update = useUpdatePlan()
  const archive = useArchivePlan()
  const clone = useClonePlan()
  const sync = useSyncPlanPrices()

  // The tabs and the preview read the same keys, so react-query serves each once.
  const charges = usePrices(PriceEntityType.Plan, planId)
  const entitlements = useEntitlements(EntitlementEntityType.Plan, planId)
  const grants = useCreditGrants(CreditGrantScope.Plan, planId)

  const [archiving, setArchiving] = useState(false)
  const [editing, setEditing] = useState(false)

  if (plan.isPending) {
    return (
      <div className="p-6">
        <LoadingRows />
      </div>
    )
  }

  if (plan.error || !plan.data) {
    return (
      <AppFailure
        title="This plan could not be loaded"
        detail="It may have been archived, or the link may be out of date."
        onRetry={() => void plan.refetch()}
      />
    )
  }

  const record = plan.data
  const isArchived = record.status === PlanStatus.Archived

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[{ label: 'Plans', onClick: onNavigateToList }, { label: record.name }]}
        icon={<LayersIcon aria-hidden className="size-5" />}
        title={record.name}
        subtitle={PLAN_STATUS_LABEL[record.status]}
        id={record.lookupKey || record.id}
        actions={
          <>
            <Button
              disabled={editing || isArchived}
              onClick={() => {
                onTabChange('information')
                setEditing(true)
              }}
            >
              <PencilIcon aria-hidden className="size-4" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label="More actions" />}
              >
                <MoreHorizontalIcon aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(planId)}>
                    <PencilIcon aria-hidden className="size-4" />
                    Edit configuration
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      clone.mutate(
                        { id: planId, name: `${record.name} (copy)` },
                        {
                          onSuccess: (result) => {
                            const id = (result as { id?: string }).id
                            if (id) onDuplicated(id)
                          },
                        },
                      )
                    }
                  >
                    <CopyIcon aria-hidden className="size-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={sync.isPending} onClick={() => sync.mutate(planId)}>
                    <RefreshCwIcon aria-hidden className="size-4" />
                    {sync.isPending ? 'Syncing…' : 'Sync usage charges'}
                  </DropdownMenuItem>
                <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={isArchived} onClick={() => setArchiving(true)}>
                    <EyeOffIcon aria-hidden className="size-4" />
                    Archive
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 px-6 pb-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <DetailTabs
            value={tab}
            onValueChange={(next) => onTabChange(parsePlanTab(next))}
            tabs={[
              { value: 'overview', label: 'Charges', content: <ChargesTab planId={planId} /> },
              {
                value: 'entitlements',
                label: 'Entitlements',
                content: <EntitlementsTab planId={planId} />,
              },
              {
                value: 'credit-grants',
                label: 'Credit grants',
                content: <CreditGrantsTab planId={planId} />,
              },
              {
                value: 'information',
                label: 'Information',
                content: (
                  <InformationTab
                    name={record.name}
                    lookupKey={record.lookupKey}
                    planId={record.id}
                    description={record.description}
                    status={PLAN_STATUS_LABEL[record.status]}
                    createdAt={record.createdAt}
                    updatedAt={record.updatedAt}
                    readOnly={isArchived}
                    onSave={(patch) =>
                      update.mutateAsync({
                        id: planId,
                        draft: {
                          name: record.name,
                          lookupKey: record.lookupKey,
                          description: record.description,
                          ...patch,
                        },
                      })
                    }
                    editing={editing}
                    onEditingChange={setEditing}
                  />
                ),
              },
            ]}
          />
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <PlanCustomerPreview
            name={record.name}
            charges={charges.data ?? []}
            entitlements={entitlements.data ?? []}
            grants={grants.data ?? []}
          />
        </aside>
      </div>

      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title="Archive this plan?"
        description="Archiving retires the plan from the catalogue. Existing subscriptions keep billing; the plan can no longer be added to new ones."
        confirmLabel="Archive plan"
        destructive
        isPending={archive.isPending}
        error={archive.isError ? 'Could not archive the plan. Try again.' : null}
        onConfirm={() =>
          archive.mutate(planId, {
            onSuccess: () => {
              setArchiving(false)
              onArchived()
            },
          })
        }
      />
    </div>
  )
}

/**
 * Charges — what the plan bills, grouped by when it bills. "Add charge" opens a
 * dialog that asks Fixed or Usage first; a row's Edit opens the form directly.
 * An edit is saved as a new price version; terminate ends a charge behind a confirm.
 */
function ChargesTab({ planId }: { planId: string }) {
  const charges = usePrices(PriceEntityType.Plan, planId)
  const { meters, units } = usePlanFormOptions()
  const create = useCreateBulkPrices()
  const updatePrice = useUpdatePrice()
  const terminate = useTerminatePrice()
  const [form, setForm] = useState<'add' | Charge | null>(null)
  const [terminating, setTerminating] = useState<Charge | null>(null)

  if (charges.isPending) return <LoadingRows />

  const rows = charges.data ?? []
  const editing = form !== null && form !== 'add' ? form : null

  const close = () => {
    setForm(null)
    create.reset()
    updatePrice.reset()
  }

  const submit = (draft: CreateCharge) => {
    if (editing) {
      updatePrice.mutate(
        { id: editing.id, body: toUpdatePriceRequest(draft) },
        { onSuccess: close },
      )
      return
    }
    create.mutate(
      { entityType: PriceEntityType.Plan, entityId: planId, charges: [draft] },
      { onSuccess: close },
    )
  }

  return (
    <>
      <PlanChargesView
        charges={rows}
        onAdd={() => setForm('add')}
        onEdit={(charge) => setForm(charge)}
        onTerminate={(charge) => setTerminating(charge)}
      />

      <AddChargeDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        editing={editing}
        meters={meters}
        priceUnits={units}
        onSubmit={submit}
        isSubmitting={create.isPending || updatePrice.isPending}
        submitError={
          editing
            ? updatePrice.isError
              ? 'Could not save the price. Try again.'
              : null
            : create.isError
              ? 'The charge was rejected. Check it and try again.'
              : null
        }
      />

      <ConfirmDialog
        open={terminating !== null}
        onOpenChange={(open) => {
          if (!open) setTerminating(null)
        }}
        title="Terminate this charge?"
        description={
          terminating
            ? `“${terminating.displayName || terminating.meterName || 'This charge'}” stops billing on this plan. Past invoices that referenced it are unaffected.`
            : undefined
        }
        confirmLabel="Terminate charge"
        destructive
        isPending={terminate.isPending}
        error={terminate.isError ? 'Could not terminate the charge. Try again.' : null}
        onConfirm={() => {
          if (terminating)
            terminate.mutate({ id: terminating.id }, { onSuccess: () => setTerminating(null) })
        }}
      />
    </>
  )
}

/**
 * Entitlements — what the plan includes of each feature. The last column shows
 * the plan's usage price for a metered feature, found by matching the feature's
 * meter to a usage charge; usage beyond the value bills at that price.
 */
function EntitlementsTab({ planId }: { planId: string }) {
  const entitlements = useEntitlements(EntitlementEntityType.Plan, planId)
  const charges = usePrices(PriceEntityType.Plan, planId)
  const { featureOptions, allFeatures } = usePlanFormOptions()
  const create = useCreateBulkEntitlements()
  const updateEntitlement = useUpdateEntitlement()
  const remove = useDeleteEntitlement()
  const [form, setForm] = useState<'add' | Entitlement | null>(null)
  const [removing, setRemoving] = useState<Entitlement | null>(null)

  // Only features not already entitled can be added — a feature is granted once.
  const granted = new Set((entitlements.data ?? []).map((e) => e.featureId))
  const options = featureOptions.filter((f) => !granted.has(f.id))
  const editing = form !== null && form !== 'add' ? form : null
  const editingFeature = editing ? allFeatures.find((f) => f.id === editing.featureId) : undefined
  const editingOption: FeatureOption | undefined = editing
    ? (featureOptions.find((f) => f.id === editing.featureId) ?? {
        id: editing.featureId,
        name: editing.featureName ?? editingFeature?.name ?? 'Feature',
        type: editing.featureType,
      })
    : undefined

  if (entitlements.isPending) return <LoadingRows />

  const usagePrice = (entitlement: Entitlement): string | null => {
    if (entitlement.featureType !== FeatureType.Metered) return null
    const meterId = allFeatures.find((f) => f.id === entitlement.featureId)?.meterId
    if (!meterId) return null
    const charge = (charges.data ?? []).find(
      (c) => c.type === PriceType.Usage && c.meterId === meterId,
    )
    return charge
      ? pricingSummary(chargeToDraft(charge), (charge.currency || 'usd').toUpperCase())
      : null
  }

  const close = () => {
    setForm(null)
    create.reset()
    updateEntitlement.reset()
  }

  return (
    <>
      <PlanEntitlementsView
        entitlements={entitlements.data ?? []}
        usagePrice={usagePrice}
        onAdd={() => setForm('add')}
        onEdit={(entitlement) => setForm(entitlement)}
        onDelete={(entitlement) => setRemoving(entitlement)}
      />

      <FormDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        size="md"
        title={editing ? 'Edit entitlement' : 'Add entitlement'}
        description={
          editing ? 'Change what this entitlement grants.' : 'Grant a feature to everyone on this plan.'
        }
      >
        {form === null ? null : editing && editingOption ? (
          <EntitlementEditForm
            key={editing.id}
            feature={editingOption}
            defaultValue={entitlementToEdit(editing)}
            usagePrice={usagePrice(editing) ?? undefined}
            onSubmit={(draft: EditEntitlement) =>
              updateEntitlement.mutate({ id: editing.id, draft }, { onSuccess: close })
            }
            onCancel={close}
            isSubmitting={updateEntitlement.isPending}
            submitError={
              updateEntitlement.isError ? 'Could not save the entitlement. Try again.' : null
            }
          />
        ) : (
          <EntitlementCreateForm
            features={options}
            onSubmit={(draft: CreateEntitlement) =>
              create.mutate(
                {
                  entityType: EntitlementEntityType.Plan,
                  entityId: planId,
                  entitlements: [draft],
                },
                { onSuccess: close },
              )
            }
            onCancel={close}
            isSubmitting={create.isPending}
            submitError={create.isError ? 'Could not add the entitlement. Try again.' : null}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Remove this entitlement?"
        description={
          removing
            ? `“${removing.featureName ?? 'This feature'}” will no longer be included in the plan.`
            : undefined
        }
        confirmLabel="Remove entitlement"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not remove the entitlement. Try again.' : null}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }}
      />
    </>
  )
}

/** Credit grants — the balances the plan hands its subscribers. */
function CreditGrantsTab({ planId }: { planId: string }) {
  const grants = useCreditGrants(CreditGrantScope.Plan, planId)
  const create = useCreateCreditGrant()
  const updateGrant = useUpdateCreditGrant()
  const remove = useDeleteCreditGrant()
  const [form, setForm] = useState<'add' | CreditGrant | null>(null)
  const [removing, setRemoving] = useState<CreditGrant | null>(null)

  if (grants.isPending) return <LoadingRows />

  const editing = form !== null && form !== 'add' ? form : null
  const close = () => {
    setForm(null)
    create.reset()
    updateGrant.reset()
  }

  return (
    <>
      <CreditGrantTable
        grants={grants.data ?? []}
        onAdd={() => setForm('add')}
        onEdit={(grant) => setForm(grant)}
        onDelete={(grant) => setRemoving(grant)}
      />

      <FormDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        size={editing ? 'md' : 'lg'}
        title={editing ? 'Edit credit grant' : 'Add credit grant'}
        description={
          editing
            ? 'Rename the grant or change when it ends. Its credits and schedule are fixed.'
            : 'Hand subscribers a balance of credits to spend against usage.'
        }
      >
        {form === null ? null : editing ? (
          <CreditGrantEditForm
            key={editing.id}
            defaultValue={creditGrantToEdit(editing)}
            onSubmit={(draft: EditCreditGrant) =>
              updateGrant.mutate({ id: editing.id, draft }, { onSuccess: close })
            }
            onCancel={close}
            isSubmitting={updateGrant.isPending}
            submitError={updateGrant.isError ? 'Could not save the grant. Try again.' : null}
          />
        ) : (
          <CreditGrantCreateForm
            onSubmit={(grant: CreateCreditGrant) =>
              create.mutate({ scope: CreditGrantScope.Plan, id: planId, grant }, { onSuccess: close })
            }
            onCancel={close}
            isSubmitting={create.isPending}
            submitError={create.isError ? 'Could not create the grant. Try again.' : null}
          />
        )}
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Remove this credit grant?"
        description={
          removing
            ? `“${removing.name || 'This grant'}” will stop handing subscribers its balance.`
            : undefined
        }
        confirmLabel="Remove grant"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not remove the grant. Try again.' : null}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }}
      />
    </>
  )
}

/**
 * Information — the plan record itself. Name, lookup key and description edit
 * in place, per field or together via the header Edit.
 */
function InformationTab({
  name,
  lookupKey,
  planId,
  description,
  status,
  createdAt,
  updatedAt,
  readOnly,
  onSave,
  editing,
  onEditingChange,
}: {
  name: string
  lookupKey: string
  planId: string
  description: string
  status: string
  createdAt: Date | null
  updatedAt: Date | null
  readOnly: boolean
  onSave: (patch: { name?: string; lookupKey?: string; description?: string }) => Promise<unknown>
  editing: boolean
  onEditingChange: (editing: boolean) => void
}) {
  return (
    <Section
      title="Plan details"
      description="Use the pencil on a value, or Edit above to change them together."
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-5">
        <EditableFields
          editing={editing}
          onEditingChange={onEditingChange}
          fields={[
            { key: 'name', label: 'Name', value: name, required: true, readOnly },
            {
              key: 'lookupKey',
              label: 'Lookup key',
              value: lookupKey,
              placeholder: 'No lookup key',
              readOnly,
              validate: (next) =>
                next === '' || /^[a-z0-9_]+$/.test(next)
                  ? null
                  : 'Use lowercase letters, numbers and underscores',
            },
            {
              key: 'description',
              label: 'Description',
              value: description,
              placeholder: 'No description',
              multiline: true,
              readOnly,
            },
          ]}
          onSave={(changes) => onSave(changes)}
        />
        <DetailList
          items={[
            { label: 'Status', value: status },
            { label: 'Plan ID', value: <span className="font-mono text-xs">{planId}</span> },
            { label: 'Created', value: formatDate(createdAt) },
            { label: 'Updated', value: formatDate(updatedAt) },
          ]}
        />
      </div>
    </Section>
  )
}
