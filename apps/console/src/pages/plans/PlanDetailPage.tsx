import { useMemo, useState } from 'react'
import {
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreatePlan,
  CreditGrantScope,
  DEFAULT_FEATURE_QUERY,
  EntitlementEntityType,
  FeatureType,
  PLAN_STATUS_LABEL,
  PriceEntityType,
  PlanStatus,
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
  usePrices,
  useSyncPlanPrices,
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
} from '@fp/ui/flexprice'
import { AppFailure, LoadingRows, PageBody, PageHeader } from '@fp/ui/compositions'
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
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
 * tabs. Overview is the charges the plan bills (Add opens the two-pane editor);
 * Entitlements and Credit Grants are what it includes; Information is the record
 * itself. The header carries the actions on the plan as a whole — edit its
 * details, duplicate it, archive it, and push charge changes onto live
 * subscriptions.
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

  const [editing, setEditing] = useState(false)

  if (plan.isPending) {
    return (
      <PageBody>
        <LoadingRows />
      </PageBody>
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
    <>
      <PageHeader
        title={record.name}
        description={record.description || 'A plan in your catalogue.'}
        breadcrumb={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={isArchived ? 'outline' : 'secondary'}>
              {PLAN_STATUS_LABEL[record.status]}
            </Badge>
            {record.lookupKey ? <span className="font-mono text-xs">{record.lookupKey}</span> : null}
          </div>
        }
        action={
          <Button
            variant="outline"
            disabled={sync.isPending}
            onClick={() => sync.mutate(planId)}
          >
            <RefreshCwIcon aria-hidden className="size-4" />
            {sync.isPending ? 'Syncing…' : 'Sync usage charges'}
          </Button>
        }
        menu={
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
              <DropdownMenuItem
                disabled={isArchived}
                onClick={() => archive.mutate(planId, { onSuccess: onArchived })}
              >
                <EyeOffIcon aria-hidden className="size-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <PageBody>
        <Tabs value={tab} onValueChange={(value) => onTabChange(value as PlanTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
            <TabsTrigger value="credit-grants">Credit Grants</TabsTrigger>
            <TabsTrigger value="information">Information</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <OverviewTab planId={planId} onOpenCharges={onOpenCharges} />
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
              description={record.description}
              status={PLAN_STATUS_LABEL[record.status]}
              createdAt={record.createdAt}
              onEdit={() => setEditing(true)}
            />
          </TabsContent>
        </Tabs>
      </PageBody>

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
    </>
  )
}

/** Overview — the charges the plan bills. */
function OverviewTab({ planId, onOpenCharges }: { planId: string; onOpenCharges: () => void }) {
  const charges = usePrices(PriceEntityType.Plan, planId)

  if (charges.isPending) return <LoadingRows />
  return <ChargeTable charges={charges.data ?? []} onAdd={onOpenCharges} />
}

/** Entitlements — what the plan includes of each feature. */
function EntitlementsTab({ planId }: { planId: string }) {
  const entitlements = useEntitlements(EntitlementEntityType.Plan, planId)
  const features = useFeatures(DEFAULT_FEATURE_QUERY)
  const create = useCreateBulkEntitlements()
  const remove = useDeleteEntitlement()
  const [adding, setAdding] = useState(false)

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
        onDelete={(entitlement) => remove.mutate(entitlement.id)}
      />
      <EntitlementDrawer
        open={adding}
        onOpenChange={setAdding}
        features={options}
        onSubmit={submit}
        isSubmitting={create.isPending}
        submitError={create.isError ? 'Could not add the entitlement. Try again.' : null}
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
        onDelete={(grant) => remove.mutate(grant.id)}
      />
      <CreditGrantDialog
        open={adding}
        onOpenChange={setAdding}
        onSubmit={submit}
        isSubmitting={create.isPending}
        submitError={create.isError ? 'Could not create the grant. Try again.' : null}
      />
    </>
  )
}

/** Information — the plan record itself. */
function InformationTab({
  name,
  lookupKey,
  description,
  status,
  createdAt,
  onEdit,
}: {
  name: string
  lookupKey: string
  description: string
  status: string
  createdAt: Date | null
  onEdit: () => void
}) {
  const created = useMemo(
    () => (createdAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(createdAt) : '—'),
    [createdAt],
  )

  const rows: Array<[string, string]> = [
    ['Name', name],
    ['Lookup key', lookupKey || '—'],
    ['Description', description || '—'],
    ['Status', status],
    ['Created', created],
  ]

  return (
    <Card className="max-w-2xl">
      <CardContent className="flex flex-col gap-0 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Plan details</h2>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <PencilIcon aria-hidden className="size-4" />
            Edit
          </Button>
        </div>
        {rows.map(([label, value], index) => (
          <div key={label}>
            {index > 0 ? <Separator /> : null}
            <div className="grid grid-cols-3 gap-3 py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="col-span-2 break-words">{value}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
