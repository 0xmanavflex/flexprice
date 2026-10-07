import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  type CreateEntitlement,
  type EditEntitlement,
  type EditCreditGrant,
  type CreateCreditGrant,
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
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
  PlanCreditGrantsView,
  EntitlementCreateForm,
  EntitlementEditForm,
  type FeatureOption,
  PlanChargesView,
  PlanCustomerPreview,
  PlanEntitlementsView,
  Status,
  pricingSummary,
} from '@fp/ui/pages'
import {
  AppFailure,
  ConfirmDialog,
  DetailHeader,
  DetailTabs,
  Dot,
  EditableCard,
  FormDialog,
  LoadingRows,
  Properties,
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
  ArchiveIcon,
  CopyIcon,
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

  if (plan.isPending) {
    return (
      <div className="px-10 pt-8 pb-16 2xl:px-14">
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

  const charged = charges.data ?? []

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
      <DetailHeader
        icon={<LayersIcon />}
        title={record.name}
        id={record.lookupKey || record.id}
        subtitle={
          <>
            <span>{planKind(charged)}</span>
            {billedLabel(charged) ? (
              <>
                <Dot />
                <span>{billedLabel(charged)}</span>
              </>
            ) : null}
            {isArchived ? (
              <>
                <Dot />
                <Status value={PLAN_STATUS_LABEL[record.status]} />
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              className="h-8 px-3"
              disabled={sync.isPending || isArchived}
              onClick={() => sync.mutate(planId)}
            >
              <RefreshCwIcon aria-hidden />
              {sync.isPending ? 'Syncing…' : 'Sync to subscriptions'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="More actions"
                  />
                }
              >
                <MoreHorizontalIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(planId)}>
                  <PencilIcon className="text-muted-foreground" aria-hidden />
                  Edit details
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
                  <CopyIcon className="text-muted-foreground" aria-hidden />
                  Duplicate plan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isArchived}
                  onClick={() => setArchiving(true)}
                >
                  <ArchiveIcon aria-hidden />
                  Archive plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <DetailTabs
        value={tab}
        onChange={(next) => onTabChange(parsePlanTab(next))}
        tabs={[
          { value: 'overview', label: 'Charges', ...count(charges.data) },
          { value: 'entitlements', label: 'Entitlements', ...count(entitlements.data) },
          { value: 'credit-grants', label: 'Credit grants', ...count(grants.data) },
          { value: 'information', label: 'Information' },
        ]}
      />

      {tab === 'overview' ? <ChargesTab planId={planId} readOnly={isArchived} /> : null}
      {tab === 'entitlements' ? <EntitlementsTab planId={planId} /> : null}
      {tab === 'credit-grants' ? <CreditGrantsTab planId={planId} /> : null}
      {tab === 'information' ? (
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
        />
      ) : null}

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
function ChargesTab({ planId, readOnly }: { planId: string; readOnly: boolean }) {
  const charges = usePrices(PriceEntityType.Plan, planId)
  const entitlements = useEntitlements(EntitlementEntityType.Plan, planId)
  const grants = useCreditGrants(CreditGrantScope.Plan, planId)
  const { meters, units, featureOptions } = usePlanFormOptions()
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
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <PlanChargesView
          charges={rows}
          readOnly={readOnly}
          meterUnit={(id) => meters.find((m) => m.id === id)?.unit}
          onAdd={() => setForm('add')}
          onEdit={(charge) => setForm(charge)}
          onTerminate={(charge) => setTerminating(charge)}
        />
        <PlanCustomerPreview
          charges={rows}
          entitlements={entitlements.data ?? []}
          grants={grants.data ?? []}
          meterUnit={(id) => meters.find((m) => m.id === id)?.unit}
          featureUnit={(id) => featureOptions.find((f) => f.id === id)?.unit}
        />
      </div>

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
  const navigate = useNavigate()
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
        onOpenFeature={(featureId) =>
          void navigate({ to: '/features/$featureId', params: { featureId } })
        }
      />

      <FormDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        size="md"
        title={editing ? 'Edit entitlement' : 'Add entitlement'}
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
      <PlanCreditGrantsView
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
              create.mutate(
                { scope: CreditGrantScope.Plan, id: planId, grant },
                { onSuccess: close },
              )
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

/** Information — the plan record. One pencil on the card edits its fields in place. */
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
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <EditableCard
        className="xl:col-span-2"
        title="Plan details"
        locked={readOnly}
        fields={[
          { key: 'name', label: 'Name', value: name, required: true },
          {
            key: 'lookupKey',
            label: 'Lookup key',
            value: lookupKey,
            placeholder: 'No lookup key',
            display: <span className="font-mono text-[13px]">{lookupKey || '—'}</span>,
            validate: (next) =>
              next === '' || /^[a-z0-9_]+$/.test(next)
                ? null
                : 'Use lowercase letters, numbers and underscores',
          },
          { key: 'status', label: 'Status', value: status, readOnly: true },
          { key: 'created', label: 'Created', value: formatDate(createdAt), readOnly: true },
          { key: 'updated', label: 'Updated', value: formatDate(updatedAt), readOnly: true },
          {
            key: 'description',
            label: 'Description',
            value: description,
            placeholder: 'No description',
            multiline: true,
          },
        ]}
        onSave={(changes) => onSave(changes)}
      />
      <div className="flex flex-col gap-5">
        <Section title="Metadata">
          <Properties
            columns={2}
            items={[
              { label: 'Plan ID', value: <span className="font-mono text-[13px]">{planId}</span> },
            ]}
          />
        </Section>
      </div>
    </div>
  )
}

function count(rows: readonly unknown[] | undefined): { count?: number } {
  return rows ? { count: rows.length } : {}
}

function planKind(charges: Charge[]): string {
  const hasFixed = charges.some((c) => c.type === PriceType.Fixed)
  const hasUsage = charges.some((c) => c.type === PriceType.Usage)
  if (charges.length === 0) return 'No charges yet'
  if (hasFixed && hasUsage) return 'Hybrid plan'
  return hasUsage ? 'Usage-based plan' : 'Flat-rate plan'
}

function billedLabel(charges: Charge[]): string | null {
  const period = charges.find((c) => c.type === PriceType.Fixed)?.billingPeriod
  const label = period ? BILLING_PERIOD_LABEL[period as BillingPeriod] : undefined
  return label ? `Billed ${label.toLowerCase()}` : null
}
