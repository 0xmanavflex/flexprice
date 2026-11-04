import { WriteGate } from '@ui/compositions/access/Access'
import { useMemo, useState } from 'react'
import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  type BillingPeriod,
  type Charge,
  type ChargeDetail,
  type ChargeHistory,
  type ChargeSection,
  chargeHasEnded,
  InvoiceCadence,
  PriceType,
  TierMode,
  isChargeCustomised,
  chargeAmountLabel,
  chargePricedTiers,
  tierUnitLabel,
} from '@fp/domain'
import { SubTabState, type SubTabQuery } from '@ui/compositions/detail/SubTabState'
import type { ReactElement } from 'react'
import { ArrowRightIcon, CircleSlashIcon, CopyIcon, EyeIcon, PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ui/components/primitives/tooltip'
import { Section } from '@ui/compositions/layout/Section'

import { provenance } from '@ui/provenance'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable, type DetailColumn } from '../../shared/DetailTable'
import { Pill } from '../../shared/cells'
import { ChargeFlags } from './ChargeFlags'
import { ChargeSheet } from './ChargeSheet'
import { statusTone } from '../../shared/statusTones'
/**
 * A charges section: what a plan, add-on, contract or cost sheet bills.
 *
 * One table everywhere charges appear, and one row per charge: no expansion,
 * no nested table. A row carries the charge, its price, a quantity where there
 * is one, and *flags*: Price changed, Discount, Commitment, Alerts, History.
 * Everything a flag stands for lives in the charge sheet the flag opens, at
 * the part that was clicked.
 *
 * That split is the point. The old row answered "what is this charge" by
 * showing the billing model, the cadence and the price across four columns, and
 * still could not say that the contract had overridden it. This one answers
 * "what is this charge, and is anything unusual about it" in two columns and a
 * strip of chips, and sends the rest to a surface with room for it.
 *
 * Presentational: it takes `Charge[]` and the per-charge `details` the page
 * read, and reports intent. Adding, editing and ending are the page's to wire,
 * so this renders in a story without a network.
 */
export const ChargeTableProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/section',
    'compositions/SubTabState',
    'pages/shared/DetailTable',
    'ui/button',
  ],
  note: 'Flush charges section with flags, shared by plan, feature, group, add-on, contract and cost-sheet pages.',
})

export interface ChargeTableProps extends Partial<SubTabQuery> {
  charges: Charge[]
  /**
   * What is special about each charge, by charge id.
   *
   * Absent for a page that cannot read it: a plan's charges are prices and
   * carry no override, coupon or commitment, so the plan page sends nothing and
   * no row shows a flag. A contract's are line items and carry most of it.
   */
  details?: ReadonlyMap<string, ChargeDetail>
  /**
   * The container's own billing frequency.
   *
   * A charge names its period only when it differs from this, so the common
   * case: every charge billed as the plan is: does not repeat the same word
   * down the column. Absent means every charge states its own.
   */
  period?: BillingPeriod | string
  /**
   * `summary` shows the first few live charges, changed ones first, and a
   * link to the rest: the contract Overview. `full` shows every charge, narrowed by the Status filter
   * (Active, Changed, Ended) beside the billing model: the Charges tab.
   */
  variant?: 'summary' | 'full'
  /** `narrow` is the table beside a side rail: no quantity column, flags compact. */
  layout?: 'wide' | 'narrow'
  /**
   * Where the charge comes from, for the grey line's second half.
   *
   * A contract's charges arrive from its plan, from an add-on, or from the
   * contract alone, and which is the most useful thing to know about a row
   * there: more than the billing model, which is the default. It goes in the
   * line rather than a column so the four columns the redesign specifies stay
   * four. Narrowing by it is the `facets` prop's job.
   */
  source?: (charge: Charge) => string | undefined
  /** Extra facet filters beside the billing-model one, e.g. Source. */
  facets?: Array<{ id: string; label: string; value: (charge: Charge) => string }>
  priceLabel?: (charge: Charge) => string
  hideRowActions?: boolean
  onAdd?: () => void
  /** The add button's wording, e.g. "Add charge" on a contract. */
  addLabel?: string
  onEdit?: (charge: Charge) => void
  /** `false` leaves a row's Edit out: a contract cannot reprice every line. */
  canEdit?: (charge: Charge) => boolean
  onTerminate?: (charge: Charge) => void
  /** The destructive item's wording; "Terminate" on a catalogue, "End charge" on a contract. */
  removeLabel?: string
  /** Extra row-menu items, e.g. a contract's "Go to plan". */
  extraActions?: (charge: Charge) => Array<{
    label: string
    icon: ReactElement
    onSelect: () => void
    /** Stays enabled for a viewer without write access: a copy or a link. */
    readOnly?: boolean
  }>
  /**
   * Replaces opening the sheet.
   *
   * The feature page's rows are the plans that bill the feature, so a click
   * there belongs on the plan, not on a sheet about the charge.
   */
  onRowClick?: (charge: Charge) => void
  /** Wires the sheet's per-part "Edit". A part with no handler shows no button. */
  onEditSection?: (charge: Charge, section: ChargeSection) => void
  editableSections?: (charge: Charge) => readonly ChargeSection[]
  /**
   * Told which charge's sheet is open (`null` once closed), so the page can
   * read that charge's history from the API and pass it back as `history`.
   */
  onOpenCharge?: ((charge: Charge | null) => void) | undefined
  /** The open charge's versions from the history API. */
  history?: ChargeHistory | undefined
  /** The summary variant's "Show all charges". */
  onShowAll?: () => void
  locale?: string
  /** Section heading; defaults to "Charges". */
  title?: string
  /** `false` hides the heading where the tab already names it, so it never reads "Charges, Charges". */
  showTitle?: boolean
  /**
   * Brings "Billing timing" on screen in the narrow layout.
   * It is on by default in the wide layout; without this the narrow one
   * keeps it in the column menu. "In effect" is always on screen.
   */
  showDates?: boolean
  description?: string
  chargeColumnLabel?: string
  /**
   * The sentence shown when there are no charges, in the caller's own noun.
   *
   * This table is shared by plans, add-ons, contracts and cost sheets, so it
   * cannot name the thing it is inside. It used to say "A plan bills nothing
   * until it has a charge", which read as plan copy on the add-on page, and it
   * told the reader to add a charge on a surface that offers no way to. The
   * default below is noun-free and only asks for a charge when `onAdd` is
   * wired; a caller that can name its entity should.
   */
  emptyDescription?: string
}

/** The "value" a charge bills, summarised for the table. */
/** A charge's price as one line, e.g. "$0.002 per call": the table's Price cell. */
export function chargePriceLabel(charge: Charge): string {
  return valueOf(charge)
}

function valueOf(charge: Charge): string {
  // A custom-unit price reads in its unit ("2.4 QAU"), not the currency it converts to.
  const display =
    charge.priceUnit && charge.priceUnitAmount
      ? chargeAmountLabel(charge, charge.priceUnitAmount)
      : charge.displayAmount || charge.amount
  const first = chargePricedTiers(charge)[0]
  switch (charge.billingModel) {
    case BillingModel.FlatFee:
      return display || '—'
    case BillingModel.Package:
      return `${display || '0'} per ${charge.transformQuantity?.divideBy?.toLocaleString() ?? '?'}`
    case BillingModel.Tiered:
      // The tier count is its own grey line now, so the price says the price.
      return first?.unitAmount
        ? `From ${chargeAmountLabel(charge, first.unitAmount)}${first.transformQuantity?.divideBy ? ` ${tierUnitLabel(first)}` : ''}`
        : '—'
  }
}

/** "Flat fee", "Volume tiered", "Slab tiered", "Package". */
function modelLabel(charge: Charge): string {
  if (charge.billingModel === BillingModel.Tiered) {
    return charge.tierMode === TierMode.Slab ? 'Slab tiered' : 'Volume tiered'
  }
  return BILLING_MODEL_LABEL[charge.billingModel]
}

/** "Monthly, in advance" / "Monthly, in arrears". */
function billedLabel(charge: Charge): string {
  const period = BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ?? charge.billingPeriod
  return `${period}, ${charge.invoiceCadence === InvoiceCadence.Advance ? 'in advance' : 'in arrears'}`
}

function nameOf(charge: Charge): string {
  return charge.displayName || charge.meterName || 'Charge'
}

// Charge dates are calendar days stored at midnight UTC; read them in UTC so a
// viewer west of Greenwich does not see the day before.
const DATE_OPTIONS = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } as const
const DATE = new Intl.DateTimeFormat(undefined, DATE_OPTIONS)

/** "Jan 1, 2026 → Ongoing". One line everywhere this table is shown. */
function inEffect(charge: Charge, locale?: string): string {
  const format = locale ? new Intl.DateTimeFormat(locale, DATE_OPTIONS) : DATE
  const start = charge.startDate ? format.format(charge.startDate) : 'Start date not set'
  const end = charge.endDate ? format.format(charge.endDate) : 'Ongoing'
  return `${start} → ${end}`
}

const STAMP_OPTIONS = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'longOffset',
} as const

/** "28 Oct 2026, 09:15:32 GMT+5:30", in the viewer's zone. */
function stamp(date: Date, locale?: string): string {
  const parts = new Intl.DateTimeFormat(locale, STAMP_OPTIONS).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}:${part('second')} ${part('timeZoneName')}`
}

/** Whether a charge's end has passed. A future end date is scheduled: the charge still bills. */
export function hasEnded(charge: Charge, now: number = Date.now()): boolean {
  return chargeHasEnded(charge, now)
}

/**
 * The grey line under a charge's name: fixed or usage, then one more thing.
 *
 * Which "one more thing" is the most useful fact about *this* charge right
 * now: that it has ended, that it has not started, that it bills on a
 * different cycle from everything around it: falling back to the billing
 * model, which is the answer when nothing else is unusual.
 */
function kindLine(
  charge: Charge,
  period: string | undefined,
  locale: string | undefined,
  source: string | undefined,
): string {
  const kind = charge.type === PriceType.Usage ? 'Usage' : 'Fixed'
  const format = locale ? new Intl.DateTimeFormat(locale, DATE_OPTIONS) : DATE
  // Two parts, never three: a third would be a column wearing a grey font.
  // Lifecycle first (it changes what the row means), then where the charge
  // came from where a page can say, then the billing model as the default.
  const rest = charge.endDate
    ? `${hasEnded(charge) ? 'Ended' : 'Ends'} ${format.format(charge.endDate)}`
    : charge.startDate && charge.startDate.getTime() > Date.now()
      ? `Starts ${format.format(charge.startDate)}`
      : (source ??
        (period && charge.billingPeriod !== period ? billedLabel(charge) : modelLabel(charge)))
  return `${kind} · ${rest}`
}

/** The live charges the summary variant lists before "Show all charges". */
const SUMMARY_ROWS = 5

/** Changed charges first (the more flags, the higher), then fixed before usage, then by name. */
function ordering(details: ReadonlyMap<string, ChargeDetail> | undefined) {
  const weight = (charge: Charge) => (isChargeCustomised(details?.get(charge.id)) ? 1 : 0)
  return (a: Charge, b: Charge) =>
    weight(b) - weight(a) ||
    (a.type === b.type ? 0 : a.type === PriceType.Fixed ? -1 : 1) ||
    nameOf(a).localeCompare(nameOf(b))
}

export function ChargeTable({
  charges,
  details,
  period,
  variant = 'full',
  layout = 'wide',
  source,
  facets,
  onAdd,
  addLabel = 'Add charges',
  priceLabel = valueOf,
  hideRowActions = false,
  onEdit,
  canEdit,
  onTerminate,
  removeLabel = 'Terminate',
  extraActions,
  onRowClick,
  onEditSection,
  editableSections,
  onOpenCharge,
  history,
  onShowAll,
  emptyDescription,
  locale,
  title = 'Charges',
  showTitle = true,
  showDates = false,
  description: sectionDescription,
  chargeColumnLabel = 'Charge',
  isLoading,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
}: ChargeTableProps) {
  // The sheet the rows and flags open, unless the page took the click instead.
  const [open, setOpenState] = useState<{ charge: Charge; section?: ChargeSection } | null>(null)
  // The page hears which charge is open, to read its history as the sheet opens.
  const setOpen = (next: { charge: Charge; section?: ChargeSection } | null) => {
    setOpenState(next)
    onOpenCharge?.(next?.charge ?? null)
  }
  const narrow = layout === 'narrow'
  const hasActions = !hideRowActions && Boolean(onEdit || onTerminate || !onRowClick)

  const openAt = (charge: Charge, section?: ChargeSection) =>
    setOpen(section ? { charge, section } : { charge })

  const { active, ended } = useMemo(() => {
    const order = ordering(details)
    return {
      active: charges.filter((charge) => !hasEnded(charge)).sort(order),
      ended: charges.filter((charge) => hasEnded(charge)).sort(order),
    }
  }, [charges, details])

  // Only charges billing now (or only scheduled so far) are rows: one whose
  // end date has passed is history, reached from its charge's History, never
  // a row of its own. The summary lists the first few (changed first, so they
  // lead) and "Show all charges" goes to the rest. Unchanged charges are still
  // charges: a contract on its plan's prices must not read as empty.
  const rows = variant === 'summary' ? active.slice(0, SUMMARY_ROWS) : active
  const statusOf = (charge: Charge) =>
    hasEnded(charge) ? 'Ended' : isChargeCustomised(details?.get(charge.id)) ? 'Changed' : 'Active'

  const addButton = onAdd ? (
    // Follows the surrounding AccessScope (price on a plan, subscription on a contract).
    <WriteGate>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-3"
        onClick={onAdd}
        disabled={Boolean(isLoading || error)}
      >
        <PlusIcon aria-hidden />
        {addLabel}
      </Button>
    </WriteGate>
  ) : null

  if (charges.length === 0) {
    // The instruction is only honest where the action exists: a surface with no
    // add flow is told what the state means, not what to do about it.
    const emptyText =
      emptyDescription ??
      (onAdd
        ? 'Nothing is billed until there is a charge. Add a fixed base or a usage charge to price it.'
        : 'Nothing is billed until there is a charge.')

    return (
      <Section
        table
        showTitle={showTitle}
        title={title}
        {...(sectionDescription ? { description: sectionDescription } : {})}
        {...(addButton ? { action: addButton } : {})}
      >
        <SubTabState
          hasData={false}
          isLoading={isLoading ?? false}
          error={error}
          errorKind={errorKind}
          retryAfterMs={retryAfterMs}
          onRetry={onRetry}
          isRetrying={isRetrying}
          columns={5}
          loadingLabel="Loading charges"
          empty={{
            scene: 'catalog',
            title: 'No charges yet',
            description: emptyText,
          }}
        >
          {null}
        </SubTabState>
      </Section>
    )
  }

  const columns: DetailColumn<Charge>[] = [
    {
      key: 'name',
      header: chargeColumnLabel,
      width: narrow ? 220 : 260,
      sortBy: (charge) => nameOf(charge),
      text: (charge) => `${nameOf(charge)} ${kindLine(charge, period, locale, source?.(charge))}`,
      cell: (charge) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{nameOf(charge)}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {kindLine(charge, period, locale, source?.(charge))}
          </span>
        </span>
      ),
    },
    {
      key: 'in-effect',
      header: 'In effect',
      width: 240,
      sortBy: (charge) => charge.startDate?.getTime() ?? 0,
      text: (charge) => inEffect(charge, locale),
      cell: (charge) => (
        <Tooltip>
          <TooltipTrigger
            render={<span className="text-sm tabular-nums" />}
            aria-label={`In effect: start ${charge.startDate ? stamp(charge.startDate, locale) : 'not set'}, end ${charge.endDate ? stamp(charge.endDate, locale) : 'ongoing'}`}
          >
            {inEffect(charge, locale)}
          </TooltipTrigger>
          <TooltipContent side="top" className="flex-col items-stretch gap-1 px-3 py-2">
            <span className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              <span className="opacity-70">Start</span>
              <span className="tabular-nums">
                {charge.startDate ? stamp(charge.startDate, locale) : 'Not set'}
              </span>
              <span className="opacity-70">End</span>
              <span className="tabular-nums">
                {charge.endDate ? stamp(charge.endDate, locale) : 'Ongoing'}
              </span>
            </span>
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      width: narrow ? 150 : 170,
      cell: (charge) => (
        <span className="block min-w-0">
          <span className="block tabular-nums">{priceLabel(charge)}</span>
          {charge.tiers.length > 0 && (
            <span className="text-muted-foreground block text-xs">
              {charge.tiers.length} tier{charge.tiers.length === 1 ? '' : 's'}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      width: narrow ? 230 : 300,
      cell: (charge) => (
        <ChargeFlags
          detail={details?.get(charge.id)}
          chargeName={nameOf(charge)}
          compact={narrow}
          onOpen={(section) => openAt(charge, section)}
        />
      ),
    },
  ]

  const timing = (charge: Charge) =>
    charge.invoiceCadence === InvoiceCadence.Advance ? 'In advance' : 'In arrears'

  // After the in-effect column: quantity (when a page knows it) and billing
  // timing, then price and flags. Beside a side rail, timing sits in the
  // column menu unless `showDates` asks for it.
  const middle: DetailColumn<Charge>[] = []
  if (!narrow && charges.some((charge) => details?.get(charge.id)?.quantity !== undefined)) {
    middle.push({
      key: 'quantity',
      header: 'Quantity',
      width: 100,
      text: (charge) => details?.get(charge.id)?.quantity ?? '',
      cell: (charge) => (
        <span className="tabular-nums">{details?.get(charge.id)?.quantity ?? '—'}</span>
      ),
    })
  }
  middle.push({
    key: 'timing',
    header: 'Billing timing',
    // Wide enough that its header never runs into "In effect".
    width: 170,
    text: timing,
    cell: (charge) => <span>{timing(charge)}</span>,
    ...(narrow && !showDates ? { hiddenByDefault: true } : {}),
  })
  columns.splice(2, 0, ...middle)
  columns.push({
    key: 'status',
    header: 'Status',
    width: 110,
    text: statusOf,
    cell: (charge) => (
      <Pill tone={statusTone(statusOf(charge))} size="sm">
        {statusOf(charge)}
      </Pill>
    ),
    hiddenByDefault: true,
  })

  if (hasActions) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (charge: Charge) => (
        // The row opens the sheet, so the menu's own click must not reach it:
        // the sheet is a dialog, and opening one dismisses the menu that was
        // being opened.
        <span className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <RowActionsMenu
            label={nameOf(charge)}
            extra={[
              {
                label: 'Copy price ID',
                icon: <CopyIcon aria-hidden />,
                readOnly: true,
                onSelect: () => void navigator.clipboard?.writeText(charge.id),
              },
              ...(extraActions?.(charge) ?? []),
              ...(onRowClick
                ? []
                : [
                    {
                      label: 'View details',
                      icon: <EyeIcon aria-hidden />,
                      readOnly: true,
                      onSelect: () => openAt(charge),
                    },
                  ]),
            ]}
            onEdit={
              onEdit && !hasEnded(charge) && (canEdit?.(charge) ?? true)
                ? () => onEdit(charge)
                : undefined
            }
            onRemove={onTerminate && !hasEnded(charge) ? () => onTerminate(charge) : undefined}
            removeLabel={removeLabel}
            removeIcon={<CircleSlashIcon aria-hidden />}
          />
        </span>
      ),
    })
  }

  const showAllButton = onShowAll ? (
    <Button variant="outline" size="sm" className="h-8 px-3" onClick={onShowAll}>
      Show all charges
      <ArrowRightIcon aria-hidden />
    </Button>
  ) : null
  // The section's action has one place, the top right of its header, with
  // rows or without: "Add" on the full table, the way to it on the summary.
  const headerAction = variant === 'summary' ? showAllButton : addButton
  const description = variant === 'summary' ? undefined : sectionDescription

  return (
    <TooltipProvider delay={300}>
      <>
        <Section
          table
          showTitle={showTitle}
          title={title}
          {...(description ? { description } : {})}
          {...(headerAction && (showTitle || rows.length === 0) ? { action: headerAction } : {})}
        >
          {rows.length === 0 ? (
            <SubTabState
              hasData={false}
              isLoading={false}
              columns={4}
              loadingLabel="Loading charges"
              empty={{
                scene: 'catalog',
                // Charges that have all ended are not a record without charges:
                // say none are live.
                ...(ended.length > 0
                  ? {
                      title: 'No active charges',
                      description: 'Every charge here has ended.',
                    }
                  : { title: 'No charges yet' }),
              }}
            >
              {null}
            </SubTabState>
          ) : (
            <DetailTable
              compact
              label="Charges"
              // The summary is a few rows; filtering or sorting them would only
              // reorder what is shown, so those live on the full table.
              toolbar={variant === 'full'}
              // The billing model left the columns for the grey line under the
              // name, but it is still what someone narrows a long list by, so the
              // filter keeps it.
              facets={[
                {
                  id: 'model',
                  label: 'Billing model',
                  value: (charge: Charge) => modelLabel(charge),
                },
                // Active or Changed: ended charges are not rows, so not a status.
                ...(variant === 'full' ? [{ id: 'status', label: 'Status', value: statusOf }] : []),
                ...(facets ?? []),
              ]}
              noun="charges"
              {...(!showTitle && headerAction ? { action: headerAction } : {})}
              rows={rows}
              columns={columns}
              onRowClick={onRowClick ?? ((charge: Charge) => openAt(charge))}
            />
          )}
        </Section>

        <ChargeSheet
          charge={open?.charge ?? null}
          {...(open && editableSections ? { editableSections: editableSections(open.charge) } : {})}
          priceLabel={open ? priceLabel(open.charge) : undefined}
          {...(open ? { detail: details?.get(open.charge.id) } : {})}
          {...(open?.section ? { section: open.section } : {})}
          {...(onEditSection && open
            ? {
                onEdit: (part: ChargeSection) => {
                  setOpen(null)
                  onEditSection(open.charge, part)
                },
              }
            : {})}
          {...(locale ? { locale } : {})}
          {...(onTerminate && open && !hasEnded(open.charge)
            ? {
                onDelete: () => {
                  const charge = open.charge
                  setOpen(null)
                  onTerminate(charge)
                },
                deleteLabel: removeLabel,
              }
            : {})}
          {...(open && history ? { history } : {})}
          onClose={() => setOpen(null)}
        />
      </>
    </TooltipProvider>
  )
}
