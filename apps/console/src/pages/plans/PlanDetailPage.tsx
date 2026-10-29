import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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
  PLAN_KIND_LABEL,
  PLAN_STATUS_LABEL,
  PriceEntityType,
  PriceType,
  PlanStatus,
  chargeToDraft,
  creditGrantToEdit,
  entitlementToEdit,
  planKind,
  PlanKind,
  usageBasedLabel,
} from '@fp/domain'
import {
  useArchivePlan,
  useCreateBulkEntitlements,
  useCreateBulkPrices,
  useCreateCreditGrant,
  useCreditGrants,
  useDeleteCreditGrant,
  useDeleteEntitlement,
  useEntitlements,
  usePlan,
  useEntityIntegrationControls,
  useEntityIntegrationLinks,
  usePrices,
  usePriceHistory,
  useSyncPlanPrices,
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
  ContractIntegrations,
  type ContractIntegrationsProps,
  PlanEntitlementsView,
  Pill,
  Status,
  pricingSummary,
} from '@fp/ui/pages'
import {
  ConfirmDialog,
  DetailBreadcrumb,
  DetailHeader,
  DetailTabs,
  EditableCard,
  FormDialog,
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
import { usePlanFormOptions } from './planFormOptions'
import { DuplicatePlanDialog } from './DuplicatePlanDialog'
import { TerminateChargeDialog } from '../shared/TerminateChargeDialog'
import { priceHistoryRows } from '@/pages/shared/priceHistory'
import { detailGate } from '../shared/detailGate'
import { subTab } from '../shared/subTab'
import { useContractSync } from '../shared/useContractSync'

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
          planId={planId}
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
 * Charges: what the plan bills, as one searchable table. "Add charge" opens a
 * dialog that asks Fixed or Usage first; a row's Edit opens the form directly.
 * An edit is saved as a new price version; terminate ends a charge behind a confirm.
 */
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
      <ChargesSection planId={planId} readOnly={readOnly} />
      <EntitlementsSection planId={planId} />
      <CreditGrantsSection planId={planId} />
    </>
  )
}

function SavedPlanPreview({
  planId,
  onJump,
}: {
  planId: string
  onJump: (target: string) => void
}) {
  const charges = usePrices(PriceEntityType.Plan, planId)
  const entitlements = useEntitlements(EntitlementEntityType.Plan, planId)
  const grants = useCreditGrants(CreditGrantScope.Plan, planId)
  const { meters, allFeatures } = usePlanFormOptions()
  return (
    <PlanCustomerPreview
      className="lg:sticky lg:top-6"
      charges={charges.data ?? []}
      entitlements={entitlements.data ?? []}
      grants={grants.data ?? []}
      meterUnit={(id) => meters.find((meter) => meter.id === id)?.unit}
      featureUnit={(id) => allFeatures.find((feature) => feature.id === id)?.unitPlural}
      onJump={onJump}
    />
  )
}

function ChargesSection({ planId, readOnly }: { planId: string; readOnly: boolean }) {
  // Ended prices too, so an edited charge keeps its earlier price as history.
  const charges = usePriceHistory(PriceEntityType.Plan, planId)
  const { meters, units, priceGroups } = usePlanFormOptions()
  const create = useCreateBulkPrices()
  const updatePrice = useUpdatePrice()
  const [form, setForm] = useState<'add' | Charge | null>(null)
  const [terminating, setTerminating] = useState<Charge | null>(null)

  const { charges: rows, details } = priceHistoryRows(charges.data ?? [])
  const loading = charges.isPending || (charges.isError && charges.isFetching)
  const failed = charges.isError && !charges.isFetching
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
        details={details}
        onRevert={(charge, versionId) => {
          // No revert endpoint: the earlier price is saved as a new version from now.
          const previous = (charges.data ?? []).find((price) => price.id === versionId)
          return previous
            ? updatePrice.mutateAsync({
                id: charge.id,
                body: toUpdatePriceRequest(chargeToDraft(previous)),
              })
            : Promise.reject(new Error('That version is no longer on this plan.'))
        }}
        readOnly={readOnly}
        loading={loading}
        error={failed}
        onRetry={() => void charges.refetch()}
        meterUnit={(id) => meters.find((m) => m.id === id)?.unit}
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
        priceGroups={priceGroups}
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

      <TerminateChargeDialog
        charge={terminating}
        noun="plan"
        onClose={() => setTerminating(null)}
      />
    </>
  )
}

/**
 * Entitlements: what the plan includes of each feature. The last column shows
 * the plan's usage price for a metered feature, found by matching the feature's
 * meter to a usage charge; usage beyond the value bills at that price.
 */
function EntitlementsSection({ planId }: { planId: string }) {
  const navigate = useNavigate()
  const entitlements = useEntitlements(EntitlementEntityType.Plan, planId)
  const charges = usePrices(PriceEntityType.Plan, planId)
  const { featureOptions, allFeatures } = usePlanFormOptions()
  const create = useCreateBulkEntitlements()
  const updateEntitlement = useUpdateEntitlement()
  const remove = useDeleteEntitlement()
  const [form, setForm] = useState<'add' | Entitlement | null>(null)
  const [removing, setRemoving] = useState<Entitlement | null>(null)

  // Only features not already entitled can be added: a feature is granted once.
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
        {...subTab(entitlements, 'entitlements')}
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
            grantModel
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

/** Credit grants: the balances the plan hands its subscribers. */
function CreditGrantsSection({ planId }: { planId: string }) {
  const grants = useCreditGrants(CreditGrantScope.Plan, planId)
  const create = useCreateCreditGrant()
  const updateGrant = useUpdateCreditGrant()
  const remove = useDeleteCreditGrant()
  const [form, setForm] = useState<'add' | CreditGrant | null>(null)
  const [removing, setRemoving] = useState<CreditGrant | null>(null)

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
        {...subTab(grants, 'credit grants')}
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
            // Any end date archives a plan's grant at once (the API's
            // DeleteCreditGrant), so it is not offered.
            allowEndDate={false}
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
  // Usage only: no flat price to qualify, so name what it meters instead.
  if (kind === PlanKind.Usage) {
    return usageBasedLabel(usage.map((c) => c.displayName || c.meterName || ''))
  }
  return PLAN_KIND_LABEL[kind]
}

function billedLabel(charges: Charge[]): string | null {
  const period = charges.find((c) => c.type === PriceType.Fixed)?.billingPeriod
  const label = period ? BILLING_PERIOD_LABEL[period as BillingPeriod] : undefined
  return label ? `Billed ${label.toLowerCase()}` : null
}
