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
  type CreatePlan,
  type CreditGrant,
  CreditGrantScope,
  DEFAULT_FEATURE_QUERY,
  DEFAULT_PRICE_UNIT_QUERY,
  type Entitlement,
  EntitlementEntityType,
  FeatureType,
  type Money,
  PLAN_STATUS_LABEL,
  PriceEntityType,
  PriceType,
  PlanStatus,
  PriceUnitStatus,
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
  useFeatures,
  usePlan,
  usePlanSubscriptions,
  usePriceUnits,
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
  ChargeEditorDialog,
  ChargeTable,
  CreditGrantDialog,
  CreditGrantTable,
  EntitlementDialog,
  type FeatureOption,
  EntitlementTable,
  type MeterOption,
  type PriceUnitOption,
  PlanEditorDialog,
  PlanPreviewCard,
} from '@fp/ui/pages'
import {
  AppFailure,
  ConfirmDialog,
  DetailList,
  type DetailMetric,
  DetailShell,
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

  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)

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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontalIcon aria-hidden className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <PencilIcon aria-hidden className="size-4" />
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
                  onEdit={() => setEditing(true)}
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

      <PlanEditorDialog
        open={editing}
        onOpenChange={setEditing}
        mode="edit"
        defaultValue={{
          name: record.name,
          lookupKey: record.lookupKey,
          description: record.description,
        }}
        onSubmit={(draft: CreatePlan) =>
          update.mutate({ id: planId, draft }, { onSuccess: () => setEditing(false) })
        }
        isSubmitting={update.isPending}
      />

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
 * Add opens the charge dialog empty; a row's Edit opens it on that charge, saved
 * as a new price version; terminate ends a charge behind a confirm. The live
 * customer-facing preview lives in the detail page's persistent right rail.
 */
function OverviewTab({ planId }: { planId: string }) {
  const charges = usePrices(PriceEntityType.Plan, planId)
  const features = useFeatures({ ...DEFAULT_FEATURE_QUERY, pageSize: 100 })
  const priceUnits = usePriceUnits({ ...DEFAULT_PRICE_UNIT_QUERY, pageSize: 100 })
  const create = useCreateBulkPrices()
  const updatePrice = useUpdatePrice()
  const terminate = useTerminatePrice()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Charge | null>(null)
  const [terminating, setTerminating] = useState<Charge | null>(null)

  // A usage charge bills against a meter; only metered features have one.
  const meters: MeterOption[] = (features.data?.features ?? [])
    .filter((f) => f.type === FeatureType.Metered && f.meterId)
    .map((f) => ({ id: f.meterId as string, name: f.name }))
  const units: PriceUnitOption[] = (priceUnits.data?.priceUnits ?? [])
    .filter((unit) => unit.status === PriceUnitStatus.Published)
    .map((unit) => ({ code: unit.code, name: unit.name, baseCurrency: unit.baseCurrency }))

  if (charges.isPending) return <LoadingRows />

  const rows = charges.data ?? []

  const submitCreate = (draft: CreateCharge) => {
    create.mutate(
      { entityType: PriceEntityType.Plan, entityId: planId, charges: [draft] },
      { onSuccess: () => setAdding(false) },
    )
  }

  const submitEdit = (draft: CreateCharge) => {
    if (!editing) return
    updatePrice.mutate(
      { id: editing.id, body: toUpdatePriceRequest(draft) },
      { onSuccess: () => setEditing(null) },
    )
  }

  return (
    <>
      <Section title="Charges" description="What this plan bills, and how.">
        <ChargeTable
          charges={rows}
          onAdd={() => setAdding(true)}
          onEdit={(charge) => setEditing(charge)}
          onTerminate={(charge) => setTerminating(charge)}
        />
      </Section>

      <ChargeEditorDialog
        open={adding}
        onOpenChange={setAdding}
        mode="create"
        meters={meters}
        priceUnits={units}
        onSubmit={submitCreate}
        isSubmitting={create.isPending}
        submitError={create.isError ? 'The charge was rejected. Check it and try again.' : null}
      />
      <ChargeEditorDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        mode="edit"
        {...(editing ? { defaultValue: chargeToDraft(editing) } : {})}
        meters={meters}
        priceUnits={units}
        onSubmit={submitEdit}
        isSubmitting={updatePrice.isPending}
        submitError={updatePrice.isError ? 'Could not save the price. Try again.' : null}
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

/** Entitlements — what the plan includes of each feature. */
function EntitlementsTab({ planId }: { planId: string }) {
  const entitlements = useEntitlements(EntitlementEntityType.Plan, planId)
  const features = useFeatures({ ...DEFAULT_FEATURE_QUERY, pageSize: 100 })
  const create = useCreateBulkEntitlements()
  const updateEntitlement = useUpdateEntitlement()
  const remove = useDeleteEntitlement()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Entitlement | null>(null)
  const [removing, setRemoving] = useState<Entitlement | null>(null)

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
      { entityType: EntitlementEntityType.Plan, entityId: planId, entitlements: [draft] },
      { onSuccess: () => setAdding(false) },
    )
  }

  const submitEdit = (draft: EditEntitlement) => {
    if (!editing) return
    updateEntitlement.mutate({ id: editing.id, draft }, { onSuccess: () => setEditing(null) })
  }

  return (
    <>
      <EntitlementTable
        entitlements={entitlements.data ?? []}
        onAdd={() => setAdding(true)}
        onEdit={(entitlement) => setEditing(entitlement)}
        onDelete={(entitlement) => setRemoving(entitlement)}
      />
      <EntitlementDialog
        open={adding}
        onOpenChange={setAdding}
        mode="create"
        features={options}
        onSubmit={submit}
        isSubmitting={create.isPending}
        submitError={create.isError ? 'Could not add the entitlement. Try again.' : null}
      />
      <EntitlementDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        mode="edit"
        {...(editing
          ? {
              editing: {
                feature: editingFeature
                  ? toOption(editingFeature)
                  : {
                      id: editing.featureId,
                      name: editing.featureName ?? 'Feature',
                      type: editing.featureType,
                    },
                defaultValue: entitlementToEdit(editing),
              },
            }
          : {})}
        onEditSubmit={submitEdit}
        isSubmitting={updateEntitlement.isPending}
        submitError={
          updateEntitlement.isError ? 'Could not save the entitlement. Try again.' : null
        }
      />
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
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CreditGrant | null>(null)
  const [removing, setRemoving] = useState<CreditGrant | null>(null)

  if (grants.isPending) return <LoadingRows />

  const submit = (grant: CreateCreditGrant) => {
    create.mutate(
      { scope: CreditGrantScope.Plan, id: planId, grant },
      { onSuccess: () => setAdding(false) },
    )
  }

  const submitEdit = (draft: EditCreditGrant) => {
    if (!editing) return
    updateGrant.mutate({ id: editing.id, draft }, { onSuccess: () => setEditing(null) })
  }

  return (
    <>
      <CreditGrantTable
        grants={grants.data ?? []}
        onAdd={() => setAdding(true)}
        onEdit={(grant) => setEditing(grant)}
        onDelete={(grant) => setRemoving(grant)}
      />
      <CreditGrantDialog
        open={adding}
        onOpenChange={setAdding}
        onSubmit={submit}
        isSubmitting={create.isPending}
        submitError={create.isError ? 'Could not create the grant. Try again.' : null}
      />
      <CreditGrantDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        mode="edit"
        {...(editing ? { defaultValue: creditGrantToEdit(editing) } : {})}
        onEditSubmit={submitEdit}
        isSubmitting={updateGrant.isPending}
        submitError={updateGrant.isError ? 'Could not save the grant. Try again.' : null}
      />
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

/** Information — the plan record itself, as a shared detail list. */
function InformationTab({
  name,
  lookupKey,
  planId,
  description,
  status,
  createdAt,
  updatedAt,
  onEdit,
}: {
  name: string
  lookupKey: string
  planId: string
  description: string
  status: string
  createdAt: Date | null
  updatedAt: Date | null
  onEdit: () => void
}) {
  return (
    <Section
      title="Plan details"
      description="Every attribute of this plan."
      className="max-w-3xl"
      actions={
        <Button variant="outline" size="sm" onClick={onEdit}>
          <PencilIcon aria-hidden className="size-4" />
          Edit
        </Button>
      }
    >
      <DetailList
        items={[
          { label: 'Name', value: name },
          { label: 'Lookup key', value: lookupKey || '—' },
          { label: 'Status', value: status },
          { label: 'Plan ID', value: <span className="font-mono text-xs">{planId}</span> },
          { label: 'Description', value: description || '—', full: true },
          { label: 'Created', value: formatDate(createdAt) },
          { label: 'Updated', value: formatDate(updatedAt) },
        ]}
      />
    </Section>
  )
}
