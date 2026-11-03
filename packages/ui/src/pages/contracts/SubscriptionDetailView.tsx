import {
  RBAC_ENTITY,
  type PauseSubscription,
  type RbacEntity,
  type ResumeSubscription,
  canPauseSubscription,
  canResumeSubscription,
  everyPeriod,
  periodNoun,
} from '@fp/domain'
import { toast } from 'sonner'
import { AccessScope, WriteGate } from '@ui/compositions/access/Access'
import { Fragment, useState, type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import {
  CircleAlertIcon,
  CircleDollarSignIcon,
  ScaleIcon,
  BellIcon,
  CopyIcon,
  PencilIcon,
  TicketPercentIcon,
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
  commitmentPeriodNoun,
  ChargeSection,
  type ChangeLineQuantity,
  type Charge,
  type ChargeCommitmentDetail,
  type ChargeDetail,
  type ChargeHistory,
  type ChargeVersion,
  type ChargeAlert,
  type CreditGrant,
  type EditContractCharge,
  type IntegrationLink,
  type EndContractCharge,
  type Invoice,
  type InvoicePreview,
  BillingModel,
  money,
  type InvoicePreviewLine,
  type LineChangePreview,
  type Money,
  type SubscriptionAddon,
  type SubscriptionCoupon,
  type SubscriptionDetail,
  type SubscriptionEntitlement,
  type Subscription,
  type SubscriptionLine,
  isInheritedContract,
  lineLineages,
  type SubscriptionSchedule,
  type SubscriptionTax,
  type SubscriptionUsage,
  type SubscriptionUsageCharge,
  type TenantFeatureUsage,
  emptyAlertSettingConfig,
  chargeHasEnded,
  liveChargeCount,
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
  TotalRow,
  TotalsList,
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
import { SubTabState } from '@ui/compositions/detail/SubTabState'
import { DetailTable, type DetailColumn } from '../shared/DetailTable'
import { EntityLink, Pill } from '../shared/cells'
import { EntitlementUsageTable, entitlementRowsForContract } from '../shared/EntitlementUsage'
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
import { PauseContractDialog } from './PauseContractDialog'
import { ContractChargeDialog, type ContractChargeDialogState } from './ContractChargeDialog'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'
import { statusTone } from '../shared/statusTones'

/**
 * A unit price, with the precision a usage rate needs ($0.002 a request):
 * the currency's own decimals at least, up to six. Display only.
 */
function unitMoney(value: Money): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: value.currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 6,
      // The exact decimal string, as formatMoney passes it: a double would
      // round a large rate (see money.ts).
    }).format(value.amount as unknown as number)
  } catch {
    return formatMoney(value)
  }
}

export const SubscriptionDetailViewProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/DetailShell',
    'compositions/MetadataCard',
    'compositions/RelatedCard',
    '@reui/alert',
    '@reui/badge',
    'compositions/ActivityLog',
    'compositions/detail-kit',
  ],
  note: 'Contract detail (read-only): DetailShell header with every action in More, five tabs (Overview, Charges, Usage, Invoices, Information) directly under it, and an Activity and Related rail on Overview only. Lifecycle banners lead the Overview tab, then the upcoming invoice preview (left out when there is nothing to bill), then charges, commitments, entitlements, credit grants, add-ons, coupons and taxes, those with rows before the empty ones. Information holds the side-by-side Contract and Billing & collection panels and the metadata card.',
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
  /**
   * The open tab, when the page keeps it (in the URL), so going back to the
   * contract opens the tab it was left on. Without it the view keeps its own.
   */
  tab?: SubscriptionTab | undefined
  onTabChange?: ((tab: SubscriptionTab) => void) | undefined
  subscription: SubscriptionDetail
  lines: SubscriptionPart<SubscriptionLine[]>
  /**
   * Every line the contract has had, ended ones included. When present, each
   * charge is shown once: its current version: and its earlier prices are
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
  /**
   * Which charge's sheet is open, by its line item (`null` once closed), so the
   * page can read `GET /subscriptions/lineitems/{id}/history` for it.
   */
  onOpenLine?: ((line: SubscriptionLine | null) => void) | undefined
  /** That read: every version of the open charge's line item. */
  openLineHistory?:
    | {
        lines?: readonly SubscriptionLine[] | undefined
        isLoading?: boolean | undefined
        error?: string | null | undefined
        onRetry?: (() => void) | undefined
      }
    | undefined
  entitlements: SubscriptionPart<SubscriptionEntitlement[]>
  /**
   * The customer's usage against this contract's entitlements
   * (`GET /customers/usage?subscription_ids=`). Omitted or still loading, the
   * Usage column shows a dash for each row; the limits still show.
   */
  entitlementUsage?: TenantFeatureUsage[] | undefined
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
  /**
   * Adds alerts to a usage charge that has none: `lineId` is the subscription
   * line item the setting watches.
   */
  onCreateChargeAlert?:
    ((draft: { lineId: string; config: AlertSettingConfig }) => Promise<unknown> | void) | undefined
  /**
   * The Usage tab's breakdown: the customer's usage analytics scoped to this
   * contract's metered charges. Omitted, the tab lists the contract's own
   * usage charges for the period.
   */
  usageBreakdown?: ReactNode
  /** The Revenue tab's content; omitted, the tab is hidden. */
  revenue?: ReactNode
  /** The Journal entries tab's content; omitted, the tab is hidden. */
  journal?: ReactNode
  /** The FX overrides section on the Information tab; omitted, it is not shown. */
  fxOverrides?: ReactNode
  /**
   * The thresholds a line already stores (a switched-off setting), read when
   * Add alerts is chosen so the form opens on them instead of overwriting
   * them unseen. Null when there are none.
   */
  loadChargeAlert?: ((lineId: string) => Promise<AlertSettingConfig | null>) | undefined
  onAddTax?: ((draft: CreateTaxAssociation) => Promise<unknown> | void) | undefined
  /** A charge's row menu: take its coupon off. Resolves when done. */
  onRemoveCoupon?: ((coupon: SubscriptionCoupon) => Promise<unknown>) | undefined
  /** Row menus: take an add-on off, stop a tax, end a credit grant. Each resolves when done. */
  onRemoveAddon?: ((addon: SubscriptionAddon) => Promise<unknown>) | undefined
  onRemoveTax?: ((tax: SubscriptionTax) => Promise<unknown>) | undefined
  onCancelCreditGrant?: ((grant: CreditGrant) => Promise<unknown>) | undefined
  /** What the Add dialogs offer. */
  sectionOptions?: Partial<ContractSectionOptions> | undefined
  onBack?: () => void
  onOpenCustomer?: () => void
  onOpenPlan?: () => void
  /** Opens another contract: an inherited one's parent, or a parent's inherited ones. */
  onOpenContract?: ((id: string) => void) | undefined
  /** A parent's inherited contracts (its children's mirrors), as V1 lists them. */
  inheritedContracts?: SubscriptionPart<Subscription[]> | undefined
  onOpenInvoice?: (invoiceId: string) => void
  /** Incomplete contracts only: the More item and the banner button. */
  onActivate?: () => void
  onCancel?: () => void
  /** Running contracts: stop billing until resumed. Omitted, the item is hidden. */
  onPause?: ((draft: PauseSubscription) => Promise<unknown>) | undefined
  /** Paused contracts: start billing again. */
  onResume?: ((draft: ResumeSubscription) => Promise<unknown>) | undefined
  /** Opens the alert setting that watches this contract. */
  onAlertSettings?: (() => void) | undefined
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

export const SUBSCRIPTION_TABS = [
  'overview',
  'information',
  'charges',
  'usage',
  'invoices',
  'revenue',
  'journal',
] as const
export type SubscriptionTab = (typeof SUBSCRIPTION_TABS)[number]

/** A `?tab=` value as a contract tab; anything else is the Overview. */
export function parseSubscriptionTab(value: unknown): SubscriptionTab {
  return SUBSCRIPTION_TABS.includes(value as SubscriptionTab)
    ? (value as SubscriptionTab)
    : 'overview'
}

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
 * conversion: it is the pairing of that price with what the contract knows
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
  /** "per month", "every minute": what the figure is measured against. */
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
  onOpenLine,
  openLineHistory,
  entitlements,
  entitlementUsage,
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
  onCreateChargeAlert,
  loadChargeAlert,
  usageBreakdown,
  revenue,
  journal,
  fxOverrides,
  onAddTax,
  onRemoveAddon,
  onRemoveTax,
  onCancelCreditGrant,
  sectionOptions,
  onBack,
  onOpenCustomer,
  onOpenPlan,
  onOpenContract,
  inheritedContracts,
  onOpenInvoice,
  onActivate,
  onSaveMetadata,
  onCancel,
  onPause,
  onResume,
  onAlertSettings,
  onRemoveCoupon,
  onAddCharge,
  onEditCharge,
  onEndCharge,
  onPreviewQuantity,
  onChangeQuantity,
  meters = [],
  priceUnits = [],
  tab: controlledTab,
  onTabChange,
}: SubscriptionDetailViewProps) {
  const [localTab, setLocalTab] = useState<SubscriptionTab>('overview')
  const requested = controlledTab ?? localTab
  // A Revenue or Journal link opens on Overview where revenue recognition is off.
  const tab =
    (requested === 'revenue' && !revenue) || (requested === 'journal' && !journal)
      ? 'overview'
      : requested
  const setTab = (next: SubscriptionTab) => (onTabChange ? onTabChange(next) : setLocalTab(next))
  const [pauseMode, setPauseMode] = useState<'pause' | 'resume' | null>(null)
  const [dialog, setDialog] = useState<ContractChargeDialogState | null>(null)
  const [saving, setSaving] = useState(false)
  const [quantityLine, setQuantityLine] = useState<SubscriptionLine | null>(null)
  /** The charge whose sheet the Commitments section opened, at its commitment. */
  const [commitmentCharge, setCommitmentCharge] = useState<Charge | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [section, setSection] = useState<ContractSectionKind | null>(null)
  /** Set while Change coupon is open, so the submit is scoped to that charge. */
  const [couponLineId, setCouponLineId] = useState<string | null>(null)
  /** The alert being edited; no `settingId` while a new one is being added. */
  const [alertEdit, setAlertEdit] = useState<{
    settingId?: string
    lineId: string
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
  const canPause = Boolean(onPause) && canPauseSubscription(s.status) && !isCancelling
  const canResume = Boolean(onResume) && canResumeSubscription(s.status)
  const title = `${s.customerName} on ${s.planName}`

  // An inherited contract mirrors its parent's: nothing on it is changed here.
  const inherited = isInheritedContract(s)
  const canEditCharges = !isCancelled && !isCancelling && !inherited
  // The API adds a charge only to an active contract (not a draft, trial,
  // pause or one not yet started), so it is offered only there.
  const canAddCharge =
    Boolean(onAddCharge) && canEditCharges && s.status === SubscriptionStatus.Active

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
  const canModify = !isCancelled && !inherited
  const createFor = (
    kind: ContractSectionKind,
    label: string,
    handler: unknown,
  ): { label: string; onClick: () => void } | undefined =>
    canModify && handler ? { label, onClick: open(kind) } : undefined

  const usageData = usage.data
  // A history item often names its price by id only. The amount lives on the
  // line the contract already loaded for that same price.
  const knownPrices = chargesByPriceId([...(lineHistory ?? []), ...(lines.data ?? [])])
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
      versions: lineVersions(lineage.versions, knownPrices),
    })
  }
  // The open charge's versions as the history API returned them.
  const chargeHistory: ChargeHistory | undefined = openLineHistory
    ? {
        ...(openLineHistory.lines
          ? { versions: lineVersions(openLineHistory.lines, knownPrices) }
          : {}),
        isLoading: openLineHistory.isLoading,
        error: openLineHistory.error,
        onRetry: openLineHistory.onRetry,
      }
    : undefined
  const openCharge = onOpenLine
    ? (charge: Charge | null) =>
        onOpenLine(charge ? (chargeRows.lineOf.get(charge.id) ?? null) : null)
    : undefined
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
          const previous =
            lineage?.versions.find((version) => version.id === versionId) ??
            openLineHistory?.lines?.find((version) => version.id === versionId)
          return lineage && previous
            ? onRevertLine(lineage.current, previous)
            : Promise.reject(new Error('That version is no longer on this contract.'))
        }
      : undefined
  const editableChargeSections = (charge: Charge): ChargeSection[] => {
    const line = chargeRows.lineOf.get(charge.id)
    if (!canEditCharges || chargeHasEnded(charge) || !line || !canEditLine(line)) return []
    const sections: ChargeSection[] =
      line.kind === 'fixed'
        ? [ChargeSection.Price]
        : [ChargeSection.Price, ChargeSection.Commitment]
    if (onAddCoupon) sections.push(ChargeSection.Discount)
    const alerts = chargeRows.details.get(charge.id)?.alerts
    const hasSetting = alerts?.some((alert) => alert.settingId) ?? false
    // Alerts can be added to a usage charge only once the alerts have loaded,
    // so a slow read never offers a second setting beside an existing one.
    const canAdd =
      onCreateChargeAlert &&
      line.kind === 'usage' &&
      chargeAlerts?.data !== undefined &&
      !(alerts && alerts.length > 0)
    if ((onSaveChargeAlert && hasSetting) || canAdd) sections.push(ChargeSection.Alerts)
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
    if (part === ChargeSection.Alerts) {
      const draft = chargeAlertDraft(chargeRows.details.get(charge.id)?.alerts ?? [])
      if (draft && onSaveChargeAlert) {
        setSaveError(null)
        setAlertEdit({ ...draft, lineId: line.id })
        return
      }
      if (!draft && onCreateChargeAlert) {
        setSaveError(null)
        const lineId = line.id
        // A failed read opens the empty form: adding alerts still works, and
        // the save updates whatever the line holds.
        void Promise.resolve(loadChargeAlert?.(lineId) ?? null)
          .catch(() => null)
          .then((stored) =>
            setAlertEdit({
              lineId,
              // Adding alerts means turning them on: a switched-off setting
              // opens on its thresholds with the switch on, so saving as
              // shown enables them.
              config: stored ? { ...stored, alertEnabled: true } : emptyAlertSettingConfig(),
            }),
          )
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
    return [
      {
        id: charge.id,
        charge,
        name: charge.displayName || charge.meterName || 'Charge',
        commitment,
        // "every month" / "per month": a period after a preposition is a noun, never "monthly".
        per: commitment.windowed
          ? everyPeriod(charge.billingPeriod)
          : `per ${charge.billingPeriod ? periodNoun(charge.billingPeriod) : 'period'}`,
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
    ...(event.fields ? { fields: event.fields } : {}),
    ...(event.detail ? { detail: event.detail } : {}),
    ...(event.record ? { record: event.record } : {}),
    ...(event.by ? { by: event.by } : {}),
    ...(event.href ? { href: event.href } : {}),
  }))

  const chargeExtras = (charge: Charge) => {
    const line = chargeRows.lineOf.get(charge.id)
    if (!line) return []
    const lineCoupon = (coupons?.data ?? []).find(
      (coupon) => coupon.active && coupon.lineItemId === line.id,
    )
    const open = !chargeHasEnded(charge) && canEditCharges && canEditLine(line)
    const hasCommitment = Boolean(chargeRows.details.get(charge.id)?.commitment)
    // The same gate as the section menu: an existing setting to edit, or none
    // once the alerts have loaded, so a slow read never offers a second one.
    const offersAlerts = editableChargeSections(charge).includes(ChargeSection.Alerts)
    return [
      ...(open && line.kind === 'usage'
        ? [
            {
              label: 'Override price',
              icon: <CircleDollarSignIcon aria-hidden />,
              onSelect: () => editCharge(charge),
            },
            {
              label: hasCommitment ? 'Edit commitment' : 'Add commitment',
              icon: <ScaleIcon aria-hidden />,
              onSelect: () => editCharge(charge),
            },
            ...(offersAlerts
              ? [
                  {
                    label: 'Alert settings',
                    icon: <BellIcon aria-hidden />,
                    onSelect: () => editCharge(charge, ChargeSection.Alerts),
                  },
                ]
              : []),
          ]
        : []),
      {
        label: 'Copy line item ID',
        icon: <CopyIcon aria-hidden />,
        readOnly: true,
        onSelect: () => {
          void navigator.clipboard
            .writeText(line.id)
            .then(() => toast.success('Line item ID copied'))
            .catch(() => toast.error('Couldn’t copy the line item ID'))
        },
      },
      ...(open && onAddCoupon && !lineCoupon
        ? [
            {
              label: 'Apply coupon',
              icon: <TicketPercentIcon aria-hidden />,
              onSelect: () => editCharge(charge, ChargeSection.Discount),
            },
          ]
        : []),
      ...(open && onRemoveCoupon && lineCoupon
        ? [
            {
              label: 'Remove coupon',
              icon: <TicketPercentIcon aria-hidden />,
              onSelect: () =>
                setRemoval({
                  title: `Remove ${lineCoupon.name}?`,
                  description: `The discount stops applying to ${line.name || 'this charge'}.`,
                  confirmLabel: 'Remove coupon',
                  run: () => onRemoveCoupon(lineCoupon),
                }),
            },
          ]
        : []),
      ...(line.source === 'plan' && onOpenPlan
        ? [
            {
              label: 'Go to plan',
              icon: <PackageIcon aria-hidden />,
              readOnly: true,
              onSelect: onOpenPlan,
            },
          ]
        : []),
    ]
  }

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
            {
              id: 'copy-id',
              label: 'Copy ID',
              icon: <CopyIcon aria-hidden="true" className="size-4" />,
              readOnly: true,
              onSelect: () => {
                void navigator.clipboard
                  .writeText(s.id)
                  .then(() => toast.success('Contract ID copied'))
                  .catch(() => toast.error('Couldn’t copy the contract ID'))
              },
            },
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
            // V1's "Edit Subscription" opened a page of charges; here the charges
            // are edited in place, on their tab.
            ...(canEditCharges
              ? [
                  {
                    id: 'edit',
                    label: 'Edit contract',
                    icon: <PencilIcon aria-hidden="true" className="size-4" />,
                    onSelect: () => setTab('charges'),
                  },
                ]
              : []),
            ...(onAlertSettings
              ? [
                  {
                    id: 'alerts',
                    label: 'Alert settings',
                    icon: <BellIcon aria-hidden="true" className="size-4" />,
                    onSelect: onAlertSettings,
                  },
                ]
              : []),
            ...(canPause
              ? [
                  {
                    id: 'pause',
                    label: 'Pause contract',
                    icon: <CirclePauseIcon aria-hidden="true" className="size-4" />,
                    onSelect: () => setPauseMode('pause'),
                  },
                ]
              : []),
            ...(canResume
              ? [
                  {
                    id: 'resume',
                    label: 'Resume contract',
                    icon: <PlayIcon aria-hidden="true" className="size-4" />,
                    onSelect: () => setPauseMode('resume'),
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
              ...(lines.data ? { count: liveChargeCount(chargeRows.charges) } : {}),
            },
            // { value: 'usage', label: 'Usage' },
            {
              value: 'invoices',
              label: 'Invoices',
              ...(invoices.data ? { count: invoices.data.length } : {}),
            },
            ...(revenue ? [{ value: 'revenue', label: 'Revenue' }] : []),
            ...(journal ? [{ value: 'journal', label: 'Journal entries' }] : []),
            { value: 'information', label: 'Information' },
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
              {inherited ? (
                <Alert variant="info">
                  <InfoIcon aria-hidden="true" />
                  <AlertTitle>Inherited from a parent contract</AlertTitle>
                  <AlertDescription>
                    Its charges and billing follow the parent contract, so it can't be changed here.
                  </AlertDescription>
                  {s.parentSubscriptionId && onOpenContract ? (
                    <AlertAction>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => onOpenContract(s.parentSubscriptionId!)}
                      >
                        Open parent contract
                      </Button>
                    </AlertAction>
                  ) : null}
                </Alert>
              ) : null}
              {inheritedContracts && (inheritedContracts.data?.length ?? 0) > 0 ? (
                <Section table showTitle title="Inherited contracts">
                  <DetailTable<Subscription>
                    compact
                    label="Inherited contracts"
                    noun="contracts"
                    rows={inheritedContracts.data ?? []}
                    getRowId={(row) => row.id}
                    toolbar={false}
                    {...(onOpenContract
                      ? { onRowClick: (row: Subscription) => onOpenContract(row.id) }
                      : {})}
                    columns={[
                      {
                        key: 'customer',
                        header: 'Customer',
                        cell: (row) => <Strong>{row.customerName}</Strong>,
                      },
                      { key: 'plan', header: 'Plan', cell: (row) => <Muted>{row.planName}</Muted> },
                      {
                        key: 'status',
                        header: 'Status',
                        cell: (row) => <SubscriptionStatusBadge status={row.status} />,
                      },
                    ]}
                  />
                </Section>
              ) : null}

              {preview ? (
                <InvoicePreviewSection
                  status={s.status}
                  preview={preview}
                  contractLines={lines.data ?? []}
                />
              ) : null}

              {/*
                Sections that have rows come first; a section that is empty
                and only an entry point for adding something (no add-ons,
                no coupons…) sits lower. A section still loading or failed
                keeps its place: it is not known to be empty. Within each
                group the order is the redesign's.
              */}
              {rowsFirst([
                {
                  id: 'charges',
                  empty: knownEmpty(lines),
                  node: (
                    <>
                      {/*
                The Overview's charges: only the ones this contract changed,
                and a way to the rest. The same table the Charges tab uses, in
                its summary shape, so a charge reads identically in both.
              */}
                      <ChargeTable
                        title="Charges"
                        onEditSection={(charge, part) => editCharge(charge, part)}
                        editableSections={editableChargeSections}
                        {...(canEditCharges
                          ? { onEdit: (charge: Charge) => editCharge(charge) }
                          : {})}
                        canEdit={(charge) => {
                          const line = chargeRows.lineOf.get(charge.id)
                          return line ? canEditLine(line) : false
                        }}
                        {...(canEditCharges && onEndCharge
                          ? { onTerminate: (charge: Charge) => endCharge(charge) }
                          : {})}
                        removeLabel="End charge"
                        extraActions={chargeExtras}
                        variant="summary"
                        {...(revertCharge ? { onRevert: revertCharge } : {})}
                        {...(openCharge ? { onOpenCharge: openCharge } : {})}
                        {...(chargeHistory ? { history: chargeHistory } : {})}
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
                    </>
                  ),
                },
                {
                  id: 'commitments',
                  empty: false,
                  node: (
                    <>
                      {/*
                Commitments, between Charges and Entitlements as the redesign
                orders them. Only the charges that carry one: a contract with
                no commitments is not told it has none in a box of its own,
                it simply has one fewer section.

                A commitment is set on a charge, so a row opens that charge's
                sheet at its commitment rather than offering an editor here:
                one place to change it, reached from either direction.
              */}
                      {commitmentRows.length > 0 ? (
                        <Section table showTitle title="Commitments">
                          <DetailTable<CommitmentRow>
                            compact
                            footer={false}
                            label="Commitments"
                            noun="commitments"
                            rows={commitmentRows}
                            onRowClick={(row) => setCommitmentCharge(row.charge)}
                            columns={[
                              {
                                key: 'charge',
                                header: 'Charge',
                                sortBy: (row) => row.name,
                                text: (row) => row.name,
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
                                  <Muted className="tabular-nums">
                                    ×{row.commitment.overageFactor}
                                  </Muted>
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
                    </>
                  ),
                },
                {
                  id: 'entitlements',
                  empty: knownEmpty(entitlements),
                  node: (
                    <>
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
                          <EntitlementUsageTable
                            rows={entitlementRowsForContract(rows, entitlementUsage)}
                          />
                        )}
                      </PartSection>
                    </>
                  ),
                },
                {
                  id: 'creditGrants',
                  empty: knownEmpty(creditGrants),
                  node: (
                    <>
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
                                sortBy: (row) => row.credits,
                                cell: (row) => (
                                  <Strong className="tabular-nums">{row.credits}</Strong>
                                ),
                              },
                              {
                                key: 'cadence',
                                header: 'Cadence',
                                sortBy: (row) => row.cadence,
                                text: (row) => CREDIT_GRANT_CADENCE_LABEL[row.cadence],
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
                                  <Muted>
                                    {CREDIT_GRANT_EXPIRY_TYPE_LABEL[row.expirationType]}
                                  </Muted>
                                ),
                              },
                              // When the grant stops issuing credits: kept by the API for a
                              // contract's grant, so it no longer reads as still running.
                              {
                                key: 'ends',
                                header: 'Ends',
                                cell: (row) => (
                                  <Muted>{row.endDate ? day(row.endDate) : 'No end'}</Muted>
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
                    </>
                  ),
                },
                {
                  id: 'addons',
                  empty: knownEmpty(addons ?? NO_PART),
                  node: (
                    <>
                      <PartSection
                        entity={RBAC_ENTITY.Addon}
                        title="Add-ons"
                        showTitle
                        part={addons ?? NO_PART}
                        // Add-ons attach only to an active or draft (incomplete) contract.
                        create={
                          s.status === SubscriptionStatus.Active ||
                          s.status === SubscriptionStatus.Incomplete
                            ? createFor('addon', 'Add add-on', onAddAddon)
                            : undefined
                        }
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
                                sortBy: (row) => (row.active ? 'Active' : 'Inactive'),
                                text: (row) => (row.active ? 'Active' : 'Inactive'),
                                cell: (row) => <ActiveBadge active={row.active} />,
                              },
                              {
                                key: 'start',
                                header: 'Starts',
                                sortBy: (row) => row.startDate?.getTime() ?? 0,
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
                    </>
                  ),
                },
                {
                  id: 'coupons',
                  empty: knownEmpty(coupons ?? NO_PART),
                  node: (
                    <>
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
                                sortBy: (row) => (row.active ? 'Active' : 'Inactive'),
                                text: (row) => (row.active ? 'Active' : 'Inactive'),
                                cell: (row) => <ActiveBadge active={row.active} />,
                              },
                              {
                                key: 'end',
                                header: 'Ends',
                                sortBy: (row) => row.endDate?.getTime() ?? 0,
                                cell: (row) => <Muted>{day(row.endDate)}</Muted>,
                              },
                            ]}
                          />
                        )}
                      </PartSection>
                    </>
                  ),
                },
                {
                  id: 'taxes',
                  empty: knownEmpty(taxes ?? NO_PART),
                  node: (
                    <>
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
                                cell: (row) => (
                                  <Strong className="tabular-nums">{row.percentage}</Strong>
                                ),
                              },
                              {
                                key: 'inclusive',
                                header: 'Applied',
                                sortBy: (row) =>
                                  row.inclusive ? 'Included in price' : 'Added on top',
                                text: (row) =>
                                  row.inclusive ? 'Included in price' : 'Added on top',
                                cell: (row) => (
                                  <Muted>
                                    {row.inclusive ? 'Included in price' : 'Added on top'}
                                  </Muted>
                                ),
                              },
                              {
                                key: 'priority',
                                header: 'Priority',
                                cell: (row) => (
                                  <Muted className="tabular-nums">{row.priority}</Muted>
                                ),
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
                    </>
                  ),
                },
              ])}
            </div>

            <div className="flex flex-col gap-5 xl:sticky xl:top-6">
              <ActivitySection
                entries={activityEntries}
                {...(activityEmptyText ? { emptyText: activityEmptyText } : {})}
                awaiting={activityAwaiting}
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

        {/*
          The contract's own facts, kept off the Overview so it leads with
          what the contract is doing (upcoming invoice, charges, add-ons):
          its terms, billing and collection, and metadata.
        */}
        {tab === 'information' ? (
          <div className="flex min-w-0 flex-col gap-6">
            <ContractDetails
              subscription={s}
              usage={usageData}
              {...(onOpenCustomer ? { onOpenCustomer } : {})}
              {...(onOpenPlan ? { onOpenPlan } : {})}
            />
            {fxOverrides}
            <MetadataCard
              metadata={s.metadata}
              // A cancelled contract is read-only, its metadata too.
              {...(onSaveMetadata && canModify ? { onSave: onSaveMetadata } : {})}
            />
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
            {...(openCharge ? { onOpenCharge: openCharge } : {})}
            {...(chargeHistory ? { history: chargeHistory } : {})}
            extraActions={chargeExtras}
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
            {/*
              The customer's usage breakdown, scoped to this contract's metered
              charges, when the page supplies it; else this contract's own
              usage charges for the period.
            */}
            {usageBreakdown ? (
              usageBreakdown
            ) : (
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
                        sortBy: (charge) => charge.name,
                        text: (charge) => charge.name,
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
                        sortBy: (charge) => Number(charge.amount.amount),
                        cell: (charge) => (
                          <Strong className="tabular-nums">{formatMoney(charge.amount)}</Strong>
                        ),
                      },
                    ]}
                  />
                )}
              </PartSection>
            )}
          </>
        ) : null}

        {tab === 'revenue' && revenue ? revenue : null}
        {tab === 'journal' && journal ? journal : null}

        {tab === 'invoices' ? (
          <PartSection
            title="Invoices"
            showTitle={false}
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
                    sortBy: (row) => sentence(words(row.status)),
                    text: (row) => sentence(words(row.status)),
                    cell: (row) => <InvoiceStatusBadge status={row.status} />,
                  },
                  {
                    key: 'payment',
                    header: 'Payment',
                    sortBy: (row) =>
                      row.paymentStatus ? sentence(words(row.paymentStatus)) : 'No payment',
                    text: (row) =>
                      row.paymentStatus ? sentence(words(row.paymentStatus)) : 'No payment',
                    cell: (row) => <PaymentCell row={row} />,
                  },
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
        // A contract that has not started yet: a new charge starts with it, never before.
        {...(s.startDate && s.startDate.getTime() > Date.now()
          ? { earliestStart: s.startDate.toISOString() }
          : {})}
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
          addonCharges: sectionOptions?.addonCharges,
          addonChargesFailed: sectionOptions?.addonChargesFailed,
          meters,
          currency: s.currency,
          billingPeriod: s.billingPeriod ?? undefined,
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
      {onPause && pauseMode === 'pause' ? (
        <PauseContractDialog
          mode="pause"
          open
          onOpenChange={(next) => !next && setPauseMode(null)}
          onConfirm={onPause}
        />
      ) : null}
      {onResume && pauseMode === 'resume' ? (
        <PauseContractDialog
          mode="resume"
          open
          onOpenChange={(next) => !next && setPauseMode(null)}
          onConfirm={onResume}
        />
      ) : null}
      <FormDialog
        open={alertEdit !== null}
        onOpenChange={(next) => {
          if (next) return
          setAlertEdit(null)
          setSaveError(null)
        }}
        title={alertEdit?.settingId ? 'Alert settings' : 'Add alerts'}
        isPending={saving}
      >
        {alertEdit ? (
          <ChargeAlertForm
            key={alertEdit.settingId ?? alertEdit.lineId}
            initial={alertEdit.config}
            {...(alertEdit.settingId ? {} : { chooseSeverities: true, submitLabel: 'Add alerts' })}
            pending={saving}
            error={saveError}
            onCancel={() => {
              setAlertEdit(null)
              setSaveError(null)
            }}
            onSubmit={(config) => {
              const { settingId, lineId } = alertEdit
              const save = settingId
                ? onSaveChargeAlert?.({ settingId, config })
                : onCreateChargeAlert?.({ lineId, config })
              setSaving(true)
              setSaveError(null)
              Promise.resolve(save)
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

/** A charge's line item versions as its sheet's History lists them. */
function lineVersions(
  lines: readonly SubscriptionLine[],
  knownPrices: ReadonlyMap<string, Charge>,
): ChargeVersion[] {
  return lines.flatMap((version) => {
    const charge =
      version.charge ?? (version.priceId ? knownPrices.get(version.priceId) : undefined)
    const unit = charge ? chargePriceLabel(charge) : null
    // A count of units only on a fixed charge: a metered line's quantity is
    // usage (often 0), and its price is already a per-unit rate.
    const counted = version.kind !== 'usage' && charge?.type !== PriceType.Usage
    const quantity = counted ? version.quantity?.trim() : undefined
    const priced = unit ? (quantity && quantity !== '1' ? `${unit} × ${quantity}` : unit) : null
    const price =
      priced ?? (quantity && quantity !== '1' ? `${version.name} × ${quantity}` : version.name)
    if (!price) return []
    return [
      {
        id: version.id,
        price,
        startDate: version.startDate,
        endDate: version.endDate,
        updatedAt: charge?.createdAt ?? null,
      },
    ]
  })
}

/** Prices already loaded for this contract, keyed by price id. */
function chargesByPriceId(lines: readonly SubscriptionLine[]): Map<string, Charge> {
  const prices = new Map<string, Charge>()
  for (const line of lines) {
    if (line.priceId && line.charge) prices.set(line.priceId, line.charge)
  }
  return prices
}

/** The value a row is about: name, amount. Everything else in the row is `Muted`. */
function Strong({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-foreground font-medium', className)}>{children}</span>
}

function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-muted-foreground font-normal', className)}>{children}</span>
}

function ActiveBadge({ active }: { active: boolean }) {
  const label = active ? 'Active' : 'Ended'
  return <Pill tone={statusTone(label)}>{label}</Pill>
}

const sentence = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '—')

const isZero = (money: Money) => Number(money.amount) === 0

const deduction = (money: Money) =>
  Number(money.amount) > 0 ? `−${formatMoney(money)}` : formatMoney(money)

/**
 * The contract's own facts. Each card is four fields, and nothing the header
 * already says: status, billing cycle and currency are badges, and a trial is
 * the info chip above these cards.
 */
function ContractDetails({
  subscription: s,
  usage,
  onOpenCustomer,
  onOpenPlan,
}: {
  subscription: SubscriptionDetail
  usage: SubscriptionUsage | undefined
  onOpenCustomer?: () => void
  onOpenPlan?: () => void
}) {
  const commitment = s.commitment
  return (
    <div className="grid items-stretch gap-5 lg:grid-cols-2">
      <Section title="Contract" className="h-full">
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
          ]}
        />
      </Section>
      <Section title="Billing & collection" className="h-full">
        <Properties
          columns={2}
          items={[
            {
              label: 'Payment terms',
              value: sentence(s.paymentTerms ? words(s.paymentTerms) : ''),
            },
            {
              label: 'Collection',
              value: sentence(s.collectionMethod ? words(s.collectionMethod) : ''),
            },
            {
              label: 'Commitment',
              value: commitment
                ? // The overage premium rides with the amount, so the card keeps its four rows.
                  `${formatMoney(commitment.amount)} per ${commitmentPeriodNoun(commitment.period, commitment.periodCount)}${commitment.overageFactor && commitment.overageFactor !== 1 ? ` · ${commitment.overageFactor}× overage` : ''}${usage?.commitmentUtilized ? ` · ${formatMoney(usage.commitmentUtilized)} used` : ''}`
                : 'None',
            },
            {
              label: 'True-up',
              value: commitment ? (commitment.trueUp ? 'On' : 'Off') : 'None',
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
/**
 * A preview line's unit price, from the contract line's own price when it can be
 * joined: a flat or per-unit price is its amount, a tiered or volume price says
 * so, and a package price is per package. Without a join it is the amount over
 * the quantity, which is only right for a flat price.
 */
function previewUnitPrice(
  line: InvoicePreviewLine,
  contract: SubscriptionLine | undefined,
): string {
  const charge = contract?.charge
  if (charge) {
    if (charge.billingModel === BillingModel.Tiered) return 'Tiered'
    // A custom-unit price is written in its unit ("10 TOK"); `charge.amount` is
    // not that rate, so without the unit's own amount it falls back below.
    const unit = contract?.pricing?.priceUnit ?? ''
    const rate = unit
      ? contract?.pricing?.priceUnitAmount
        ? `${unitAmount(contract.pricing.priceUnitAmount)} ${unit}`
        : null
      : charge.amount
        ? unitMoney(money(charge.amount, charge.currency))
        : null
    if (rate) {
      return charge.billingModel === BillingModel.Package && charge.transformQuantity?.divideBy
        ? `${rate} per ${charge.transformQuantity.divideBy.toLocaleString('en-US')}`
        : rate
    }
  }
  return line.unitPrice ? unitMoney(line.unitPrice) : '—'
}

/** A custom-unit rate as written, grouped, up to six decimals: "10", "0.0025". */
function unitAmount(amount: string): string {
  // The exact decimal string, as unitMoney passes it: a double would round a large rate.
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(
    amount as unknown as number,
  )
}

/**
 * A part known to have no rows: it arrived empty and is neither refetching
 * nor failed. A cached empty result under a failed refresh is not empty: its
 * error must stay where it can be seen.
 */
function knownEmpty(part: SubscriptionPart<readonly unknown[]>): boolean {
  return !part.isLoading && !part.isError && part.data?.length === 0
}

/**
 * The Overview's sections, those with rows first: an empty entry-point
 * section sinks below every section that has something to read. The sort is
 * stable, so each group keeps the order it was given.
 */
function rowsFirst(sections: { id: string; empty: boolean; node: ReactNode }[]): ReactNode {
  return [...sections]
    .sort((a, b) => Number(a.empty) - Number(b.empty))
    .map((section) => <Fragment key={section.id}>{section.node}</Fragment>)
}

function InvoicePreviewSection({
  status,
  preview,
  contractLines,
}: {
  status: SubscriptionStatus
  preview: SubscriptionPart<InvoicePreview>
  /** The contract's own lines: each preview line is joined to one by price for its real price. */
  contractLines: readonly SubscriptionLine[]
}) {
  const [expanded, setExpanded] = useState(false)
  const byPrice = new Map(contractLines.map((line) => [line.priceId, line]))
  const contractLineOf = (line: InvoicePreviewLine) =>
    line.priceId ? byPrice.get(line.priceId) : undefined
  if (status === SubscriptionStatus.Cancelled || status === SubscriptionStatus.Incomplete) {
    return null
  }
  if (status === SubscriptionStatus.Trialing) {
    return (
      <Section table showTitle title="Upcoming invoice">
        <SubTabState
          hasData={false}
          isLoading={false}
          columns={4}
          loadingLabel="Loading the upcoming invoice"
          empty={{
            scene: 'billing',
            title: 'Billing starts after the trial',
            description: 'The first invoice is created when the trial ends.',
          }}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }

  // Nothing to bill: the section is left out rather than shown empty. The
  // trial block above stays, because there the empty state is the news.
  // A failed or running refetch over a cached empty preview still shows, so
  // its error and retry are not hidden.
  if (!preview.isLoading && !preview.isError && preview.data?.lines.length === 0) return null

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
            footer={false}
            pageSize={Math.max(value.lines.length, 1)}
            columns={[
              {
                key: 'name',
                header: 'Description',
                sortBy: (line) => line.name,
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
                key: 'unitPrice',
                header: 'Unit price',
                align: 'end',
                cell: (line) => (
                  <Muted className="tabular-nums">
                    {previewUnitPrice(line, contractLineOf(line))}
                  </Muted>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                align: 'end',
                sortBy: (line) => Number(line.amount.amount),
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
          {/* pe-4 is the compact table's trailing cell inset: the totals end on the Amount column's edge. */}
          <div className="flex justify-end border-t py-4 ps-6 pe-4">
            <TotalsList>
              <TotalRow label="Subtotal" value={formatMoney(value.subtotal)} />
              {!isZero(value.discount) ? (
                <TotalRow label="Discount" value={deduction(value.discount)} />
              ) : null}
              {!isZero(value.tax) ? <TotalRow label="Tax" value={formatMoney(value.tax)} /> : null}
              {!isZero(value.prepaidCredits) ? (
                <TotalRow label="Prepaid credits" value={deduction(value.prepaidCredits)} />
              ) : null}
              <TotalRow
                label="Amount due"
                value={formatMoney(value.amountDue)}
                emphasis="due"
                rule
              />
            </TotalsList>
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
 * (an entitlement, a credit grant…): the contract's own scope otherwise.
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
        <SubTabState
          hasData={false}
          isLoading
          columns={5}
          loadingLabel={`Loading ${title.toLowerCase()}`}
          empty={{ scene: scene ?? 'billing', title: emptyTitle, description: emptyDescription }}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }
  if (part.isError || !data) {
    return (
      <Section {...frame}>
        <SubTabState
          hasData={false}
          isLoading={false}
          error={failure}
          onRetry={part.onRetry}
          columns={5}
          loadingLabel={`Loading ${title.toLowerCase()}`}
          empty={{ scene: scene ?? 'billing', title: emptyTitle, description: emptyDescription }}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }
  if (isEmpty(data)) {
    return (
      <Section {...frame}>
        <SubTabState
          hasData={false}
          isLoading={false}
          columns={5}
          loadingLabel={`Loading ${title.toLowerCase()}`}
          empty={{ scene: scene ?? 'billing', title: emptyTitle, description: emptyDescription }}
        >
          {null}
        </SubTabState>
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
