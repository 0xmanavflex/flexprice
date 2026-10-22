import { RBAC_ENTITY, type RbacEntity } from '@fp/domain'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import { useState, type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import {
  CircleAlertIcon,
  PackageIcon,
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
  AlertCondition,
  AlertSeverity,
  AlertThresholdType,
  PriceType,
  SubscriptionStatus,
  formatMoney,
  type AlertSettingConfig,
  type AddContractCharge,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreateTaxAssociation,
  type AddContractAddon,
  type AddContractCoupon,
  BILLING_PERIOD_LABEL,
  ChargeSection,
  type BillingPeriod,
  type ChangeLineQuantity,
  type Charge,
  type ChargeCommitmentDetail,
  type ChargeDetail,
  type ChargeAlert,
  type CreditGrant,
  type EditContractCharge,
  type IntegrationLink,
  type EndContractCharge,
  type Invoice,
  type InvoicePreview,
  type InvoicePreviewLine,
  type LineChangePreview,
  type Money,
  type SubscriptionAddon,
  type SubscriptionCoupon,
  type SubscriptionDetail,
  type SubscriptionEntitlement,
  type SubscriptionLine,
  lineLineages,
  type SubscriptionSchedule,
  type SubscriptionTax,
  type SubscriptionUsage,
  type SubscriptionUsageCharge,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { Badge } from '@ui/components/reui/badge'
import { provenance } from '@ui/provenance'
import {
  DetailMoreMenu,
  DetailTabs,
  OverviewTiles,
  Properties,
} from '../../compositions/detail/DetailKit'
import { ActivitySection, type ActivityLogEntry } from '../../compositions/detail/ActivityLog'
import { ChargeSheet } from '../product-catalog/charges/ChargeSheet'
import { ChargeTable, chargePriceLabel } from '../product-catalog/charges/ChargeTable'
import { DetailShell } from '../../compositions/detail/DetailShell'
import { MetadataCard } from '../../compositions/detail/MetadataCard'
import { RelatedCard, type RelatedItem } from '../../compositions/detail/RelatedCard'
import { Section } from '../../compositions/layout/Section'
import { ConfirmDialog } from '../../compositions/feedback/ConfirmDialog'
import { FormDialog } from '../../compositions/forms/FormDialog'
import type { EmptyScene } from '../../compositions/feedback/SceneIllustration'
import { SectionEmpty } from '../../compositions/feedback/SectionEmpty'
import { LoadingRows } from '../../compositions/feedback/States'
import { DetailTable, type DetailColumn } from '../shared/DetailTable'
import { EntityLink, Pill } from '../shared/cells'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { InvoiceStatusBadge } from '../shared/StatusBadge'
import { PaymentStatusBadge } from '../collections/payments/PaymentStatusBadge'
import type { InvoiceActivity } from '../billing/invoices/invoiceDocument'
import type { MeterOption, PriceUnitOption } from '../product-catalog/charges/ChargeForm'
import { ContractIntegrations, type LinkableProvider } from './ContractIntegrations'
import {
  ContractSectionDialogs,
  type ContractSectionKind,
  type ContractSectionOptions,
} from './ContractSectionDialogs'
import { ContractQuantityDialog } from './ContractQuantityDialog'
import { ChargeAlertForm } from './ChargeAlertForm'
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
    'compositions/ActivityLog',
  ],
  note: 'Contract detail (read-only): DetailShell header with every action in More, four tabs (Overview, Charges, Usage, Invoices) directly under it, and an Activity, Metadata, Related rail on Overview only. Lifecycle banners lead the Overview tab, then side-by-side Contract and Billing & collection panels, the upcoming invoice preview, contract-specific charges, entitlements, credit grants, add-ons, coupons and taxes.',
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
  /**
   * Every line the contract has had, ended ones included. When present, each
   * charge is shown once — its current version — and its earlier prices are
   * kept as inactive versions in its history rather than dropping out.
   */
  lineHistory?: SubscriptionLine[] | undefined
  /**
   * Bring a charge back to an earlier version: `line` is the version billing
   * now, `previous` the one to return to. Offered on the version just before
   * the current one, in the charge's History.
   */
  onRevertLine?:
    ((line: SubscriptionLine, previous: SubscriptionLine) => Promise<unknown>) | undefined
  entitlements: SubscriptionPart<SubscriptionEntitlement[]>
  creditGrants: SubscriptionPart<CreditGrant[]>
  usage: SubscriptionPart<SubscriptionUsage>
  invoices: SubscriptionPart<Invoice[]>
  schedules: SubscriptionPart<SubscriptionSchedule[]>
  activity: SubscriptionActivity[]
  /** Shown under an empty rail, for example while the audit trail is loading. */
  activityEmptyText?: string | undefined
  /** A change just landed and the new activity row is still being written. */
  activityAwaiting?: boolean | undefined
  /** The next invoice as it would be created now. Leave out to hide the section. */
  preview?: SubscriptionPart<InvoicePreview> | undefined
  addons?: SubscriptionPart<SubscriptionAddon[]> | undefined
  coupons?: SubscriptionPart<SubscriptionCoupon[]> | undefined
  chargeAlerts?: SubscriptionPart<Map<string, ChargeAlert[]>> | undefined
  taxes?: SubscriptionPart<SubscriptionTax[]> | undefined
  /** The customer's integration mappings, shown as marks in the header. */
  integrationLinks?: IntegrationLink[] | undefined
  /** Connected providers the customer is not yet linked to. */
  linkableProviders?: LinkableProvider[] | undefined
  onLinkIntegration?:
    ((input: { providerType: string; providerEntityId: string }) => Promise<unknown>) | undefined
  onUnlinkIntegration?: ((input: { providerType: string }) => Promise<unknown>) | undefined
  /**
   * The Add buttons on Overview's sections. Each returns when the request has
   * finished; a rejection keeps the dialog open and shows the error. A section's
   * button is left out when its handler is.
   */
  onAddEntitlement?: ((draft: CreateEntitlement) => Promise<unknown> | void) | undefined
  onAddCreditGrant?: ((draft: CreateCreditGrant) => Promise<unknown> | void) | undefined
  onAddAddon?: ((draft: AddContractAddon) => Promise<unknown> | void) | undefined
  onAddCoupon?: ((draft: AddContractCoupon) => Promise<unknown> | void) | undefined
  /**
   * Save the thresholds of an alert already watching one charge.
   *
   * The sheet's Alerts edit only appears when the setting id is known, because
   * an update cannot create a setting or move it to another line.
   */
  onSaveChargeAlert?:
    | ((draft: { settingId: string; config: AlertSettingConfig }) => Promise<unknown> | void)
    | undefined
  onAddTax?: ((draft: CreateTaxAssociation) => Promise<unknown> | void) | undefined
  /** Row menus: take an add-on off, stop a tax, end a credit grant. Each resolves when done. */
  onRemoveAddon?: ((addon: SubscriptionAddon) => Promise<unknown>) | undefined
  onRemoveTax?: ((tax: SubscriptionTax) => Promise<unknown>) | undefined
  onCancelCreditGrant?: ((grant: CreditGrant) => Promise<unknown>) | undefined
  /** What the Add dialogs offer. */
  sectionOptions?: Partial<ContractSectionOptions> | undefined
  onBack?: () => void
  onOpenCustomer?: () => void
  onOpenPlan?: () => void
  onOpenInvoice?: (invoiceId: string) => void
  /** Incomplete contracts only: the More item and the banner button. */
  onActivate?: () => void
  onCancel?: () => void
  /** Saves the contract's metadata map. Omitted, the metadata card is read-only. */
  onSaveMetadata?: (metadata: Record<string, string>) => Promise<unknown>
  /**
   * Charge editing on the Charges tab. Each handler returns when the request has
   * finished; a rejection keeps the dialog open and shows the error. Leave all
   * three out for a read-only Charges tab.
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

type SubscriptionTab = 'overview' | 'charges' | 'usage' | 'invoices'

const day = (date: Date | null | undefined) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    : '—'

const LINE_SOURCE_LABEL: Record<SubscriptionLine['source'], string> = {
  plan: 'Plan',
  addon: 'Add-on',
  contract: 'Contract',
}

/**
 * A contract's lines, as the shared charges table reads them.
 *
 * The line already carries its price (`line.charge`), so this is not a
 * conversion — it is the pairing of that price with what the contract knows
 * about it, and a way back to the line for the actions. A line with no price
 * bills nothing and has no row.
 *
 * Keyed by the price id, which is what the row's "Copy price ID" copies and
 * what the sheet is about. Two lines on one contract do not share a price.
 */
/** One row of the Overview's Commitments section. */
interface CommitmentRow {
  id: string
  charge: Charge
  name: string
  commitment: ChargeCommitmentDetail
  /** "per month", "every minute" — what the figure is measured against. */
  per: string
}

function chargesOfLines(lines: SubscriptionLine[]): {
  charges: Charge[]
  details: Map<string, ChargeDetail>
  lineOf: Map<string, SubscriptionLine>
} {
  const charges: Charge[] = []
  const details = new Map<string, ChargeDetail>()
  const lineOf = new Map<string, SubscriptionLine>()

  for (const line of lines) {
    if (!line.charge) continue
    charges.push(line.charge)
    lineOf.set(line.charge.id, line)

    const commitment = line.pricing?.terms.commitment
    const detail: ChargeDetail = {
      ...(line.overridesPriceId ? { overridden: true } : {}),
      ...(line.quantity ? { quantity: line.quantity } : {}),
      ...(commitment
        ? {
            commitment: {
              type: commitment.kind,
              // The figure as the line states it; the unit is the charge's own.
              value: commitment.value,
              duration: commitment.duration ?? null,
              overageFactor: Number(commitment.overageFactor) || 1,
              trueUp: commitment.trueUp,
              windowed: commitment.windowed,
              windows: (commitment.windows ?? []).map((window) => ({
                id: window.id,
                start: window.start,
                end: window.end,
                value: window.value,
                overageFactor: Number(window.overageFactor) || 1,
                trueUp: window.trueUp,
              })),
            },
          }
        : {}),
    }
    if (Object.keys(detail).length > 0) details.set(line.charge.id, detail)
  }

  return { charges, details, lineOf }
}

/** Upcoming-invoice lines shown before "More"; the rest appear on expanding, never paged. */
const PREVIEW_LINES_SHOWN = 5

const NO_PART: SubscriptionPart<never[]> = { data: [] }

const words = (value: string) => value.replaceAll('_', ' ').toLowerCase()

/**
 * One contract (the API's subscription), read-only. The header carries only the
 * ID and badges, with every action in More. Tabs sit directly under it.
 * Lifecycle state (not started, cancelling, cancelled, paused, trialing, a
 * queued change) is a banner at the top of Overview; the Incomplete banner is
 * the one place an action sits outside More. The rail is Activity, Metadata,
 * Related, on Overview only.
 */
export function SubscriptionDetailView({
  subscription,
  lines,
  lineHistory,
  onRevertLine,
  entitlements,
  creditGrants,
  usage,
  invoices,
  schedules,
  activity,
  activityEmptyText,
  activityAwaiting = false,
  preview,
  addons,
  coupons,
  chargeAlerts,
  taxes,
  integrationLinks,
  linkableProviders = [],
  onLinkIntegration,
  onUnlinkIntegration,
  onAddEntitlement,
  onAddCreditGrant,
  onAddAddon,
  onAddCoupon,
  onSaveChargeAlert,
  onAddTax,
  onRemoveAddon,
  onRemoveTax,
  onCancelCreditGrant,
  sectionOptions,
  onBack,
  onOpenCustomer,
  onOpenPlan,
  onOpenInvoice,
  onActivate,
  onSaveMetadata,
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
  /** The charge whose sheet the Commitments section opened, at its commitment. */
  const [commitmentCharge, setCommitmentCharge] = useState<Charge | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [section, setSection] = useState<ContractSectionKind | null>(null)
  /** Set while Change coupon is open, so the submit is scoped to that charge. */
  const [couponLineId, setCouponLineId] = useState<string | null>(null)
  const [alertEdit, setAlertEdit] = useState<{
    settingId: string
    config: AlertSettingConfig
  } | null>(null)
  // One confirm for every removal on the page: what it says, and what it runs.
  const [removal, setRemoval] = useState<{
    title: string
    description: string
    confirmLabel: string
    run: () => Promise<unknown>
  } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removalError, setRemovalError] = useState<string | null>(null)
  const askRemoval = (next: NonNullable<typeof removal>) => {
    setRemovalError(null)
    setRemoval(next)
  }
  /** A narrow ⋯ column with one destructive item, or nothing when the contract cannot change. */
  const removeColumn = <T,>(
    label: (row: T) => string,
    removeLabel: string,
    onRemove: ((row: T) => void) | null,
  ): DetailColumn<T>[] =>
    onRemove && canEditCharges
      ? [
          {
            key: 'actions',
            header: '',
            width: 48,
            cell: (row: T) => (
              <RowActionsMenu
                label={label(row)}
                onRemove={() => onRemove(row)}
                removeLabel={removeLabel}
              />
            ),
          },
        ]
      : []
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

  const closeSection = () => {
    setSection(null)
    setSaveError(null)
    setCouponLineId(null)
  }
  const runSection = async (action: Promise<unknown> | void) => {
    setSaving(true)
    setSaveError(null)
    try {
      await action
      setSection(null)
      setCouponLineId(null)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The change could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const open = (kind: ContractSectionKind) => () => {
    setSaveError(null)
    if (kind === 'coupon') setCouponLineId(null)
    setSection(kind)
  }
  const canModify = !isCancelled
  const createFor = (
    kind: ContractSectionKind,
    label: string,
    handler: unknown,
  ): { label: string; onClick: () => void } | undefined =>
    canModify && handler ? { label, onClick: open(kind) } : undefined

  const usageData = usage.data
  // With the full history, a charge is its newest version and the rest are history.
  const lineages = lineHistory ? lineLineages(lineHistory) : null
  const chargeRows = chargesOfLines(
    lineages ? lineages.map((lineage) => lineage.current) : (lines.data ?? []),
  )
  for (const lineage of lineages ?? []) {
    const chargeId = lineage.current.charge?.id
    if (!chargeId || lineage.versions.length < 2) continue
    chargeRows.details.set(chargeId, {
      ...chargeRows.details.get(chargeId),
      versions: lineage.versions.flatMap((version) =>
        version.charge
          ? [
              {
                id: version.id,
                price: chargePriceLabel(version.charge),
                startDate: version.startDate,
                endDate: version.endDate,
                updatedAt: version.charge.createdAt,
              },
            ]
          : [],
      ),
    })
  }
  for (const [chargeId, line] of chargeRows.lineOf) {
    const discounts = (coupons?.data ?? []).filter(
      (coupon) => coupon.active && coupon.lineItemId === line.id,
    )
    const alerts = chargeAlerts?.data?.get(line.id)
    if (discounts.length || alerts?.length) {
      chargeRows.details.set(chargeId, {
        ...chargeRows.details.get(chargeId),
        coupons: discounts.map((coupon) => ({
          code: coupon.code,
          name: coupon.name,
          discount: coupon.discount,
          endsAt: coupon.endDate,
        })),
        ...(alerts ? { alerts } : {}),
      })
    }
  }
  // From a charge's History: find its lineage and the version picked.
  const revertCharge =
    onRevertLine && lineages && canEditCharges
      ? (charge: Charge, versionId: string) => {
          const lineage = lineages.find((candidate) => candidate.current.charge?.id === charge.id)
          const previous = lineage?.versions.find((version) => version.id === versionId)
          return lineage && previous
            ? onRevertLine(lineage.current, previous)
            : Promise.reject(new Error('That version is no longer on this contract.'))
        }
      : undefined
  const editableChargeSections = (charge: Charge): ChargeSection[] => {
    const line = chargeRows.lineOf.get(charge.id)
    if (!canEditCharges || charge.endDate || !line || !canEditLine(line)) return []
    const sections: ChargeSection[] =
      line.kind === 'fixed'
        ? [ChargeSection.Price]
        : [ChargeSection.Price, ChargeSection.Commitment]
    if (onAddCoupon) sections.push(ChargeSection.Discount)
    const alerts = chargeRows.details.get(charge.id)?.alerts
    if (onSaveChargeAlert && alerts?.some((alert) => alert.settingId)) {
      sections.push(ChargeSection.Alerts)
    }
    return sections
  }
  const editCharge = (charge: Charge, part?: ChargeSection) => {
    const line = chargeRows.lineOf.get(charge.id)
    if (!line) return
    if (part === ChargeSection.Discount && onAddCoupon) {
      setSaveError(null)
      setCouponLineId(line.id)
      setSection('coupon')
      return
    }
    if (part === ChargeSection.Alerts && onSaveChargeAlert) {
      const draft = chargeAlertDraft(chargeRows.details.get(charge.id)?.alerts ?? [])
      if (draft) {
        setSaveError(null)
        setAlertEdit(draft)
        return
      }
    }
    editLine(line)
  }
  const endCharge = (charge: Charge) => {
    const line = chargeRows.lineOf.get(charge.id)
    if (line) setDialog({ mode: 'end', line })
  }
  /**
   * The charges that carry a commitment, for the Overview section.
   *
   * Read off the same `details` the charges table uses, so the section and
   * the row's Commitment flag can never disagree about which charges have
   * one. `per` spells out what the figure is per, because "2,000,000 units"
   * alone does not say whether that is a quarter or a minute.
   */
  const commitmentRows: CommitmentRow[] = chargeRows.charges.flatMap((charge) => {
    const commitment = chargeRows.details.get(charge.id)?.commitment
    if (!commitment) return []
    const period = BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ?? 'period'
    return [
      {
        id: charge.id,
        charge,
        name: charge.displayName || charge.meterName || 'Charge',
        commitment,
        per: commitment.windowed
          ? `every ${period.toLowerCase().replace(/ly$/, '')}`
          : `per ${period.toLowerCase()}`,
      },
    ]
  })

  /** The grey line's second half on a contract: where the charge came from. */
  const sourceOf = (charge: Charge) => {
    const line = chargeRows.lineOf.get(charge.id)
    if (!line) return undefined
    if (line.source === 'plan') return s.planName ? `From ${s.planName}` : 'From the plan'
    return line.source === 'addon' ? 'From an add-on' : 'Set on this contract'
  }

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
            value: s.latestInvoice.number || '—',
            onOpen: () => onOpenInvoice(s.latestInvoice!.id),
          },
        ]
      : []),
  ]

  const activityEntries: ActivityLogEntry[] = activity.map((event) => ({
    id: event.id,
    title: event.title,
    at: event.at,
    summary: event.summary,
    ...(event.record ? { record: event.record } : {}),
    ...(event.by ? { by: event.by } : {}),
    ...(event.href ? { href: event.href } : {}),
  }))

  return (
    <DetailShell
      trail={[
        { label: 'Contracts', ...(onBack ? { onClick: onBack } : {}) },
        { label: 'Contract details' },
      ]}
      icon={<RefreshCwIcon />}
      title={title}
      id={s.id}
      leading={
        integrationLinks && onLinkIntegration && onUnlinkIntegration ? (
          <ContractIntegrations
            showLink={false}
            links={integrationLinks}
            linkable={linkableProviders}
            onLink={onLinkIntegration}
            onUnlink={onUnlinkIntegration}
          />
        ) : undefined
      }
      badges={
        <>
          <SubscriptionStatusBadge status={s.status} />
          <Pill>{s.billingPeriodLabel}</Pill>
          <Pill>{s.currency || 'No currency'}</Pill>
        </>
      }
      actions={
        <DetailMoreMenu
          label="Contract actions"
          items={[
            ...(canActivate && onActivate
              ? [
                  {
                    id: 'activate',
                    label: 'Activate',
                    icon: <PlayIcon aria-hidden="true" className="size-4" />,
                    onSelect: onActivate,
                  },
                ]
              : []),
            {
              id: 'cancel',
              label: 'Cancel contract',
              icon: <XCircleIcon aria-hidden="true" className="size-4" />,
              destructive: true,
              disabled: !canCancel || !onCancel,
              onSelect: () => onCancel?.(),
            },
          ]}
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-6">
        {chargeAlerts?.isError ? (
          <div role="alert" className="text-muted-foreground text-sm">
            Charge alerts could not be loaded.{' '}
            <Button variant="link" onClick={chargeAlerts.onRetry}>
              Retry charge alerts
            </Button>
          </div>
        ) : null}
        {coupons?.isError ? (
          <div role="alert" className="text-muted-foreground text-sm">
            Charge discounts could not be loaded.{' '}
            <Button variant="link" onClick={coupons.onRetry}>
              Retry charge discounts
            </Button>
          </div>
        ) : null}
        <DetailTabs
          value={tab}
          onChange={(next) => setTab(next as SubscriptionTab)}
          tabs={[
            { value: 'overview', label: 'Overview' },
            {
              value: 'charges',
              label: 'Charges',
              ...(lines.data
                ? { count: chargeRows.charges.filter((charge) => !charge.endDate).length }
                : {}),
            },
            { value: 'usage', label: 'Usage' },
            {
              value: 'invoices',
              label: 'Invoices',
              ...(invoices.data ? { count: invoices.data.length } : {}),
            },
          ]}
        />

        {tab === 'overview' ? (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-6">
              <Banners
                subscription={s}
                schedules={schedules.data ?? []}
                {...(canActivate && onActivate ? { onActivate } : {})}
              />

              <ContractDetails
                subscription={s}
                usage={usageData}
                endLabel={endLabel}
                endsOn={endsOn}
                {...(onOpenCustomer ? { onOpenCustomer } : {})}
                {...(onOpenPlan ? { onOpenPlan } : {})}
              />

              {preview ? <InvoicePreviewSection status={s.status} preview={preview} /> : null}

              {/*
                The Overview's charges: only the ones this contract changed,
                and a way to the rest. The same table the Charges tab uses, in
                its summary shape, so a charge reads identically in both.
              */}
              <ChargeTable
                title="Charges"
                onEditSection={(charge, part) => editCharge(charge, part)}
                editableSections={editableChargeSections}
                variant="summary"
                {...(revertCharge ? { onRevert: revertCharge } : {})}
                layout="narrow"
                charges={chargeRows.charges}
                details={chargeRows.details}
                source={sourceOf}
                {...(s.billingPeriod ? { period: s.billingPeriod } : {})}
                onShowAll={() => setTab('charges')}
                isLoading={lines.isLoading ?? false}
                error={lines.isError ? 'Charges could not be loaded' : null}
                {...(lines.onRetry ? { onRetry: lines.onRetry } : {})}
              />

              {/*
                Commitments, between Charges and Entitlements as the redesign
                orders them. Only the charges that carry one: a contract with
                no commitments is not told it has none in a box of its own,
                it simply has one fewer section.

                A commitment is set on a charge, so a row opens that charge's
                sheet at its commitment rather than offering an editor here —
                one place to change it, reached from either direction.
              */}
              {commitmentRows.length > 0 ? (
                <Section table showTitle title="Commitments">
                  <DetailTable<CommitmentRow>
                    compact
                    toolbar={false}
                    footer={false}
                    label="Commitments"
                    noun="commitments"
                    rows={commitmentRows}
                    onRowClick={(row) => setCommitmentCharge(row.charge)}
                    columns={[
                      {
                        key: 'charge',
                        header: 'Charge',
                        cell: (row) => <Strong>{row.name}</Strong>,
                      },
                      {
                        key: 'commitment',
                        header: 'Commitment',
                        cell: (row) => (
                          <span className="tabular-nums">
                            {row.commitment.value}
                            <span className="text-muted-foreground"> {row.per}</span>
                          </span>
                        ),
                      },
                      {
                        key: 'overage',
                        header: 'Overage',
                        cell: (row) => (
                          <Muted className="tabular-nums">×{row.commitment.overageFactor}</Muted>
                        ),
                      },
                      {
                        key: 'trueUp',
                        header: 'True-up',
                        cell: (row) => (
                          <Muted>{row.commitment.trueUp ? 'Enabled' : 'Disabled'}</Muted>
                        ),
                      },
                    ]}
                  />
                </Section>
              ) : null}

              <PartSection
                entity={RBAC_ENTITY.Entitlement}
                title="Entitlements"
                showTitle
                part={entitlements}
                failure="Entitlements could not be loaded"
                emptyTitle="No features"
                scene="catalog"
                emptyDescription="This contract includes no features."
                create={createFor('entitlement', 'Add entitlement', onAddEntitlement)}
                isEmpty={(rows) => rows.length === 0}
              >
                {(rows) => (
                  <DetailTable<SubscriptionEntitlement>
                    compact
                    pageSize={5}
                    label="Entitlements"
                    noun="features"
                    rows={rows}
                    getRowId={(row) => row.featureId || row.name}
                    columns={[
                      {
                        key: 'feature',
                        header: 'Feature',
                        sortBy: (row) => row.name.toLowerCase(),
                        cell: (row) => <Strong>{row.name}</Strong>,
                      },
                      {
                        key: 'access',
                        header: 'Access',
                        cell: (row) => <Muted>{row.enabled ? 'Included' : 'Not included'}</Muted>,
                      },
                      {
                        key: 'limit',
                        header: 'Limit',
                        cell: (row) => (
                          <Muted>
                            {row.usageLimit === null
                              ? 'Unlimited'
                              : `${row.usageLimit.toLocaleString('en-US')}${row.softLimit ? ' (soft)' : ''}${row.resetPeriodLabel ? ` / ${row.resetPeriodLabel.toLowerCase()}` : ''}`}
                          </Muted>
                        ),
                      },
                    ]}
                  />
                )}
              </PartSection>

              <PartSection
                entity={RBAC_ENTITY.CreditGrant}
                title="Credit grants"
                showTitle
                part={creditGrants}
                failure="Credit grants could not be loaded"
                emptyTitle="No credit grants"
                scene="payments"
                emptyDescription="This contract has no credit grants."
                create={createFor('creditGrant', 'Add credit grant', onAddCreditGrant)}
                isEmpty={(rows) => rows.length === 0}
              >
                {(rows) => (
                  <DetailTable<CreditGrant>
                    compact
                    pageSize={5}
                    label="Credit grants"
                    noun="grants"
                    rows={rows}
                    columns={[
                      {
                        key: 'name',
                        header: 'Grant',
                        sortBy: (row) => row.name.toLowerCase(),
                        cell: (row) => <Strong>{row.name}</Strong>,
                      },
                      {
                        key: 'credits',
                        header: 'Credits',
                        cell: (row) => <Strong className="tabular-nums">{row.credits}</Strong>,
                      },
                      {
                        key: 'cadence',
                        header: 'Cadence',
                        cell: (row) => (
                          <Muted>
                            {row.cadence === CreditGrantCadence.Recurring && row.period
                              ? `${CREDIT_GRANT_CADENCE_LABEL[row.cadence]} · ${CREDIT_GRANT_PERIOD_LABEL[row.period].toLowerCase()}`
                              : CREDIT_GRANT_CADENCE_LABEL[row.cadence]}
                          </Muted>
                        ),
                      },
                      {
                        key: 'expiry',
                        header: 'Expiry',
                        cell: (row) => (
                          <Muted>{CREDIT_GRANT_EXPIRY_TYPE_LABEL[row.expirationType]}</Muted>
                        ),
                      },
                      ...removeColumn<CreditGrant>(
                        (row) => row.name,
                        'End grant',
                        onCancelCreditGrant
                          ? (grant) =>
                              askRemoval({
                                title: `End ${grant.name}?`,
                                description:
                                  'The grant stops today. Credits it already gave stay in the wallet; no further credits are granted.',
                                confirmLabel: 'End grant',
                                run: () => onCancelCreditGrant(grant),
                              })
                          : null,
                      ),
                    ]}
                  />
                )}
              </PartSection>

              <PartSection
                entity={RBAC_ENTITY.Addon}
                title="Add-ons"
                showTitle
                part={addons ?? NO_PART}
                create={createFor('addon', 'Add add-on', onAddAddon)}
                failure="Add-ons could not be loaded"
                emptyTitle="No add-ons"
                scene="catalog"
                emptyDescription="No add-ons are attached to this contract."
                isEmpty={(rows) => rows.length === 0}
              >
                {(rows) => (
                  <DetailTable<SubscriptionAddon>
                    compact
                    pageSize={5}
                    label="Add-ons"
                    noun="add-ons"
                    rows={rows}
                    columns={[
                      {
                        key: 'name',
                        header: 'Add-on',
                        sortBy: (row) => row.name.toLowerCase(),
                        cell: (row) => <Strong>{row.name}</Strong>,
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        cell: (row) => <ActiveBadge active={row.active} />,
                      },
                      {
                        key: 'start',
                        header: 'Starts',
                        cell: (row) => <Muted>{day(row.startDate)}</Muted>,
                      },
                      {
                        key: 'end',
                        header: 'Ends',
                        cell: (row) => <Muted>{day(row.endDate)}</Muted>,
                      },
                      ...removeColumn<SubscriptionAddon>(
                        (row) => row.name,
                        'Remove add-on',
                        onRemoveAddon
                          ? (addon) =>
                              askRemoval({
                                title: `Remove ${addon.name}?`,
                                description:
                                  'The add-on comes off this contract at the end of the current period. Charges already billed are unaffected.',
                                confirmLabel: 'Remove add-on',
                                run: () => onRemoveAddon(addon),
                              })
                          : null,
                      ),
                    ]}
                  />
                )}
              </PartSection>

              <PartSection
                title="Coupons"
                showTitle
                part={coupons ?? NO_PART}
                create={createFor('coupon', 'Add coupon', onAddCoupon)}
                failure="Coupons could not be loaded"
                emptyTitle="No coupons"
                scene="billing"
                emptyDescription="No coupons are applied to this contract."
                isEmpty={(rows) => rows.length === 0}
              >
                {(rows) => (
                  <DetailTable<SubscriptionCoupon>
                    compact
                    pageSize={5}
                    label="Coupons"
                    noun="coupons"
                    rows={rows}
                    columns={[
                      {
                        key: 'name',
                        header: 'Coupon',
                        sortBy: (row) => row.name.toLowerCase(),
                        cell: (row) => <Strong>{row.name}</Strong>,
                      },
                      {
                        key: 'code',
                        header: 'Code',
                        cell: (row) =>
                          row.code ? (
                            <Muted className="font-mono text-xs">{row.code}</Muted>
                          ) : (
                            <Muted>—</Muted>
                          ),
                      },
                      {
                        key: 'discount',
                        header: 'Discount',
                        cell: (row) => <Strong>{row.discount}</Strong>,
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        cell: (row) => <ActiveBadge active={row.active} />,
                      },
                      {
                        key: 'end',
                        header: 'Ends',
                        cell: (row) => <Muted>{day(row.endDate)}</Muted>,
                      },
                    ]}
                  />
                )}
              </PartSection>

              <PartSection
                entity={RBAC_ENTITY.Tax}
                title="Taxes"
                showTitle
                part={taxes ?? NO_PART}
                create={createFor('tax', 'Add tax', onAddTax)}
                failure="Taxes could not be loaded"
                emptyTitle="No taxes"
                scene="billing"
                emptyDescription="No tax rates are applied to this contract."
                isEmpty={(rows) => rows.length === 0}
              >
                {(rows) => (
                  <DetailTable<SubscriptionTax>
                    compact
                    pageSize={5}
                    label="Taxes"
                    noun="taxes"
                    rows={rows}
                    columns={[
                      {
                        key: 'name',
                        header: 'Tax',
                        sortBy: (row) => row.name.toLowerCase(),
                        cell: (row) => <Strong>{row.name}</Strong>,
                      },
                      {
                        key: 'code',
                        header: 'Code',
                        cell: (row) => (
                          <Muted className="font-mono text-xs">{row.code || '—'}</Muted>
                        ),
                      },
                      {
                        key: 'rate',
                        header: 'Rate',
                        cell: (row) => <Strong className="tabular-nums">{row.percentage}</Strong>,
                      },
                      {
                        key: 'inclusive',
                        header: 'Applied',
                        cell: (row) => (
                          <Muted>{row.inclusive ? 'Included in price' : 'Added on top'}</Muted>
                        ),
                      },
                      {
                        key: 'priority',
                        header: 'Priority',
                        cell: (row) => <Muted className="tabular-nums">{row.priority}</Muted>,
                      },
                      ...removeColumn<SubscriptionTax>(
                        (row) => row.name,
                        'Remove tax',
                        onRemoveTax
                          ? (tax) =>
                              askRemoval({
                                title: `Stop applying ${tax.name}?`,
                                description:
                                  'Invoices created from now on leave this tax out. Invoices already issued keep it.',
                                confirmLabel: 'Remove tax',
                                run: () => onRemoveTax(tax),
                              })
                          : null,
                      ),
                    ]}
                  />
                )}
              </PartSection>
            </div>

            <div className="flex flex-col gap-5 xl:sticky xl:top-6">
              <ActivitySection
                entries={activityEntries}
                {...(activityEmptyText ? { emptyText: activityEmptyText } : {})}
                awaiting={activityAwaiting}
              />
              <MetadataCard
                metadata={s.metadata}
                {...(onSaveMetadata ? { onSave: onSaveMetadata } : {})}
              />
              <RelatedCard items={related}>
                {integrationLinks && onLinkIntegration && onUnlinkIntegration ? (
                  <ContractIntegrations
                    layout="rows"
                    links={integrationLinks}
                    linkable={linkableProviders}
                    onLink={onLinkIntegration}
                    onUnlink={onUnlinkIntegration}
                  />
                ) : null}
              </RelatedCard>
            </div>
          </div>
        ) : null}

        {tab === 'charges' ? (
          <ChargeTable
            title="Charges"
            showTitle={false}
            showDates
            charges={chargeRows.charges}
            details={chargeRows.details}
            source={sourceOf}
            {...(s.billingPeriod ? { period: s.billingPeriod } : {})}
            facets={[
              {
                id: 'source',
                label: 'Source',
                value: (charge) =>
                  LINE_SOURCE_LABEL[chargeRows.lineOf.get(charge.id)?.source ?? 'plan'],
              },
              {
                id: 'type',
                label: 'Type',
                value: (charge) => (charge.type === PriceType.Usage ? 'Usage' : 'Fixed'),
              },
            ]}
            emptyDescription="This contract has no priced lines."
            {...(canAddCharge ? { onAdd: () => setDialog({ mode: 'add' }) } : {})}
            addLabel="Add charge"
            onEditSection={(charge, part) => editCharge(charge, part)}
            editableSections={editableChargeSections}
            {...(canEditCharges ? { onEdit: (charge: Charge) => editCharge(charge) } : {})}
            canEdit={(charge) => {
              const line = chargeRows.lineOf.get(charge.id)
              return line ? canEditLine(line) : false
            }}
            {...(canEditCharges && onEndCharge
              ? { onTerminate: (charge: Charge) => endCharge(charge) }
              : {})}
            removeLabel="End charge"
            {...(revertCharge ? { onRevert: revertCharge } : {})}
            extraActions={(charge) =>
              chargeRows.lineOf.get(charge.id)?.source === 'plan' && onOpenPlan
                ? [{ label: 'Go to plan', icon: <PackageIcon aria-hidden />, onSelect: onOpenPlan }]
                : []
            }
            isLoading={lines.isLoading ?? false}
            error={lines.isError ? 'Charges could not be loaded' : null}
            {...(lines.onRetry ? { onRetry: lines.onRetry } : {})}
          />
        ) : null}

        {tab === 'usage' ? (
          <>
            {usageData ? (
              <OverviewTiles
                tiles={[
                  {
                    label: 'Period',
                    value: `${day(usageData.periodStart)} – ${day(usageData.periodEnd)}`,
                  },
                  { label: 'Usage to date', value: formatMoney(usageData.total) },
                  {
                    label: 'Commitment',
                    value: usageData.commitment ? formatMoney(usageData.commitment) : 'None',
                  },
                  {
                    label: 'Overage',
                    value: usageData.overage ? formatMoney(usageData.overage) : 'None',
                  },
                ]}
              />
            ) : null}
            <PartSection
              title="Usage charges"
              part={usage}
              failure="Usage could not be loaded"
              emptyTitle="No metered charges"
              scene="revenue"
              emptyDescription="This contract has no usage-based charges this period."
              isEmpty={(data) => data.charges.length === 0}
            >
              {(data) => (
                <DetailTable<SubscriptionUsageCharge>
                  compact
                  label="Usage charges"
                  noun="charges"
                  rows={data.charges}
                  columns={[
                    {
                      key: 'name',
                      header: 'Charge',
                      cell: (charge) => (
                        <span className="text-foreground flex items-center gap-2 font-medium">
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
                        <Muted className="tabular-nums">
                          {charge.quantity.toLocaleString('en-US')}
                        </Muted>
                      ),
                    },
                    {
                      key: 'amount',
                      header: 'Amount',
                      cell: (charge) => (
                        <Strong className="tabular-nums">{formatMoney(charge.amount)}</Strong>
                      ),
                    },
                  ]}
                />
              )}
            </PartSection>
          </>
        ) : null}

        {tab === 'invoices' ? (
          <PartSection
            title="Invoices"
            part={invoices}
            failure="Invoices could not be loaded"
            emptyTitle="No invoices yet"
            scene="billing"
            emptyDescription="Invoices for this contract appear here once a billing period closes."
            isEmpty={(rows) => rows.length === 0}
          >
            {(rows) => (
              <DetailTable<Invoice>
                compact
                label="Contract invoices"
                noun="invoices"
                rows={rows}
                {...(onOpenInvoice ? { onRowClick: (row) => onOpenInvoice(row.id) } : {})}
                facets={[
                  {
                    id: 'status',
                    label: 'Status',
                    value: (row) => sentence(words(row.status)),
                  },
                  {
                    id: 'payment',
                    label: 'Payment',
                    value: (row) =>
                      row.paymentStatus ? sentence(words(row.paymentStatus)) : 'No payment',
                  },
                ]}
                columns={[
                  {
                    key: 'number',
                    header: 'Invoice number',
                    sortBy: (row) => row.number,
                    text: (row) => row.number,
                    cell: (row) => <Strong className="font-mono text-xs">{row.number}</Strong>,
                  },
                  {
                    key: 'issued',
                    header: 'Issue date',
                    sortBy: (row) => row.issuedAt?.getTime() ?? 0,
                    cell: (row) => <Muted>{day(row.issuedAt)}</Muted>,
                  },
                  {
                    key: 'due',
                    header: 'Due date',
                    sortBy: (row) => row.dueDate?.getTime() ?? 0,
                    cell: (row) => <Muted>{day(row.dueDate)}</Muted>,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (row) => <InvoiceStatusBadge status={row.status} />,
                  },
                  { key: 'payment', header: 'Payment', cell: (row) => <PaymentCell row={row} /> },
                  {
                    key: 'amount',
                    header: 'Amount',
                    sortBy: (row) => Number(row.total.amount),
                    cell: (row) => (
                      <Strong className="tabular-nums">{formatMoney(row.total)}</Strong>
                    ),
                  },
                ]}
              />
            )}
          </PartSection>
        ) : null}
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
      <ConfirmDialog
        open={removal !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setRemoval(null)
        }}
        title={removal?.title ?? ''}
        {...(removal ? { description: removal.description } : {})}
        confirmLabel={removal?.confirmLabel ?? 'Remove'}
        destructive
        isPending={removing}
        error={removalError}
        onConfirm={() => {
          if (!removal) return
          setRemoving(true)
          setRemovalError(null)
          removal
            .run()
            .then(() => setRemoval(null))
            .catch((caught: unknown) =>
              setRemovalError(
                caught instanceof Error && caught.message
                  ? caught.message
                  : 'That did not go through. Try again.',
              ),
            )
            .finally(() => setRemoving(false))
        }}
      />
      <ContractSectionDialogs
        kind={section}
        options={{
          features: sectionOptions?.features ?? [],
          addons: sectionOptions?.addons ?? [],
          coupons: sectionOptions?.coupons ?? [],
          taxRates: sectionOptions?.taxRates ?? [],
        }}
        actions={{
          onAddEntitlement,
          onAddCreditGrant,
          onAddAddon,
          onAddCoupon: onAddCoupon
            ? (draft) => {
                if (!couponLineId) return onAddCoupon(draft)
                const current = (coupons?.data ?? []).filter(
                  (coupon) => coupon.active && coupon.lineItemId === couponLineId,
                )
                if (current.length === 1 && current[0]?.code === draft.couponCode) return
                return onAddCoupon({
                  couponCode: draft.couponCode,
                  lineItemId: couponLineId,
                  ...(current.length
                    ? { replaceAssociationIds: current.map((coupon) => coupon.id) }
                    : {}),
                })
              }
            : undefined,
          onAddTax,
        }}
        {...(couponLineId
          ? {
              couponCopy: {
                title: 'Change coupon',
                hint: 'Replaces the coupons on this charge.',
                submitLabel: 'Change coupon',
              },
            }
          : {})}
        pending={saving}
        error={saveError}
        onRun={(action) => void runSection(action)}
        onClose={closeSection}
      />
      <FormDialog
        open={alertEdit !== null}
        onOpenChange={(next) => {
          if (next) return
          setAlertEdit(null)
          setSaveError(null)
        }}
        title="Alert settings"
        isPending={saving}
      >
        {alertEdit ? (
          <ChargeAlertForm
            key={alertEdit.settingId}
            initial={alertEdit.config}
            pending={saving}
            error={saveError}
            onCancel={() => {
              setAlertEdit(null)
              setSaveError(null)
            }}
            onSubmit={(config) => {
              if (!onSaveChargeAlert) return
              setSaving(true)
              setSaveError(null)
              Promise.resolve(onSaveChargeAlert({ settingId: alertEdit.settingId, config }))
                .then(() => setAlertEdit(null))
                .catch((error: unknown) =>
                  setSaveError(
                    error instanceof Error ? error.message : 'The change could not be saved.',
                  ),
                )
                .finally(() => setSaving(false))
            }}
          />
        ) : null}
      </FormDialog>
      {/*
        The Commitments section's own sheet. The charges table owns one for
        its own rows; this opens the same surface from the other direction,
        already at the commitment that was clicked.
      */}
      <ChargeSheet
        charge={commitmentCharge}
        {...(commitmentCharge ? { detail: chargeRows.details.get(commitmentCharge.id) } : {})}
        section={ChargeSection.Commitment}
        onClose={() => setCommitmentCharge(null)}
      />
    </DetailShell>
  )
}

/** The value a row is about: name, amount. Everything else in the row is `Muted`. */
function Strong({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-foreground font-medium', className)}>{children}</span>
}

function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-muted-foreground font-normal', className)}>{children}</span>
}

function ActiveBadge({ active }: { active: boolean }) {
  return <Pill tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Ended'}</Pill>
}

const sentence = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '—')

const isZero = (money: Money) => Number(money.amount) === 0

const deduction = (money: Money) =>
  Number(money.amount) > 0 ? `−${formatMoney(money)}` : formatMoney(money)

/**
 * The contract's own facts. A strip of four leads, each one a thing a reader
 * checks first; the rest sit in a grid below in the quieter label/value style.
 */
function ContractDetails({
  subscription: s,
  usage,
  endLabel,
  endsOn,
  onOpenCustomer,
  onOpenPlan,
}: {
  subscription: SubscriptionDetail
  usage: SubscriptionUsage | undefined
  endLabel: string
  endsOn: Date | null
  onOpenCustomer?: () => void
  onOpenPlan?: () => void
}) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
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
            { label: 'Start date', value: day(s.startDate) },
            {
              label: 'Current period',
              value: `${day(s.currentPeriodStart)} – ${day(s.currentPeriodEnd)}`,
            },
            // "Renews" repeats the end of the current period; "Ends" / "Ended" is
            // the only place a cancellation date shows, so that one stays.
            ...(endLabel === 'Renews' ? [] : [{ label: endLabel, value: day(endsOn) }]),
            ...(s.trialStart || s.trialEnd
              ? [{ label: 'Trial', value: `${day(s.trialStart)} – ${day(s.trialEnd)}` }]
              : []),
            ...(s.endDate ? [{ label: 'Contract end', value: day(s.endDate) }] : []),
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
              label: 'Payment terms',
              value: sentence(s.paymentTerms ? words(s.paymentTerms) : ''),
            },
            { label: 'Currency', value: s.currency || '—' },
            {
              label: 'Billing cycle',
              value:
                s.billingPeriodCount > 1
                  ? `Every ${s.billingPeriodCount} × ${s.billingPeriodLabel.toLowerCase()}`
                  : s.billingPeriodLabel,
            },
            {
              label: 'Commitment',
              value: s.commitmentAmount
                ? `${formatMoney(s.commitmentAmount)}${usage?.commitmentUtilized ? ` · ${formatMoney(usage.commitmentUtilized)} used` : ''}`
                : 'None',
            },
          ]}
        />
      </Section>
    </div>
  )
}

/**
 * What the next invoice will say if the period closed now: the lines, then the
 * subtotal, any discount, tax and prepaid credit, and the amount due. Cancelled
 * and not-yet-started contracts have no next invoice, and a trial's first one
 * only appears when the trial ends, so each says so or stays out of the way.
 */
function InvoicePreviewSection({
  status,
  preview,
}: {
  status: SubscriptionStatus
  preview: SubscriptionPart<InvoicePreview>
}) {
  const [expanded, setExpanded] = useState(false)
  if (status === SubscriptionStatus.Cancelled || status === SubscriptionStatus.Incomplete) {
    return null
  }
  if (status === SubscriptionStatus.Trialing) {
    return (
      <Section table showTitle title="Upcoming invoice">
        <SectionEmpty
          scene="billing"
          title="Billing starts after the trial"
          description="The first invoice is created when the trial ends."
        />
      </Section>
    )
  }

  const data = preview.data
  const period =
    data && (data.periodStart || data.periodEnd) ? (
      <span className="text-muted-foreground text-xs font-normal">
        {day(data.periodStart)} – {day(data.periodEnd)}
      </span>
    ) : undefined

  return (
    <PartSection
      title="Upcoming invoice"
      showTitle
      part={preview}
      failure="The invoice preview could not be loaded"
      emptyTitle="Nothing to bill yet"
      scene="billing"
      emptyDescription="This contract has no charges for the current period."
      isEmpty={(value) => value.lines.length === 0}
      titleAction={period}
    >
      {(value) => (
        <>
          <DetailTable<InvoicePreviewLine>
            compact
            label="Upcoming invoice lines"
            noun="lines"
            rows={expanded ? value.lines : value.lines.slice(0, PREVIEW_LINES_SHOWN)}
            toolbar={false}
            footer={false}
            pageSize={Math.max(value.lines.length, 1)}
            columns={[
              {
                key: 'name',
                header: 'Description',
                text: (line) => `${line.name} ${line.detail}`,
                cell: (line) => (
                  <span className="flex min-w-0 flex-col">
                    <Strong>{line.name}</Strong>
                    {line.detail ? <Muted className="text-xs">{line.detail}</Muted> : null}
                  </span>
                ),
              },
              {
                key: 'quantity',
                header: 'Quantity',
                align: 'end',
                cell: (line) => <Muted className="tabular-nums">{line.quantity || '—'}</Muted>,
              },
              {
                key: 'amount',
                header: 'Amount',
                align: 'end',
                cell: (line) => (
                  <Strong className="tabular-nums">{formatMoney(line.amount)}</Strong>
                ),
              },
            ]}
          />
          {value.lines.length > PREVIEW_LINES_SHOWN ? (
            <div className="flex justify-center border-t py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3"
                aria-expanded={expanded}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded
                  ? 'Show fewer lines'
                  : `Show ${value.lines.length - PREVIEW_LINES_SHOWN} more`}
              </Button>
            </div>
          ) : null}
          <div className="flex justify-end border-t px-6 py-4">
            <dl className="flex w-full flex-col gap-2 text-sm sm:w-72">
              <TotalRow label="Subtotal" value={formatMoney(value.subtotal)} />
              {!isZero(value.discount) ? (
                <TotalRow label="Discount" value={deduction(value.discount)} />
              ) : null}
              {!isZero(value.tax) ? <TotalRow label="Tax" value={formatMoney(value.tax)} /> : null}
              {!isZero(value.prepaidCredits) ? (
                <TotalRow label="Prepaid credits" value={deduction(value.prepaidCredits)} />
              ) : null}
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
                <dt className="text-foreground font-medium">Amount due</dt>
                <dd className="text-foreground text-base font-medium tabular-nums">
                  {formatMoney(value.amountDue)}
                </dd>
              </div>
            </dl>
          </div>
          <p className="text-muted-foreground border-t px-6 py-3 text-xs">
            {value.periodEnd
              ? `This is a preview of the invoice that will be billed on ${day(value.periodEnd)}.`
              : 'This is a preview of the next invoice.'}{' '}
            It may change if the contract is updated.
          </p>
        </>
      )}
    </PartSection>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground font-normal">{label}</dt>
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * The lifecycle banners at the top of Overview. At most one of the state banners
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

function PaymentCell({ row }: { row: Invoice }) {
  return row.paymentStatus ? (
    <PaymentStatusBadge status={row.paymentStatus} />
  ) : (
    <span className="text-muted-foreground">—</span>
  )
}

/**
 * A table section whose body is one part of the page: loading, failed, empty, or
 * the data. The table sits in a bordered box; `showTitle` puts a small visible
 * title above it (Overview), otherwise the name is for assistive tech only.
 */
/**
 * A contract section, scoped to the entity its rows and Add button write
 * (an entitlement, a credit grant…) — the contract's own scope otherwise.
 */
function PartSection<T>({
  entity,
  ...props
}: Parameters<typeof PartSectionInner<T>>[0] & { entity?: RbacEntity }) {
  const inner = <PartSectionInner<T> {...props} />
  return entity ? <AccessScope entity={entity}>{inner}</AccessScope> : inner
}

function PartSectionInner<T>({
  title,
  part,
  failure,
  emptyTitle,
  emptyDescription,
  emptyAction,
  scene,
  create,
  isEmpty,
  showTitle = true,
  action,
  titleAction,
  children,
}: {
  title: string
  part: SubscriptionPart<T>
  failure: string
  emptyTitle: string
  emptyDescription: string
  emptyAction?: ReactNode
  /** The drawing above the empty state. */
  scene?: EmptyScene
  /** The section's Add button, above the frame in every state. */
  create?: { label: string; onClick: () => void } | undefined
  isEmpty: (data: T) => boolean
  showTitle?: boolean
  action?: ReactNode
  titleAction?: ReactNode
  children: (data: T) => ReactNode
}) {
  const { data } = part
  const createButton = create ? (
    <WriteGate>
      <Button size="sm" variant="outline" className="h-8 px-3" onClick={create.onClick}>
        <PlusIcon aria-hidden="true" />
        {create.label}
      </Button>
    </WriteGate>
  ) : undefined
  const frame = {
    table: true,
    title,
    showTitle,
    titleAction,
    action:
      action || createButton ? (
        <>
          {action}
          {createButton}
        </>
      ) : undefined,
  } as const
  if (part.isLoading || (!data && !part.isError)) {
    return (
      <Section {...frame}>
        <div className="p-4">
          <LoadingRows />
        </div>
      </Section>
    )
  }
  if (part.isError || !data) {
    return (
      <Section {...frame}>
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
      <Section {...frame}>
        <SectionEmpty
          {...(scene ? { scene } : {})}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </Section>
    )
  }
  return <Section {...frame}>{children(data)}</Section>
}

/** The stored thresholds of one charge, ready for the alert settings form. */
function chargeAlertDraft(
  alerts: readonly ChargeAlert[],
): { settingId: string; config: AlertSettingConfig } | null {
  const settingId = alerts.find((alert) => alert.settingId)?.settingId
  if (!settingId) return null
  const config: AlertSettingConfig = {
    alertEnabled: true,
    thresholdType:
      alerts.find((alert) => alert.thresholdType)?.thresholdType === AlertThresholdType.Absolute
        ? AlertThresholdType.Absolute
        : AlertThresholdType.Percentage,
  }
  for (const alert of alerts) {
    if (alert.settingId !== settingId || !alert.threshold) continue
    const severity = alert.level.toLowerCase()
    if (
      severity !== AlertSeverity.Info &&
      severity !== AlertSeverity.Warning &&
      severity !== AlertSeverity.Critical
    ) {
      continue
    }
    config[severity] = {
      condition: alert.condition === 'below' ? AlertCondition.Below : AlertCondition.Above,
      threshold: alert.threshold,
    }
  }
  return { settingId, config }
}
