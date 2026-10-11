import { useState, type ReactNode } from 'react'
import {
  CircleAlertIcon,
  PlusIcon,
  CirclePauseIcon,
  ClockIcon,
  InfoIcon,
  PlayIcon,
  RefreshCwIcon,
  XCircleIcon,
} from '@ui/icons'
import {
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  CreditGrantCadence,
  SUBSCRIPTION_SCHEDULE_LABEL,
  SubscriptionStatus,
  formatMoney,
  type AddContractCharge,
  type ChangeLineQuantity,
  type CreditGrant,
  type EditContractCharge,
  type EndContractCharge,
  type Invoice,
  type LineChangePreview,
  type SubscriptionDetail,
  type SubscriptionEntitlement,
  type SubscriptionLine,
  type SubscriptionSchedule,
  type SubscriptionUsage,
  type SubscriptionUsageCharge,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { ScrollArea } from '@ui/components/primitives/scroll-area'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Badge } from '@ui/components/reui/badge'
import { AccountActivityRail } from '@ui/components/blocks/solution-billing-4/components/account-activity-rail'
import { provenance } from '@ui/provenance'
import {
  DetailMoreMenu,
  DetailTabs,
  Properties,
  SummaryRow,
} from '../../compositions/detail/DetailKit'
import { DetailShell } from '../../compositions/detail/DetailShell'
import { MetadataCard } from '../../compositions/detail/MetadataCard'
import { RelatedCard, type RelatedItem } from '../../compositions/detail/RelatedCard'
import { Section } from '../../compositions/layout/Section'
import { SectionEmpty } from '../../compositions/feedback/SectionEmpty'
import { LoadingRows } from '../../compositions/feedback/States'
import { DetailTable, type DetailColumn } from '../shared/DetailTable'
import { EntityLink } from '../shared/cells'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { InvoiceStatusBadge } from '../shared/StatusBadge'
import type { InvoiceActivity } from '../billing/invoices/invoiceDocument'
import type { MeterOption, PriceUnitOption } from '../product-catalog/charges/ChargeForm'
import { ContractQuantityDialog } from './ContractQuantityDialog'
import { ContractChargeDialog, type ContractChargeDialogState } from './ContractChargeDialog'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

export const SubscriptionDetailViewProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/DetailShell',
    'compositions/MetadataCard',
    'compositions/RelatedCard',
    '@reui/alert',
    '@reui/badge',
    'blocks/solution-billing-4',
  ],
  note: 'Contract detail (read-only): DetailShell header with every action in More, lifecycle banners, a summary row, five tabs (Overview, Pricing, Usage, Invoices, Entitlements and credits) and an Activity, Metadata, Related rail.',
})

/** One section's data with its own loading and failure state, so a slow tab never blocks the page. */
export interface SubscriptionPart<T> {
  data: T | undefined
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

export type SubscriptionActivity = InvoiceActivity

export interface SubscriptionDetailViewProps {
  subscription: SubscriptionDetail
  lines: SubscriptionPart<SubscriptionLine[]>
  entitlements: SubscriptionPart<SubscriptionEntitlement[]>
  creditGrants: SubscriptionPart<CreditGrant[]>
  usage: SubscriptionPart<SubscriptionUsage>
  invoices: SubscriptionPart<Invoice[]>
  schedules: SubscriptionPart<SubscriptionSchedule[]>
  activity: SubscriptionActivity[]
  onBack?: () => void
  onOpenCustomer?: () => void
  onOpenPlan?: () => void
  onOpenInvoice?: (invoiceId: string) => void
  /** Incomplete contracts only: the More item and the banner button. */
  onActivate?: () => void
  onCancel?: () => void
  /**
   * Charge editing on the Pricing tab. Each handler returns when the request has
   * finished; a rejection keeps the dialog open and shows the error. Leave all
   * three out for a read-only Pricing tab.
   */
  onAddCharge?: ((draft: AddContractCharge) => Promise<void> | void) | undefined
  onEditCharge?:
    ((line: SubscriptionLine, draft: EditContractCharge) => Promise<void> | void) | undefined
  onEndCharge?:
    ((line: SubscriptionLine, draft: EndContractCharge) => Promise<void> | void) | undefined
  /**
   * Quantity (and flat-fee price) changes on fixed charges. Both are needed: the
   * change is always previewed before it is confirmed.
   */
  onPreviewQuantity?:
    ((line: SubscriptionLine, draft: ChangeLineQuantity) => Promise<LineChangePreview>) | undefined
  onChangeQuantity?:
    ((line: SubscriptionLine, draft: ChangeLineQuantity) => Promise<void> | void) | undefined
  /** The metered features and custom price units the charge forms offer. */
  meters?: MeterOption[] | undefined
  priceUnits?: PriceUnitOption[] | undefined
}

type SubscriptionTab = 'overview' | 'pricing' | 'usage' | 'invoices' | 'entitlements'

const day = (date: Date | null | undefined) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : '—'

const LINE_SOURCE_LABEL: Record<SubscriptionLine['source'], string> = {
  plan: 'From plan',
  addon: 'Add-on',
  contract: 'Contract only',
}

const isEnded = (line: SubscriptionLine) =>
  line.endDate !== null && line.endDate.getTime() <= Date.now()

const words = (value: string) => value.replaceAll('_', ' ').toLowerCase()

/**
 * One contract (the API's subscription), read-only. The header carries only the
 * ID and badges, with every action in More. Lifecycle state (not started,
 * cancelling, cancelled, paused, trialing, a queued change) is a banner above
 * the summary; the Incomplete banner is the one place an action sits outside
 * More. The rail is Activity, Metadata, Related, as on invoices.
 */
export function SubscriptionDetailView({
  subscription,
  lines,
  entitlements,
  creditGrants,
  usage,
  invoices,
  schedules,
  activity,
  onBack,
  onOpenCustomer,
  onOpenPlan,
  onOpenInvoice,
  onActivate,
  onCancel,
  onAddCharge,
  onEditCharge,
  onEndCharge,
  onPreviewQuantity,
  onChangeQuantity,
  meters = [],
  priceUnits = [],
}: SubscriptionDetailViewProps) {
  const [tab, setTab] = useState<SubscriptionTab>('overview')
  const [dialog, setDialog] = useState<ContractChargeDialogState | null>(null)
  const [saving, setSaving] = useState(false)
  const [quantityLine, setQuantityLine] = useState<SubscriptionLine | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const s = subscription
  const isCancelled = s.status === SubscriptionStatus.Cancelled
  const isCancelling = !isCancelled && (s.cancelAtPeriodEnd || s.cancelAt !== null)
  const canCancel = !isCancelled && !isCancelling && !s.cancelledAt
  const canActivate = s.status === SubscriptionStatus.Incomplete && Boolean(onActivate)
  const title = `${s.customerName} on ${s.planName}`

  const endsOn = isCancelled
    ? (s.cancelledAt ?? s.endDate)
    : s.cancelAtPeriodEnd
      ? s.currentPeriodEnd
      : (s.cancelAt ?? s.currentPeriodEnd)
  const endLabel = isCancelled ? 'Ended' : isCancelling ? 'Ends' : 'Renews'

  const canEditCharges = !isCancelled && !isCancelling
  const canAddCharge =
    Boolean(onAddCharge) && canEditCharges && s.status !== SubscriptionStatus.Trialing

  // A fixed charge is edited through its quantity (and flat price), previewed
  // before it is saved; a metered one through the full price form.
  const canChangeQuantity = Boolean(onPreviewQuantity && onChangeQuantity)
  const editLine = (line: SubscriptionLine) =>
    line.kind === 'fixed' ? setQuantityLine(line) : setDialog({ mode: 'edit', line })
  const canEditLine = (line: SubscriptionLine) =>
    line.kind === 'fixed' ? canChangeQuantity : Boolean(onEditCharge)
  const chargeActionColumns: DetailColumn<SubscriptionLine>[] =
    canEditCharges && (onEditCharge || onEndCharge || canChangeQuantity)
      ? [
          {
            key: 'actions',
            header: 'Actions',
            width: 48,
            cell: (line) =>
              isEnded(line) ? null : (
                <RowActionsMenu
                  label={line.name}
                  {...(canEditLine(line) ? { onEdit: () => editLine(line) } : {})}
                  {...(onEndCharge ? { onRemove: () => setDialog({ mode: 'end', line }) } : {})}
                  removeLabel="End charge"
                />
              ),
          },
        ]
      : []

  const closeDialog = () => {
    setDialog(null)
    setSaveError(null)
  }
  const run = async (action: Promise<void> | void) => {
    setSaving(true)
    setSaveError(null)
    try {
      await action
      setDialog(null)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The change could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const usageData = usage.data
  const latestInvoice =
    invoices.data?.find((invoice) => invoice.id === s.latestInvoice?.id) ?? invoices.data?.[0]
  const entitlementCount = (entitlements.data?.length ?? 0) + (creditGrants.data?.length ?? 0)

  const related: RelatedItem[] = [
    {
      id: 'customer',
      label: 'Customer',
      value: s.customerName,
      ...(onOpenCustomer ? { onOpen: onOpenCustomer } : {}),
    },
    {
      id: 'plan',
      label: 'Plan',
      value: s.planName,
      ...(onOpenPlan ? { onOpen: onOpenPlan } : {}),
    },
    ...(s.latestInvoice && onOpenInvoice
      ? [
          {
            id: 'latest-invoice',
            label: 'Latest invoice',
            value: s.latestInvoice.number || s.latestInvoice.id,
            onOpen: () => onOpenInvoice(s.latestInvoice!.id),
          },
        ]
      : []),
  ]

  return (
    <DetailShell
      trail={[{ label: 'Contracts', ...(onBack ? { onClick: onBack } : {}) }, { label: title }]}
      icon={<RefreshCwIcon />}
      title={title}
      id={s.id}
      badges={
        <>
          <SubscriptionStatusBadge status={s.status} />
          <Badge variant="outline" size="lg" radius="full">
            {s.billingPeriodLabel}
          </Badge>
          <Badge variant="outline" size="lg" radius="full">
            {s.currency || 'No currency'}
          </Badge>
        </>
      }
      actions={
        <DetailMoreMenu
          label="Contract actions"
          items={[
            ...(canActivate && onActivate
              ? [{ id: 'activate', label: 'Activate', icon: <PlayIcon />, onSelect: onActivate }]
              : []),
            {
              id: 'cancel',
              label: 'Cancel contract',
              icon: <XCircleIcon />,
              destructive: true,
              disabled: !canCancel || !onCancel,
              onSelect: () => onCancel?.(),
            },
          ]}
        />
      }
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Banners
            subscription={s}
            schedules={schedules.data ?? []}
            {...(canActivate && onActivate ? { onActivate } : {})}
          />

          <SummaryRow
            items={[
              { label: 'Billing cycle', value: s.billingPeriodLabel, hint: s.currency },
              {
                label: endLabel,
                value: day(endsOn),
                hint: s.currentPeriodStart
                  ? `Period began ${day(s.currentPeriodStart)}`
                  : undefined,
              },
              {
                label: 'Usage this period',
                value: usageData ? formatMoney(usageData.total) : '—',
                hint:
                  usageData?.hasOverage && usageData.overage ? (
                    <>Overage {formatMoney(usageData.overage)}</>
                  ) : undefined,
              },
              {
                label: 'Commitment',
                value: s.commitmentAmount ? formatMoney(s.commitmentAmount) : 'None',
                hint:
                  usageData?.commitmentUtilized && s.commitmentAmount ? (
                    <>{formatMoney(usageData.commitmentUtilized)} used</>
                  ) : undefined,
              },
            ]}
          />

          <DetailTabs
            value={tab}
            onChange={(next) => setTab(next as SubscriptionTab)}
            tabs={[
              { value: 'overview', label: 'Overview' },
              {
                value: 'pricing',
                label: 'Pricing',
                ...(lines.data ? { count: lines.data.length } : {}),
              },
              { value: 'usage', label: 'Usage' },
              {
                value: 'invoices',
                label: 'Invoices',
                ...(invoices.data ? { count: invoices.data.length } : {}),
              },
              {
                value: 'entitlements',
                label: 'Entitlements & credits',
                ...(entitlements.data && creditGrants.data ? { count: entitlementCount } : {}),
              },
            ]}
          />

          {tab === 'overview' ? (
            <>
              <PartSection
                title="Charges"
                part={lines}
                failure="Charges could not be loaded"
                emptyTitle="No charges"
                emptyDescription="This contract has no priced lines."
                isEmpty={(rows) => rows.length === 0}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3"
                    onClick={() => setTab('pricing')}
                  >
                    {onAddCharge && canEditCharges ? 'Manage pricing' : 'View pricing'}
                  </Button>
                }
              >
                {(rows) => {
                  const live = rows.filter((line) => !isEnded(line))
                  return (
                    <DetailTable<SubscriptionLine>
                      label="Charges"
                      noun="charges"
                      rows={live.slice(0, 5)}
                      toolbar={false}
                      columns={[
                        { key: 'name', header: 'Charge', cell: (line) => line.name },
                        {
                          key: 'source',
                          header: 'Source',
                          cell: (line) => <LineSourceBadge line={line} />,
                        },
                        {
                          key: 'quantity',
                          header: 'Quantity',
                          cell: (line) => line.quantity || '—',
                        },
                        {
                          key: 'period',
                          header: 'Billed',
                          cell: (line) => line.billingPeriodLabel,
                        },
                        {
                          key: 'amount',
                          header: 'Price',
                          cell: (line) => (
                            <span className="tabular-nums">{formatMoney(line.amount)}</span>
                          ),
                        },
                        ...chargeActionColumns,
                      ]}
                    />
                  )
                }}
              </PartSection>

              <div className="grid items-start gap-6 lg:grid-cols-2">
                <Section title="Contract">
                  <Properties
                    columns={2}
                    items={[
                      {
                        label: 'Customer',
                        value: onOpenCustomer ? (
                          <EntityLink label={s.customerName} onOpen={onOpenCustomer} />
                        ) : (
                          s.customerName
                        ),
                      },
                      {
                        label: 'Plan',
                        value: onOpenPlan ? (
                          <EntityLink label={s.planName} onOpen={onOpenPlan} />
                        ) : (
                          s.planName
                        ),
                      },
                      { label: 'Started', value: day(s.startDate) },
                      {
                        label: 'Current period',
                        value: `${day(s.currentPeriodStart)} – ${day(s.currentPeriodEnd)}`,
                      },
                      ...(s.trialStart || s.trialEnd
                        ? [{ label: 'Trial', value: `${day(s.trialStart)} – ${day(s.trialEnd)}` }]
                        : []),
                      ...(s.endDate ? [{ label: 'Ends', value: day(s.endDate) }] : []),
                      ...(s.lookupKey
                        ? [
                            {
                              label: 'Lookup key',
                              value: <span className="font-mono text-xs">{s.lookupKey}</span>,
                            },
                          ]
                        : []),
                    ]}
                  />
                </Section>
                <Section title="Billing & collection">
                  <Properties
                    columns={2}
                    items={[
                      {
                        label: 'Billing',
                        value:
                          s.billingPeriodCount > 1
                            ? `Every ${s.billingPeriodCount} × ${s.billingPeriodLabel.toLowerCase()}`
                            : s.billingPeriodLabel,
                      },
                      {
                        label: 'Collection',
                        value: s.collectionMethod ? words(s.collectionMethod) : '—',
                      },
                      {
                        label: 'Payment terms',
                        value: s.paymentTerms ? words(s.paymentTerms) : '—',
                      },
                      { label: 'Timezone', value: s.timezone || '—' },
                      {
                        label: 'Commitment',
                        value: s.commitmentAmount ? formatMoney(s.commitmentAmount) : 'None',
                      },
                    ]}
                  />
                </Section>
              </div>

              {latestInvoice ? (
                <Section
                  title="Latest invoice"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3"
                      onClick={() => setTab('invoices')}
                    >
                      All invoices
                    </Button>
                  }
                >
                  <Properties
                    columns={4}
                    items={[
                      {
                        label: 'Invoice',
                        value: onOpenInvoice ? (
                          <EntityLink
                            label={latestInvoice.number}
                            onOpen={() => onOpenInvoice(latestInvoice.id)}
                          />
                        ) : (
                          latestInvoice.number
                        ),
                      },
                      {
                        label: 'Status',
                        value: <InvoiceStatusBadge status={latestInvoice.status} />,
                      },
                      { label: 'Total', value: formatMoney(latestInvoice.total) },
                      { label: 'Due', value: day(latestInvoice.dueDate) },
                    ]}
                  />
                </Section>
              ) : null}
            </>
          ) : null}

          {tab === 'pricing' ? (
            <>
              <PartSection
                title="Pricing"
                part={lines}
                failure="Pricing could not be loaded"
                emptyTitle="No priced lines"
                emptyDescription="This contract has no priced lines."
                isEmpty={(rows) => rows.length === 0}
                {...(canAddCharge
                  ? {
                      action: (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3"
                          onClick={() => setDialog({ mode: 'add' })}
                        >
                          <PlusIcon aria-hidden="true" />
                          Add charge
                        </Button>
                      ),
                    }
                  : {})}
              >
                {(rows) => (
                  <DetailTable<SubscriptionLine>
                    label="Pricing"
                    noun="lines"
                    rows={rows}
                    toolbar={false}
                    columns={[
                      { key: 'name', header: 'Charge', cell: (line) => line.name },
                      {
                        key: 'source',
                        header: 'Source',
                        cell: (line) => <LineSourceBadge line={line} />,
                      },
                      {
                        key: 'kind',
                        header: 'Type',
                        cell: (line) => (line.kind === 'usage' ? 'Usage' : 'Fixed'),
                      },
                      {
                        key: 'quantity',
                        header: 'Quantity',
                        cell: (line) => line.quantity || '—',
                      },
                      { key: 'period', header: 'Billed', cell: (line) => line.billingPeriodLabel },
                      {
                        key: 'amount',
                        header: 'Price',
                        cell: (line) => (
                          <span className="tabular-nums">{formatMoney(line.amount)}</span>
                        ),
                      },
                      ...chargeActionColumns,
                    ]}
                  />
                )}
              </PartSection>
              {lines.data?.some((line) => line.source === 'plan') ? (
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 px-1 text-[13px]">
                  Charges marked From plan are shared by every contract on {s.planName}. Editing
                  them here changes this contract only.
                  {onOpenPlan ? (
                    <>
                      {' '}
                      To change them for everyone,{' '}
                      <EntityLink label="edit the plan" onOpen={onOpenPlan} />.
                    </>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : null}

          {tab === 'usage' ? (
            <>
              <PartSection
                title="This period"
                part={usage}
                failure="Usage could not be loaded"
                emptyTitle="No usage yet"
                emptyDescription="Nothing has been consumed this period."
                isEmpty={() => false}
                padded
              >
                {(data) => (
                  <Properties
                    columns={4}
                    items={[
                      {
                        label: 'Period',
                        value: `${day(data.periodStart)} – ${day(data.periodEnd)}`,
                      },
                      { label: 'Usage to date', value: formatMoney(data.total) },
                      {
                        label: 'Commitment',
                        value: data.commitment ? formatMoney(data.commitment) : 'None',
                      },
                      {
                        label: 'Overage',
                        value: data.overage ? formatMoney(data.overage) : 'None',
                      },
                    ]}
                  />
                )}
              </PartSection>
              {usage.data ? (
                <Section title="Charges" flush bare={usage.data.charges.length > 0}>
                  {usage.data.charges.length === 0 ? (
                    <SectionEmpty
                      title="No metered charges"
                      description="This contract has no usage-based charges this period."
                    />
                  ) : (
                    <DetailTable<SubscriptionUsageCharge>
                      label="Usage charges"
                      noun="charges"
                      rows={usage.data.charges}
                      toolbar={false}
                      columns={[
                        {
                          key: 'name',
                          header: 'Charge',
                          cell: (charge) => (
                            <span className="flex items-center gap-2">
                              {charge.name}
                              {charge.isOverage ? (
                                <Badge variant="outline" size="sm" radius="full">
                                  Overage
                                </Badge>
                              ) : null}
                            </span>
                          ),
                        },
                        {
                          key: 'quantity',
                          header: 'Quantity',
                          cell: (charge) => (
                            <span className="tabular-nums">
                              {charge.quantity.toLocaleString('en-US')}
                            </span>
                          ),
                        },
                        {
                          key: 'amount',
                          header: 'Amount',
                          cell: (charge) => (
                            <span className="tabular-nums">{formatMoney(charge.amount)}</span>
                          ),
                        },
                      ]}
                    />
                  )}
                </Section>
              ) : null}
            </>
          ) : null}

          {tab === 'invoices' ? (
            <PartSection
              title="Invoices"
              part={invoices}
              failure="Invoices could not be loaded"
              emptyTitle="No invoices yet"
              emptyDescription="Invoices for this contract appear here once a billing period closes."
              isEmpty={(rows) => rows.length === 0}
            >
              {(rows) => (
                <DetailTable<Invoice>
                  label="Contract invoices"
                  noun="invoices"
                  rows={rows}
                  toolbar={false}
                  {...(onOpenInvoice ? { onRowClick: (row) => onOpenInvoice(row.id) } : {})}
                  columns={[
                    {
                      key: 'number',
                      header: 'Invoice',
                      cell: (row) => <span className="font-mono text-xs">{row.number}</span>,
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (row) => <InvoiceStatusBadge status={row.status} />,
                    },
                    {
                      key: 'period',
                      header: 'Period',
                      cell: (row) => (
                        <span className="text-muted-foreground">
                          {day(row.periodStart)} – {day(row.periodEnd)}
                        </span>
                      ),
                    },
                    {
                      key: 'due',
                      header: 'Due',
                      cell: (row) => (
                        <span className="text-muted-foreground">{day(row.dueDate)}</span>
                      ),
                    },
                    {
                      key: 'total',
                      header: 'Total',
                      cell: (row) => <span className="tabular-nums">{formatMoney(row.total)}</span>,
                    },
                    {
                      key: 'due-amount',
                      header: 'Amount due',
                      cell: (row) => (
                        <span className="tabular-nums">{formatMoney(row.amountDue)}</span>
                      ),
                    },
                  ]}
                />
              )}
            </PartSection>
          ) : null}

          {tab === 'entitlements' ? (
            <>
              <PartSection
                title="Entitlements"
                part={entitlements}
                failure="Entitlements could not be loaded"
                emptyTitle="No features"
                emptyDescription="This contract includes no features."
                isEmpty={(rows) => rows.length === 0}
              >
                {(rows) => (
                  <DetailTable<SubscriptionEntitlement>
                    label="Entitlements"
                    noun="features"
                    rows={rows}
                    toolbar={false}
                    getRowId={(row) => row.featureId || row.name}
                    columns={[
                      { key: 'feature', header: 'Feature', cell: (row) => row.name },
                      {
                        key: 'access',
                        header: 'Access',
                        cell: (row) => (row.enabled ? 'Included' : 'Not included'),
                      },
                      {
                        key: 'limit',
                        header: 'Limit',
                        cell: (row) =>
                          row.usageLimit === null
                            ? 'Unlimited'
                            : `${row.usageLimit.toLocaleString('en-US')}${row.softLimit ? ' (soft)' : ''}${row.resetPeriodLabel ? ` / ${row.resetPeriodLabel.toLowerCase()}` : ''}`,
                      },
                    ]}
                  />
                )}
              </PartSection>
              <PartSection
                title="Credit grants"
                part={creditGrants}
                failure="Credit grants could not be loaded"
                emptyTitle="No credit grants"
                emptyDescription="This contract has no credit grants."
                isEmpty={(rows) => rows.length === 0}
              >
                {(rows) => (
                  <DetailTable<CreditGrant>
                    label="Credit grants"
                    noun="grants"
                    rows={rows}
                    toolbar={false}
                    columns={[
                      { key: 'name', header: 'Grant', cell: (row) => row.name },
                      {
                        key: 'credits',
                        header: 'Credits',
                        cell: (row) => <span className="tabular-nums">{row.credits}</span>,
                      },
                      {
                        key: 'cadence',
                        header: 'Cadence',
                        cell: (row) =>
                          row.cadence === CreditGrantCadence.Recurring && row.period
                            ? `${CREDIT_GRANT_CADENCE_LABEL[row.cadence]} · ${CREDIT_GRANT_PERIOD_LABEL[row.period].toLowerCase()}`
                            : CREDIT_GRANT_CADENCE_LABEL[row.cadence],
                      },
                      {
                        key: 'expiry',
                        header: 'Expiry',
                        cell: (row) => (
                          <span className="text-muted-foreground">
                            {CREDIT_GRANT_EXPIRY_TYPE_LABEL[row.expirationType]}
                          </span>
                        ),
                      },
                    ]}
                  />
                )}
              </PartSection>
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 xl:sticky xl:top-6">
          <Section title="Activity" flush>
            {activity.length === 0 ? (
              <p className="text-muted-foreground px-6 py-5 text-[13px]">No activity yet.</p>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <div className="p-5">
                  <AccountActivityRail
                    events={activity.map((event) => ({ ...event, labels: [] }))}
                  />
                </div>
              </ScrollArea>
            )}
          </Section>
          <MetadataCard metadata={s.metadata} />
          <RelatedCard items={related} />
        </div>
      </div>
      {onPreviewQuantity && onChangeQuantity ? (
        <ContractQuantityDialog
          line={quantityLine}
          currency={s.currency}
          period={{ start: s.currentPeriodStart, end: s.currentPeriodEnd }}
          onClose={() => setQuantityLine(null)}
          onPreview={onPreviewQuantity}
          onConfirm={async (line, draft) => {
            await onChangeQuantity(line, draft)
            setQuantityLine(null)
          }}
        />
      ) : null}
      <ContractChargeDialog
        state={dialog}
        onClose={closeDialog}
        currency={s.currency}
        billingPeriod={s.billingPeriod}
        meters={meters}
        priceUnits={priceUnits}
        isSubmitting={saving}
        submitError={saveError}
        onAdd={(draft) => void run(onAddCharge?.(draft))}
        onEdit={(line, draft) => void run(onEditCharge?.(line, draft))}
        onEnd={(line, draft) => void run(onEndCharge?.(line, draft))}
      />
    </DetailShell>
  )
}

/**
 * The lifecycle banners above the summary. At most one of the state banners
 * (not started, cancelled, cancelling, paused, trialing) shows, in that order of
 * importance; queued changes follow, one per schedule.
 */
function Banners({
  subscription: s,
  schedules,
  onActivate,
}: {
  subscription: SubscriptionDetail
  schedules: SubscriptionSchedule[]
  onActivate?: () => void
}) {
  const banners: ReactNode[] = []

  if (s.status === SubscriptionStatus.Incomplete) {
    banners.push(
      <Alert key="incomplete" variant="warning">
        <CircleAlertIcon aria-hidden="true" />
        <AlertTitle>This contract has not started</AlertTitle>
        <AlertDescription>Activate it to start the billing cycle.</AlertDescription>
        {onActivate ? (
          <AlertAction>
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={onActivate}>
              Activate
            </Button>
          </AlertAction>
        ) : null}
      </Alert>,
    )
  } else if (s.status === SubscriptionStatus.Cancelled) {
    banners.push(
      <Alert key="cancelled">
        <XCircleIcon aria-hidden="true" />
        <AlertTitle>Cancelled</AlertTitle>
        <AlertDescription>
          This contract was cancelled on {day(s.cancelledAt ?? s.endDate)}. It no longer bills.
        </AlertDescription>
      </Alert>,
    )
  } else if (s.cancelAtPeriodEnd || s.cancelAt) {
    banners.push(
      <Alert key="cancelling" variant="warning">
        <ClockIcon aria-hidden="true" />
        <AlertTitle>Cancelling</AlertTitle>
        <AlertDescription>
          This contract ends on {day(s.cancelAtPeriodEnd ? s.currentPeriodEnd : s.cancelAt)} and
          will not renew.
        </AlertDescription>
      </Alert>,
    )
  } else if (s.status === SubscriptionStatus.Paused) {
    banners.push(
      <Alert key="paused">
        <CirclePauseIcon aria-hidden="true" />
        <AlertTitle>Paused</AlertTitle>
        <AlertDescription>Billing is paused for this contract.</AlertDescription>
      </Alert>,
    )
  } else if (s.status === SubscriptionStatus.Trialing) {
    banners.push(
      <Alert key="trialing" variant="info">
        <InfoIcon aria-hidden="true" />
        <AlertTitle>In trial</AlertTitle>
        <AlertDescription>
          The trial ends on {day(s.trialEnd)}. Billing starts after that.
        </AlertDescription>
      </Alert>,
    )
  }

  for (const schedule of schedules) {
    banners.push(
      <Alert key={schedule.id} variant="info">
        <ClockIcon aria-hidden="true" />
        <AlertTitle>{SUBSCRIPTION_SCHEDULE_LABEL[schedule.type]} scheduled</AlertTitle>
        <AlertDescription>
          Takes effect on {day(schedule.scheduledAt)}
          {schedule.daysUntilExecution !== null
            ? ` (${schedule.daysUntilExecution === 1 ? 'in 1 day' : `in ${schedule.daysUntilExecution} days`})`
            : ''}
          .
        </AlertDescription>
      </Alert>,
    )
  }

  if (banners.length === 0) return null
  return <div className="flex flex-col gap-3">{banners}</div>
}

/** Where a charge comes from; an ended charge also says when it ended. */
function LineSourceBadge({ line }: { line: SubscriptionLine }) {
  return (
    <span className="flex items-center gap-2">
      <Badge
        variant={line.source === 'contract' ? 'info-outline' : 'outline'}
        size="sm"
        radius="full"
      >
        {LINE_SOURCE_LABEL[line.source]}
      </Badge>
      {isEnded(line) ? (
        <span className="text-muted-foreground text-xs">Ended {day(line.endDate)}</span>
      ) : null}
    </span>
  )
}

/** A titled section whose body is one part of the page: loading, failed, empty, or the data. */
function PartSection<T>({
  title,
  part,
  failure,
  emptyTitle,
  emptyDescription,
  isEmpty,
  padded = false,
  action,
  children,
}: {
  title: string
  part: SubscriptionPart<T>
  failure: string
  emptyTitle: string
  emptyDescription: string
  isEmpty: (data: T) => boolean
  /** The body is not a table, so it keeps the section's own inset. */
  padded?: boolean
  action?: ReactNode
  children: (data: T) => ReactNode
}) {
  const { data } = part
  if (part.isLoading || (!data && !part.isError)) {
    return (
      <Section title={title} action={action}>
        <LoadingRows />
      </Section>
    )
  }
  if (part.isError || !data) {
    return (
      <Section title={title} flush action={action}>
        <SectionEmpty
          title={failure}
          description="The rest of the page still works."
          action={
            part.onRetry ? (
              <Button size="sm" variant="outline" className="h-8 px-3" onClick={part.onRetry}>
                Try again
              </Button>
            ) : undefined
          }
        />
      </Section>
    )
  }
  if (isEmpty(data)) {
    return (
      <Section title={title} flush action={action}>
        <SectionEmpty title={emptyTitle} description={emptyDescription} />
      </Section>
    )
  }
  return padded ? (
    <Section title={title} action={action}>
      {children(data)}
    </Section>
  ) : (
    <Section title={title} flush bare={!action} action={action}>
      {children(data)}
    </Section>
  )
}
