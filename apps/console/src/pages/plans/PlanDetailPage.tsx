import { useEffect, useState } from 'react'
import {
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  type Charge,
  CreditGrantScope,
  EntitlementEntityType,
  PLAN_KIND_LABEL,
  PLAN_STATUS_LABEL,
  PriceEntityType,
  PriceType,
  PlanStatus,
  planKind,
  PlanKind,
} from '@fp/domain'
import {
  useArchivePlan,
  useCreditGrants,
  useEntitlements,
  usePlan,
  useEntityIntegrationControls,
  useEntityIntegrationLinks,
  usePrices,
  useSyncPlanPrices,
  useUpdatePlan,
} from '@fp/query'
import {
  PlanCustomerPreview,
  ContractIntegrations,
  type ContractIntegrationsProps,
  Pill,
  Status,
} from '@fp/ui/pages'
import {
  ConfirmDialog,
  DetailBreadcrumb,
  DetailHeader,
  DetailTabs,
  EditableCard,
  MetadataCard,
  RelatedCard,
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
  PlugIcon,
  RefreshCwIcon,
} from '@fp/ui/icons'
import { DuplicatePlanDialog } from './DuplicatePlanDialog'
import { detailGate } from '../shared/detailGate'
import { useContractSync } from '../shared/useContractSync'
import {
  CatalogChargesSection,
  CatalogCreditGrantsSection,
  CatalogEntitlementsSection,
} from '../shared/CatalogSections'

/**
 * A plan's detail page: the hub where a plan is completed.
 *
 * Header: icon tile, name, lookup key as a copyable id, badges and one ⋯ menu
 * holding every action on the plan as a whole (sync, edit, duplicate, archive). Tabs: Charges,
 * Entitlements, Credit grants, Information. Add and edit happen in dialogs; every destructive action goes through a
 * `ConfirmDialog` first.
 *
 * The page fetches and composes; every piece it renders is a presentational
 * component from `@fp/ui`.
 */

/**
 * Two tabs, not four.
 *
 * Charges, Entitlements and Credit grants were a tab each, holding one table
 * apiece, so seeing what a plan actually contains meant three clicks and
 * remembering the first two. They are all on Overview now, beside the
 * customer's-eye rail: the same shape the feature detail page uses, and what
 * the redesign shows.
 */
export const PLAN_TABS = ['overview', 'information'] as const
export type PlanTab = (typeof PLAN_TABS)[number]

/**
 * The tabs that used to exist, and where their links go now.
 *
 * `/plans/:id?tab=entitlements` is a link someone may have bookmarked or
 * pasted in a ticket. It still opens the plan, on the tab that now holds
 * entitlements, rather than silently falling back as if the parameter were
 * a typo.
 */
const RETIRED_TABS: Record<string, PlanTab> = {
  charges: 'overview',
  entitlements: 'overview',
  'credit-grants': 'overview',
}

export function parsePlanTab(value: unknown): PlanTab {
  if (PLAN_TABS.includes(value as PlanTab)) return value as PlanTab
  return (typeof value === 'string' ? RETIRED_TABS[value] : undefined) ?? 'overview'
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
  const [linkingIntegration, setLinkingIntegration] = useState(false)
  const [jumpTarget, setJumpTarget] = useState<string | null>(null)
  useEffect(() => {
    if (tab !== 'overview' || !jumpTarget) return
    const target = document.getElementById(jumpTarget)
    if (target) {
      target.scrollIntoView({ block: 'start' })
      target.tabIndex = -1
      target.focus({ preventScroll: true })
    }
    setJumpTarget(null)
  }, [tab, jumpTarget])
  const plan = usePlan(planId)
  const mappings = useEntityIntegrationControls('plan', planId)
  const update = useUpdatePlan()
  const archive = useArchivePlan()
  const sync = useSyncPlanPrices()
  const syncing = useContractSync('plan', planId)

  // The header's kind badge is read off the charges. The Overview sections
  // read the same key, so react-query serves them from this one fetch.
  const charges = usePrices(PriceEntityType.Plan, planId)

  const [archiving, setArchiving] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  if (!plan.data) {
    return detailGate(plan, {
      noun: 'this plan',
      listName: 'plans',
      onBack: onNavigateToList,
      recordPath: `/plans/${encodeURIComponent(planId)}`,
    })
  }

  const record = plan.data
  const isArchived = record.status === PlanStatus.Archived

  const charged = charges.data ?? []

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
      <DetailHeader
        breadcrumb={
          <DetailBreadcrumb
            trail={[{ label: 'Plans', onClick: onNavigateToList }, { label: 'Plan details' }]}
          />
        }
        icon={<LayersIcon />}
        title={record.name}
        id={record.id}
        leading={
          mappings.controls ? (
            <ContractIntegrations
              {...mappings.controls}
              entityLabel="plan"
              showLink={false}
              linkOpen={linkingIntegration}
              onLinkOpenChange={setLinkingIntegration}
            />
          ) : undefined
        }
        badges={
          <>
            <Status value={PLAN_STATUS_LABEL[record.status]} />
            {charges.isSuccess ? <Pill>{planKindLabel(charged)}</Pill> : null}
            {billedLabel(charged) ? <Pill>{billedLabel(charged)}</Pill> : null}
          </>
        }
        actions={
          <>
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
                {mappings.controls?.linkable.length ? (
                  <DropdownMenuItem onClick={() => setLinkingIntegration(true)}>
                    <PlugIcon className="text-muted-foreground" aria-hidden />
                    Link integration
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  disabled={sync.isPending || syncing.watching || isArchived}
                  onClick={() => sync.mutate(planId, { onSuccess: syncing.started })}
                >
                  <RefreshCwIcon className="text-muted-foreground" aria-hidden />
                  {sync.isPending || syncing.watching ? 'Syncing…' : 'Sync to contracts'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(planId)}>
                  <PencilIcon className="text-muted-foreground" aria-hidden />
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDuplicating(true)}>
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
          { value: 'overview', label: 'Overview' },
          { value: 'information', label: 'Information' },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {tab === 'overview' ? <OverviewTab planId={planId} readOnly={isArchived} /> : null}
          {tab === 'information' ? (
            <InformationTab
              integrationControls={mappings.controls}
              planId={planId}
              name={record.name}
              lookupKey={record.lookupKey}
              description={record.description}
              metadata={record.metadata}
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
        </div>
        <SavedPlanPreview
          plan={{ id: planId, name: record.name, description: record.description }}
          onJump={(target) => {
            setJumpTarget(target)
            onTabChange('overview')
          }}
        />
      </div>

      <DuplicatePlanDialog
        plan={duplicating ? record : null}
        onClose={() => setDuplicating(false)}
        onDuplicated={onDuplicated}
      />
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title="Archive this plan?"
        description="Archiving retires the plan from the catalogue. Existing contracts keep billing; the plan can no longer be added to new ones."
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
 * Everything a plan contains, on one screen.
 *
 * Charges, entitlements and credit grants were a tab each, holding one table
 * apiece: so the answer to "what is in this plan?" was spread across three
 * clicks. They stack here instead, beside the customer's-eye rail, which is
 * the whole point of the rail: the price being edited and the price a
 * customer would be shown, side by side.
 *
 * Each section fetches its own rows. They are the same queries, under the same
 * keys, so react-query serves the second and third reader from cache.
 */
function OverviewTab({ planId, readOnly }: { planId: string; readOnly: boolean }) {
  return (
    <>
      <CatalogChargesSection entity="plan" entityId={planId} readOnly={readOnly} />
      <CatalogEntitlementsSection entity="plan" entityId={planId} />
      <CatalogCreditGrantsSection entity="plan" entityId={planId} />
    </>
  )
}

function SavedPlanPreview({
  plan,
  onJump,
}: {
  plan: { id: string; name: string; description: string }
  onJump: (target: string) => void
}) {
  const charges = usePrices(PriceEntityType.Plan, plan.id)
  const entitlements = useEntitlements(EntitlementEntityType.Plan, plan.id)
  const grants = useCreditGrants(CreditGrantScope.Plan, plan.id)
  return (
    <PlanCustomerPreview
      className="lg:sticky lg:top-6"
      plan={plan}
      charges={charges.data ?? []}
      entitlements={entitlements.data ?? []}
      grants={grants.data ?? []}
      onJump={onJump}
    />
  )
}

/**
 * Information: the plan record. One pencil on the card edits its fields in
 * place; the metadata card on the right edits, adds and removes key/value fields.
 */
function InformationTab({
  planId,
  integrationControls,
  name,
  lookupKey,
  description,
  metadata,
  createdAt,
  updatedAt,
  readOnly,
  onSave,
}: {
  integrationControls?: ContractIntegrationsProps | undefined
  planId: string
  name: string
  lookupKey: string
  description: string
  metadata: Record<string, string>
  createdAt: Date | null
  updatedAt: Date | null
  readOnly: boolean
  onSave: (patch: {
    name?: string
    lookupKey?: string
    description?: string
    metadata?: Record<string, string>
  }) => Promise<unknown>
}) {
  const mappings = useEntityIntegrationLinks('plan', planId)
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <EditableCard
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
              next === '' || /^[a-z0-9_-]+$/.test(next)
                ? null
                : 'Use lowercase letters, numbers, hyphens and underscores',
          },
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
      <div className="grid gap-5 xl:grid-cols-2">
        <MetadataCard
          metadata={metadata}
          {...(readOnly
            ? {}
            : { onSave: (next: Record<string, string>) => onSave({ metadata: next }) })}
        />
        <RelatedCard items={[]}>
          {integrationControls?.links.length ? (
            <ContractIntegrations
              {...integrationControls}
              layout="rows"
              entityLabel="plan"
              showLink={false}
            />
          ) : mappings.data?.length ? (
            <ContractIntegrations
              layout="rows"
              links={mappings.data}
              linkable={[]}
              entityLabel="plan"
            />
          ) : (
            <div className="text-muted-foreground px-6 py-4 text-sm">
              {mappings.isPending ? (
                'Loading integrations…'
              ) : mappings.isError ? (
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    void mappings.refetch()
                  }}
                >
                  Retry integrations
                </button>
              ) : (
                'No linked integrations.'
              )}
            </div>
          )}
        </RelatedCard>
      </div>
    </div>
  )
}

/**
 * The same label the Type column shows in the plans grid.
 *
 * The grid reads the split off the plan's expanded prices; here the charges
 * are already loaded, so they are counted directly. Both go through
 * `planKind`, so the badge and the column cannot drift apart.
 */
function planKindLabel(charges: Charge[]): string {
  const usage = charges.filter((c) => c.type === PriceType.Usage)
  const kind = planKind({
    fixedChargeCount: charges.filter((c) => c.type === PriceType.Fixed).length,
    usageChargeCount: usage.length,
  })
  if (kind === PlanKind.Usage) return 'Usage-based'
  return PLAN_KIND_LABEL[kind]
}

function billedLabel(charges: Charge[]): string | null {
  const period = charges.find((c) => c.type === PriceType.Fixed)?.billingPeriod
  const label = period ? BILLING_PERIOD_LABEL[period as BillingPeriod] : undefined
  return label ? `Billed ${label.toLowerCase()}` : null
}
