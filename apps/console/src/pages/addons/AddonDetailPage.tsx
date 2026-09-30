import { useState } from 'react'
import {
  type Addon,
  type Charge,
  type CreateAddon,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreditGrant,
  type EditCreditGrant,
  type EditEntitlement,
  type Entitlement,
  type Money,
  BILLING_PERIOD_LABEL,
  CreditGrantScope,
  DEFAULT_FEATURE_QUERY,
  EntitlementEntityType,
  FeatureType,
  PriceEntityType,
  compareMoney,
  creditGrantToEdit,
  entitlementToEdit,
  formatMoney,
  moneyOr,
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
  AddonEditorDialog,
  CatalogStatusBadge,
  ChargeTable,
  CreditGrantDialog,
  CreditGrantTable,
  EntitlementDialog,
  EntitlementTable,
  type FeatureOption,
} from '@fp/ui/flexprice'
import {
  AppFailure,
  ConfirmDialog,
  DetailList,
  type DetailMetric,
  DetailShell,
  LoadingRows,
  PageBody,
} from '@fp/ui/compositions'
import {
  Button,
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@fp/ui/primitives'
import { PencilIcon } from 'lucide-react'

export interface AddonDetailPageProps {
  addonId: string
  onNavigateToList: () => void
}

/** The tabs, in order. Overview leads with the add-on's prices. */
type AddonTab = 'overview' | 'entitlements' | 'credit-grants' | 'information'

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
 * The page fetches and composes; every relational section is a presentational
 * component from `@fp/ui`, and every destructive action passes through a
 * `ConfirmDialog` — a charge is terminated, an entitlement or grant removed, only
 * after a confirming beat.
 */
export function AddonDetailPage({ addonId, onNavigateToList }: AddonDetailPageProps) {
  const addon = useAddon(addonId)
  const update = useUpdateAddon()
  // Fetched here too (deduped by react-query) so the rail can carry real counts.
  const prices = usePrices(PriceEntityType.Addon, addonId)
  const entitlements = useEntitlements(EntitlementEntityType.Addon, addonId)

  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<AddonTab>('overview')

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
  const metrics = buildMetrics({
    charges: prices.data ?? [],
    chargesPending: prices.isPending,
    entitlementCount: (entitlements.data ?? []).length,
    entitlementsPending: entitlements.isPending,
  })

  const closeEditor = () => {
    setEditing(false)
    update.reset()
  }

  const submit = (draft: CreateAddon) => {
    update.mutate({ id: data.id, draft }, { onSuccess: closeEditor })
  }

  return (
    <>
      <DetailShell
        breadcrumb={
          <button
            type="button"
            onClick={onNavigateToList}
            className="text-muted-foreground hover:text-foreground w-fit text-xs transition-colors"
          >
            ← Add-ons
          </button>
        }
        title={data.name}
        badges={<CatalogStatusBadge status={data.status} />}
        identifier={data.lookupKey || data.id}
        {...(data.description ? { description: data.description } : {})}
        actions={
          <Button onClick={() => setEditing(true)}>
            <PencilIcon aria-hidden className="size-4" />
            Edit
          </Button>
        }
        metrics={metrics}
      >
        <Tabs value={tab} onValueChange={(value) => setTab(value as AddonTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
            <TabsTrigger value="credit-grants">Credit Grants</TabsTrigger>
            <TabsTrigger value="information">Information</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <PricesTab addonId={addonId} />
          </TabsContent>
          <TabsContent value="entitlements" className="pt-4">
            <EntitlementsTab addonId={addonId} />
          </TabsContent>
          <TabsContent value="credit-grants" className="pt-4">
            <CreditGrantsTab addonId={addonId} />
          </TabsContent>
          <TabsContent value="information" className="pt-4">
            <InformationTab addon={data} />
          </TabsContent>
        </Tabs>
      </DetailShell>

      <AddonEditorDialog
        open={editing}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
        mode="edit"
        defaultValue={{
          name: data.name,
          lookupKey: data.lookupKey,
          description: data.description,
        }}
        onSubmit={submit}
        isSubmitting={update.isPending}
        submitError={toSubmitError(update.error)}
      />
    </>
  )
}

/** Overview — the prices this add-on carries. Terminating one is confirmed first. */
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
  const entitlements = useEntitlements(EntitlementEntityType.Addon, addonId)
  const features = useFeatures(DEFAULT_FEATURE_QUERY)
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

  return (
    <>
      <EntitlementTable
        entitlements={entitlements.data ?? []}
        onAdd={() => setAdding(true)}
        onEdit={(entitlement) => setEditing(entitlement)}
        onDelete={(entitlement) => setTarget(entitlement)}
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
        submitError={updateEntitlement.isError ? 'Could not save the entitlement. Try again.' : null}
      />
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

  return (
    <>
      <CreditGrantTable
        grants={grants.data ?? []}
        onAdd={() => setAdding(true)}
        onEdit={(grant) => setEditing(grant)}
        onDelete={(grant) => setTarget(grant)}
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

/** Information — the add-on record itself, its attributes shown once. */
function InformationTab({ addon }: { addon: Addon }) {
  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-5">
        <DetailList
          items={[
            { label: 'Status', value: <CatalogStatusBadge status={addon.status} /> },
            { label: 'Lookup key', value: addon.lookupKey || '—' },
            { label: 'Description', value: addon.description || '—', full: true },
            { label: 'Add-on ID', value: <span className="font-mono text-xs">{addon.id}</span> },
            { label: 'Created', value: formatDate(addon.createdAt) },
            { label: 'Updated', value: formatDate(addon.updatedAt) },
          ]}
        />
      </CardContent>
    </Card>
  )
}

/**
 * The rail, with every tile that has no number in it left out.
 *
 * An add-on with no prices used to open on "Charges 0 · Starts at — ·
 * Currency — · Entitlements 0": four tiles carrying nothing, which on a 390px
 * phone ate roughly 310px of the first screen before any real content. The
 * house rule is that a rail tile is a number the add-on *has*, not a field it
 * is missing — so an unpriced add-on simply has fewer tiles, and one with
 * neither charges nor entitlements has no rail at all, the way feature detail
 * already omits it. `MetricRail` drops a rail whose every tile is blank, so
 * the loading '—' row does not flash an empty instrument panel either.
 */
function buildMetrics({
  charges,
  chargesPending,
  entitlementCount,
  entitlementsPending,
}: {
  charges: Charge[]
  chargesPending: boolean
  entitlementCount: number
  entitlementsPending: boolean
}): DetailMetric[] {
  const start = startingCharge(charges)
  const currency = charges.find((charge) => charge.currency)?.currency?.toUpperCase() ?? null

  const chargesMetric: DetailMetric | null = chargesPending
    ? { label: 'Charges', value: '—' }
    : charges.length > 0
      ? { label: 'Charges', value: charges.length.toLocaleString() }
      : null

  const startsAtMetric: DetailMetric | null = chargesPending
    ? { label: 'Starts at', value: '—' }
    : start
      ? {
          label: 'Starts at',
          value: formatMoney(start.money),
          hint: BILLING_PERIOD_LABEL[start.charge.billingPeriod],
        }
      : charges.length > 0
        ? { label: 'Starts at', value: 'Usage-based', sentiment: 'muted' }
        : null

  const currencyMetric: DetailMetric | null = chargesPending
    ? { label: 'Currency', value: '—' }
    : currency
      ? { label: 'Currency', value: currency }
      : null

  const entitlementsMetric: DetailMetric | null = entitlementsPending
    ? { label: 'Entitlements', value: '—' }
    : entitlementCount > 0
      ? { label: 'Entitlements', value: entitlementCount.toLocaleString() }
      : null

  return [chargesMetric, startsAtMetric, currencyMetric, entitlementsMetric].filter(
    (metric): metric is DetailMetric => metric !== null,
  )
}

/** The lowest-priced charge and its amount, for the "Starts at" metric. */
function startingCharge(charges: Charge[]): { charge: Charge; money: Money } | null {
  const priced = charges
    .map((charge) => {
      const money = amountMoney(charge)
      return money ? { charge, money } : null
    })
    .filter((entry): entry is { charge: Charge; money: Money } => entry !== null)

  const [first] = priced
  if (!first) return null

  // Compare within one currency — `compareMoney` refuses to compare across them.
  const currency = first.money.currency
  const sameCurrency = priced.filter((entry) => entry.money.currency === currency)
  return sameCurrency.reduce((min, entry) =>
    compareMoney(entry.money, min.money) < 0 ? entry : min,
  )
}

/** A charge's flat amount as `Money`, or null when it prices by tiers/usage alone. */
function amountMoney(charge: Charge): Money | null {
  const raw = charge.amount || charge.displayAmount
  if (!raw) return null
  try {
    return moneyOr(raw, charge.currency || null)
  } catch {
    return null
  }
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

/** A save failure, as a sentence the editor can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change add-ons here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the add-on. Try again.'
    }
  }
  return 'Could not save the add-on. Try again.'
}
