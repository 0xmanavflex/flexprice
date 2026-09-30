import { useState } from 'react'
import {
  type CreateEntitlement,
  type EditEntitlement,
  type EditCreditGrant,
  type CreateCreditGrant,
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  BillingModel,
  type Charge,
  type CreateCharge,
  type CreditGrant,
  CreditGrantScope,
  type Entitlement,
  EntitlementEntityType,
  type Money,
  PLAN_STATUS_LABEL,
  PriceEntityType,
  PriceType,
  PlanStatus,
  chargeToDraft,
  compareMoney,
  creditGrantToEdit,
  entitlementToEdit,
  formatMoney,
  money,
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
  usePlanSubscriptions,
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
  ChargeForm,
  ChargeTable,
  CreditGrantCreateForm,
  CreditGrantEditForm,
  CreditGrantTable,
  EntitlementCreateForm,
  EntitlementEditForm,
  EntitlementTable,
  type FeatureOption,
  PlanPreviewCard,
} from '@fp/ui/pages'
import {
  AppFailure,
  ConfirmDialog,
  ContextualSection,
  DetailList,
  type DetailMetric,
  DetailShell,
  EditableFields,
  LoadingRows,
  ResourceNavigation,
  Section,
} from '@fp/ui/compositions'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fp/ui/primitives'
import { CopyIcon, EyeOffIcon, MoreHorizontalIcon, PencilIcon, RefreshCwIcon } from 'lucide-react'
import { usePlanFormOptions } from './planFormOptions'

/**
 * A plan's detail page — the hub where a plan is completed.
 *
 * V1 scatters a plan across four containers; this gathers them behind one set of
 * tabs on the shared `DetailShell`. The header carries a large title, its status,
 * the lookup key as an identifier, and — in a single ⋮ overflow menu — the actions
 * on the plan as a whole: edit, duplicate, sync usage charges, archive. The
 * **metric rail** leads with real numbers, never a restatement of the badge below
 * it: how many subscriptions are on the plan, what it starts at, how many charges
 * it carries, and in which currency.
 *
 * The body pairs a tabbed left column with a persistent right rail: the live
 * customer-facing preview — the plan's pricing and an example bill — stays visible
 * on every tab, while the left column changes with the tab. Overview shows the
 * charges the plan bills, Entitlements and Credit Grants are what it includes, and
 * Information is the record itself. Every destructive action — terminate a charge,
 * delete an entitlement or grant, archive the plan — goes through a `ConfirmDialog`
 * first.
 *
 * The page fetches and composes; every piece it renders is a presentational
 * component from `@fp/ui`, so what the tabs show is testable without this page.
 */

/** The tabs, in order. The empty id is Overview, so `/plans/:id` lands there. */
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

/**
 * The cheapest recurring fixed base the plan carries — the "starts at" number.
 *
 * Only flat-fee fixed charges have a single comparable amount, so tiered and
 * usage charges are left out; the minimum is found with `compareMoney` so a
 * 20-digit amount still sorts correctly and no cent is lost to a float. Charges
 * in a currency other than the current minimum's are skipped rather than
 * compared — there is no honest answer to "is $9 less than €9".
 */
function startingPrice(charges: Charge[]): { money: Money; period: BillingPeriod } | null {
  const fixed = charges.filter(
    (charge) =>
      charge.type === PriceType.Fixed &&
      charge.billingModel === BillingModel.FlatFee &&
      /^-?\d+(\.\d+)?$/.test(charge.amount),
  )
  const first = fixed[0]
  if (!first) return null

  let best = first
  let bestMoney = money(first.amount, first.currency || 'USD')
  for (const charge of fixed) {
    if (charge.currency && best.currency && charge.currency !== best.currency) continue
    const next = money(charge.amount, charge.currency || 'USD')
    if (compareMoney(next, bestMoney) < 0) {
      best = charge
      bestMoney = next
    }
  }
  return { money: bestMoney, period: best.billingPeriod }
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

  // Read for the metric rail. The Overview tab re-reads prices under the same
  // key, so react-query serves both from one fetch.
  const charges = usePrices(PriceEntityType.Plan, planId)
  const subscriptions = usePlanSubscriptions(planId)

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

  const metrics = buildMetrics({
    charges: charges.data ?? [],
    chargesPending: charges.isPending,
    subscriptions: subscriptions.data ?? [],
    subscriptionsPending: subscriptions.isPending,
  })

  // The right rail. The plan's live charges, mapped to the draft shape the
  // preview reads, so the customer-facing price stays visible on every tab — it
  // is the plan's pricing, relevant whether you are on Entitlements or Overview.
  const chargeRows = charges.data ?? []
  const previewCharges = chargeRows.map(chargeToDraft)
  const meterName = (id: string) => chargeRows.find((c) => c.meterId === id)?.meterName ?? id

  return (
    <>
      <DetailShell
        trail={[{ label: 'Plans', onClick: onNavigateToList }, { label: record.name }]}
        title={record.name}
        badges={
          <Badge variant={isArchived ? 'outline' : 'secondary'}>
            {PLAN_STATUS_LABEL[record.status]}
          </Badge>
        }
        {...(record.lookupKey ? { identifier: record.lookupKey } : {})}
        {...(record.description ? { description: record.description } : {})}
        metrics={metrics}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={editing || isArchived}
              onClick={() => {
                onTabChange('information')
                setEditing(true)
              }}
            >
              <PencilIcon aria-hidden className="size-4" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(planId)}>
              Edit configuration
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontalIcon aria-hidden className="size-4" />
                  </Button>
                }
              />
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
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT — changes with the tab. The section strip is the shared
              `ResourceNavigation` line nav, the same one the customer page uses. */}
          <div className="min-w-0">
            <ResourceNavigation
              items={[
                { id: 'overview', label: 'Overview' },
                { id: 'entitlements', label: 'Entitlements' },
                { id: 'credit-grants', label: 'Credit Grants' },
                { id: 'information', label: 'Information' },
              ]}
              value={tab}
              onChange={(id) => onTabChange(id as PlanTab)}
              label="Plan sections"
            />

            <div className="pt-5">
              {tab === 'overview' ? <OverviewTab planId={planId} /> : null}
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
                  editing={editing}
                  onEditingChange={setEditing}
                />
              ) : null}
            </div>
          </div>

          {/* RIGHT — the plan's pricing, persistent across every tab. */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <PlanPreviewCard name={record.name} charges={previewCharges} meterLabel={meterName} />
          </aside>
        </div>
      </DetailShell>

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
    </>
  )
}

/** The rail's numbers (up to four), built from the plan's charges and subscriptions. */
function buildMetrics({
  charges,
  chargesPending,
  subscriptions,
  subscriptionsPending,
}: {
  charges: Charge[]
  chargesPending: boolean
  subscriptions: { status: string }[]
  subscriptionsPending: boolean
}): DetailMetric[] {
  const active = subscriptions.filter((s) => s.status.toLowerCase() === 'active').length
  const start = startingPrice(charges)
  const currency = (charges.find((c) => c.currency)?.currency ?? '').toUpperCase()
  const fixedCount = charges.filter((c) => c.type === PriceType.Fixed).length
  const usageCount = charges.length - fixedCount

  const subscriptionsMetric: DetailMetric = subscriptionsPending
    ? { label: 'Active subscriptions', value: '—' }
    : {
        label: 'Active subscriptions',
        value: active.toLocaleString(),
        hint: `${subscriptions.length.toLocaleString()} total`,
      }

  const startsAtMetric: DetailMetric = chargesPending
    ? { label: 'Starts at', value: '—' }
    : start
      ? {
          label: 'Starts at',
          value: formatMoney(start.money),
          hint: BILLING_PERIOD_LABEL[start.period],
        }
      : { label: 'Starts at', value: 'Usage-based', sentiment: 'muted' }

  const chargesMetric: DetailMetric = chargesPending
    ? { label: 'Charges', value: '—' }
    : charges.length > 0
      ? {
          label: 'Charges',
          value: charges.length.toLocaleString(),
          hint: `${fixedCount} fixed · ${usageCount} usage`,
        }
      : { label: 'Charges', value: '0', sentiment: 'muted' }

  // While loading it reads '—' like the others; once resolved with no charge
  // setting a currency, it is omitted rather than shown as a permanent empty
  // "Currency —" tile. A rail tile is a number the plan has, not a field it is
  // missing — an unpriced plan simply has one fewer tile.
  const currencyMetric: DetailMetric | null = chargesPending
    ? { label: 'Currency', value: '—' }
    : currency
      ? { label: 'Currency', value: currency }
      : null

  return [subscriptionsMetric, startsAtMetric, chargesMetric, currencyMetric].filter(
    (metric): metric is DetailMetric => metric !== null,
  )
}

/**
 * Overview — the charges the plan bills.
 *
 * Add and a row's Edit swap the Charges section for the charge form in place
 * (`ContextualSection`): the plan, its tabs and its preview stay put, Cancel or
 * a save swaps the table back, refetched. An edit is saved as a new price
 * version; terminate ends a charge behind a confirm. The live customer-facing
 * preview lives in the detail page's persistent right rail.
 */
function OverviewTab({ planId }: { planId: string }) {
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
      <ContextualSection
        title="Charges"
        description="What this plan bills, and how."
        backLabel="Charges"
        onBack={close}
        formTitle={editing ? 'Edit charge' : 'Add charge'}
        formDescription={
          editing
            ? 'Update the price. Everything else about a charge is fixed once created.'
            : 'A fixed fee, or usage billed against a metered feature.'
        }
        form={
          form === null ? undefined : (
            <ChargeForm
              key={editing ? `edit:${editing.id}` : 'create'}
              mode={editing ? 'edit' : 'create'}
              {...(editing ? { defaultValue: chargeToDraft(editing) } : {})}
              meters={meters}
              priceUnits={units}
              onSubmit={submit}
              onCancel={close}
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
          )
        }
      >
        <ChargeTable
          charges={rows}
          onAdd={() => setForm('add')}
          onEdit={(charge) => setForm(charge)}
          onTerminate={(charge) => setTerminating(charge)}
        />
      </ContextualSection>

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

/** Entitlements — what the plan includes of each feature. */
function EntitlementsTab({ planId }: { planId: string }) {
  const entitlements = useEntitlements(EntitlementEntityType.Plan, planId)
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

  const close = () => {
    setForm(null)
    create.reset()
    updateEntitlement.reset()
  }

  return (
    <>
      <ContextualSection
        title="Entitlements"
        description="What this plan includes of each feature."
        backLabel="Entitlements"
        onBack={close}
        formTitle={editing ? 'Edit entitlement' : 'Add entitlement'}
        formDescription={
          editing
            ? 'Change what this entitlement grants.'
            : 'Grant a feature to everyone on this plan.'
        }
        form={
          form === null ? undefined : editing && editingOption ? (
            <EntitlementEditForm
              key={editing.id}
              feature={editingOption}
              defaultValue={entitlementToEdit(editing)}
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
          )
        }
      >
        <EntitlementTable
          entitlements={entitlements.data ?? []}
          onAdd={() => setForm('add')}
          onEdit={(entitlement) => setForm(entitlement)}
          onDelete={(entitlement) => setRemoving(entitlement)}
        />
      </ContextualSection>

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

/** Credit Grants — the balances the plan hands its subscribers. */
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
      <ContextualSection
        title="Credit grants"
        description="Balances this plan hands its subscribers."
        backLabel="Credit grants"
        onBack={close}
        formTitle={editing ? 'Edit credit grant' : 'Add credit grant'}
        formDescription={
          editing
            ? 'Rename the grant or change when it ends. Its credits and schedule are fixed.'
            : 'Hand subscribers a balance of credits to spend against usage.'
        }
        form={
          form === null ? undefined : editing ? (
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
          )
        }
      >
        <CreditGrantTable
          grants={grants.data ?? []}
          onAdd={() => setForm('add')}
          onEdit={(grant) => setForm(grant)}
          onDelete={(grant) => setRemoving(grant)}
        />
      </ContextualSection>

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
