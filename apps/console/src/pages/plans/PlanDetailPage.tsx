import { useState } from 'react'
import {
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  BillingModel,
  type Charge,
  type CreateCharge,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreatePlan,
  type CreditGrant,
  CreditGrantScope,
  DEFAULT_FEATURE_QUERY,
  type Entitlement,
  EntitlementEntityType,
  FeatureType,
  type Money,
  PLAN_STATUS_LABEL,
  PriceEntityType,
  PriceType,
  PlanStatus,
  TierMode,
  compareMoney,
  formatMoney,
  money,
} from '@fp/domain'
import {
  useArchivePlan,
  useClonePlan,
  useCreateCreditGrant,
  useCreateBulkEntitlements,
  useCreditGrants,
  useDeleteCreditGrant,
  useDeleteEntitlement,
  useEntitlements,
  useFeatures,
  usePlan,
  usePlanSubscriptions,
  usePrices,
  useSyncPlanPrices,
  useTerminatePrice,
  useUpdatePlan,
} from '@fp/query'
import {
  ChargeTable,
  CreditGrantDialog,
  CreditGrantTable,
  EntitlementDrawer,
  type FeatureOption,
  EntitlementTable,
  PlanEditorSheet,
  PlanPreviewCard,
} from '@fp/ui/flexprice'
import {
  AppFailure,
  ConfirmDialog,
  DetailList,
  type DetailMetric,
  DetailShell,
  LoadingRows,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@fp/ui/primitives'
import { CopyIcon, EyeOffIcon, MoreHorizontalIcon, PencilIcon, RefreshCwIcon } from 'lucide-react'

/**
 * A plan's detail page — the hub where a plan is completed.
 *
 * V1 scatters a plan across four containers; this gathers them behind one set of
 * tabs on the shared `DetailShell`. The header carries a large title, its status,
 * the lookup key as an identifier, and the actions on the plan as a whole — sync,
 * edit, duplicate, archive. The **metric rail** leads with real numbers, never a
 * restatement of the badge below it: how many subscriptions are on the plan, what
 * it starts at, how many charges it carries, and in which currency.
 *
 * Overview shows the charges the plan bills beside a live customer-facing preview;
 * Entitlements and Credit Grants are what it includes; Information is the record
 * itself. Every destructive action — terminate a charge, delete an entitlement or
 * grant, archive the plan — goes through a `ConfirmDialog` first.
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
  /** Opens the two-pane charges builder for this plan. */
  onOpenCharges: () => void
  /** After archiving or duplicating, where to go. */
  onArchived: () => void
  onDuplicated: (planId: string) => void
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

/**
 * A saved `Charge` as the draft shape the preview card reads.
 *
 * The preview is driven from `CreateCharge[]` — the same input the editor feeds
 * it — so the plan's live charges are mapped back to that shape here. Only the
 * fields the preview uses are carried; the model discriminant decides the rest.
 */
function toDraftCharge(charge: Charge): CreateCharge {
  const base = {
    type: charge.type,
    currency: (charge.currency || 'USD').toUpperCase(),
    billingPeriod: charge.billingPeriod,
    invoiceCadence: charge.invoiceCadence,
    ...(charge.meterId ? { meterId: charge.meterId } : {}),
    ...(charge.displayName ? { displayName: charge.displayName } : {}),
  }

  switch (charge.billingModel) {
    case BillingModel.Package:
      return {
        ...base,
        billingModel: BillingModel.Package,
        amount: charge.amount || '0',
        divideBy: charge.transformQuantity?.divideBy ?? 1,
      }
    case BillingModel.Tiered:
      return {
        ...base,
        billingModel: BillingModel.Tiered,
        tierMode: charge.tierMode ?? TierMode.Volume,
        tiers: charge.tiers,
      }
    case BillingModel.FlatFee:
      return { ...base, billingModel: BillingModel.FlatFee, amount: charge.amount || '0' }
  }
}

export function PlanDetailPage({
  planId,
  tab,
  onTabChange,
  onOpenCharges,
  onArchived,
  onDuplicated,
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

  return (
    <>
      <DetailShell
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
            <Button variant="outline" disabled={sync.isPending} onClick={() => sync.mutate(planId)}>
              <RefreshCwIcon aria-hidden className="size-4" />
              {sync.isPending ? 'Syncing…' : 'Sync usage charges'}
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
        <Tabs value={tab} onValueChange={(value) => onTabChange(value as PlanTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
            <TabsTrigger value="credit-grants">Credit Grants</TabsTrigger>
            <TabsTrigger value="information">Information</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <OverviewTab planId={planId} planName={record.name} onOpenCharges={onOpenCharges} />
          </TabsContent>
          <TabsContent value="entitlements" className="pt-4">
            <EntitlementsTab planId={planId} />
          </TabsContent>
          <TabsContent value="credit-grants" className="pt-4">
            <CreditGrantsTab planId={planId} />
          </TabsContent>
          <TabsContent value="information" className="pt-4">
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
          </TabsContent>
        </Tabs>
      </DetailShell>

      <PlanEditorSheet
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

/** The rail's four numbers, built from the plan's charges and subscriptions. */
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

  const currencyMetric: DetailMetric = chargesPending
    ? { label: 'Currency', value: '—' }
    : currency
      ? { label: 'Currency', value: currency }
      : { label: 'Currency', value: '—', sentiment: 'muted', hint: 'Set by its first charge' }

  return [subscriptionsMetric, startsAtMetric, chargesMetric, currencyMetric]
}

/**
 * Overview — the charges the plan bills, beside a live customer-facing preview.
 *
 * Left, the charges table (add opens the two-pane builder, terminate ends a
 * charge behind a confirm); right, the same `PlanPreviewCard` the editor shows,
 * so the plan's live price and an example bill are always visible on the plan.
 */
function OverviewTab({
  planId,
  planName,
  onOpenCharges,
}: {
  planId: string
  planName: string
  onOpenCharges: () => void
}) {
  const charges = usePrices(PriceEntityType.Plan, planId)
  const terminate = useTerminatePrice()
  const [terminating, setTerminating] = useState<Charge | null>(null)

  if (charges.isPending) return <LoadingRows />

  const rows = charges.data ?? []
  const previewCharges = rows.map(toDraftCharge)
  const meterName = (id: string) => rows.find((c) => c.meterId === id)?.meterName ?? id

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Section title="Charges" description="What this plan bills, and how.">
          <ChargeTable
            charges={rows}
            onAdd={onOpenCharges}
            onTerminate={(charge) => setTerminating(charge)}
          />
        </Section>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <PlanPreviewCard name={planName} charges={previewCharges} meterLabel={meterName} />
        </div>
      </div>

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
  const features = useFeatures(DEFAULT_FEATURE_QUERY)
  const create = useCreateBulkEntitlements()
  const remove = useDeleteEntitlement()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Entitlement | null>(null)

  // Only features not already entitled can be added — a feature is granted once.
  const granted = new Set((entitlements.data ?? []).map((e) => e.featureId))
  const options: FeatureOption[] = (features.data?.features ?? [])
    .filter((f) => !granted.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      ...(f.type === FeatureType.Metered && f.unitPlural ? { unit: f.unitPlural } : {}),
    }))

  if (entitlements.isPending) return <LoadingRows />

  const submit = (draft: CreateEntitlement) => {
    create.mutate(
      { entityType: EntitlementEntityType.Plan, entityId: planId, entitlements: [draft] },
      { onSuccess: () => setAdding(false) },
    )
  }

  return (
    <>
      <EntitlementTable
        entitlements={entitlements.data ?? []}
        onAdd={() => setAdding(true)}
        onDelete={(entitlement) => setRemoving(entitlement)}
      />
      <EntitlementDrawer
        open={adding}
        onOpenChange={setAdding}
        features={options}
        onSubmit={submit}
        isSubmitting={create.isPending}
        submitError={create.isError ? 'Could not add the entitlement. Try again.' : null}
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
  const remove = useDeleteCreditGrant()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<CreditGrant | null>(null)

  if (grants.isPending) return <LoadingRows />

  const submit = (grant: CreateCreditGrant) => {
    create.mutate(
      { scope: CreditGrantScope.Plan, id: planId, grant },
      { onSuccess: () => setAdding(false) },
    )
  }

  return (
    <>
      <CreditGrantTable
        grants={grants.data ?? []}
        onAdd={() => setAdding(true)}
        onDelete={(grant) => setRemoving(grant)}
      />
      <CreditGrantDialog
        open={adding}
        onOpenChange={setAdding}
        onSubmit={submit}
        isSubmitting={create.isPending}
        submitError={create.isError ? 'Could not create the grant. Try again.' : null}
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
