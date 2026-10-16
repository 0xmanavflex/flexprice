import { useMemo, useState } from 'react'
import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  type BillingPeriod,
  type Charge,
  type ChargeDetail,
  type ChargeSection,
  InvoiceCadence,
  PriceType,
  TierMode,
  isChargeCustomised,
} from '@fp/domain'
import { SubTabState, type SubTabQuery } from '@ui/compositions/detail/SubTabState'
import { ArrowRightIcon, PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { ButtonGroup } from '@ui/components/primitives/button-group'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { Section } from '@ui/compositions/layout/Section'

import { provenance } from '@ui/provenance'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable, type DetailColumn } from '../../shared/DetailTable'
import { ChargeFlags } from './ChargeFlags'
import { ChargeSheet } from './ChargeSheet'

/**
 * A charges section: what a plan, add-on, contract or cost sheet bills.
 *
 * One table everywhere charges appear, and one row per charge — no expansion,
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

/** Which charges the table is showing. */
type View = 'active' | 'changed' | 'ended'

export interface ChargeTableProps extends Partial<SubTabQuery> {
  charges: Charge[]
  /**
   * What is special about each charge, by charge id.
   *
   * Absent for a page that cannot read it — a plan's charges are prices and
   * carry no override, coupon or commitment, so the plan page sends nothing and
   * no row shows a flag. A contract's are line items and carry most of it.
   */
  details?: ReadonlyMap<string, ChargeDetail>
  /**
   * The container's own billing frequency.
   *
   * A charge names its period only when it differs from this, so the common
   * case — every charge billed as the plan is — does not repeat the same word
   * down the column. Absent means every charge states its own.
   */
  period?: BillingPeriod | string
  /**
   * `summary` shows only the changed charges and a link to the rest — the
   * contract Overview. `full` shows every charge with the Active / Changed /
   * Ended views — the Charges tab.
   */
  variant?: 'summary' | 'full'
  /** `narrow` is the table beside a side rail: no quantity column, flags compact. */
  layout?: 'wide' | 'narrow'
  /**
   * Where the charge comes from, for the grey line's second half.
   *
   * A contract's charges arrive from its plan, from an add-on, or from the
   * contract alone, and which is the most useful thing to know about a row
   * there — more than the billing model, which is the default. It goes in the
   * line rather than a column so the four columns the redesign specifies stay
   * four. Narrowing by it is the `facets` prop's job.
   */
  source?: (charge: Charge) => string | undefined
  /** Extra facet filters beside the billing-model one, e.g. Source. */
  facets?: Array<{ id: string; label: string; value: (charge: Charge) => string }>
  priceLabel?: (charge: Charge) => string
  hideRowActions?: boolean
  onAdd?: () => void
  /** The add button's wording; a contract calls it "Manage pricing". */
  addLabel?: string
  onEdit?: (charge: Charge) => void
  /** `false` leaves a row's Edit out — a contract cannot reprice every line. */
  canEdit?: (charge: Charge) => boolean
  onTerminate?: (charge: Charge) => void
  /** The destructive item's wording; "Terminate" on a catalogue, "End charge" on a contract. */
  removeLabel?: string
  /** Extra row-menu items, e.g. a contract's "Edit on plan". */
  extraActions?: (charge: Charge) => Array<{ label: string; onSelect: () => void }>
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
  /** The summary variant's "Show all charges". */
  onShowAll?: () => void
  locale?: string
  /** Section heading; defaults to "Charges". */
  title?: string
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
function valueOf(charge: Charge): string {
  const display = charge.displayAmount || charge.amount
  switch (charge.billingModel) {
    case BillingModel.FlatFee:
      return display || '—'
    case BillingModel.Package:
      return `${display || '0'} per ${charge.transformQuantity?.divideBy?.toLocaleString() ?? '?'}`
    case BillingModel.Tiered:
      // The tier count is its own grey line now, so the price says the price.
      return charge.tiers[0]?.unitAmount ? `From ${charge.tiers[0].unitAmount}` : '—'
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

const DATE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * The grey line under a charge's name: fixed or usage, then one more thing.
 *
 * Which "one more thing" is the most useful fact about *this* charge right
 * now — that it has ended, that it has not started, that it bills on a
 * different cycle from everything around it — falling back to the billing
 * model, which is the answer when nothing else is unusual.
 */
function kindLine(
  charge: Charge,
  period: string | undefined,
  locale: string | undefined,
  source: string | undefined,
): string {
  const kind = charge.type === PriceType.Usage ? 'Usage' : 'Fixed'
  const format = locale
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : DATE
  // Two parts, never three: a third would be a column wearing a grey font.
  // Lifecycle first (it changes what the row means), then where the charge
  // came from where a page can say, then the billing model as the default.
  const rest = charge.endDate
    ? `Ended ${format.format(charge.endDate)}`
    : charge.startDate && charge.startDate.getTime() > Date.now()
      ? `Starts ${format.format(charge.startDate)}`
      : (source ??
        (period && charge.billingPeriod !== period ? billedLabel(charge) : modelLabel(charge)))
  return `${kind} · ${rest}`
}

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
  onShowAll,
  emptyDescription,
  locale,
  title = 'Charges',
  description: sectionDescription,
  chargeColumnLabel = 'Charge',
  isLoading,
  error,
  errorKind,
  retryAfterMs,
  onRetry,
  isRetrying,
}: ChargeTableProps) {
  const [view, setView] = useState<View>('active')
  // The sheet the rows and flags open, unless the page took the click instead.
  const [open, setOpen] = useState<{ charge: Charge; section?: ChargeSection } | null>(null)
  const narrow = layout === 'narrow'
  const hasActions = !hideRowActions && Boolean(onEdit || onTerminate || !onRowClick)

  const openAt = (charge: Charge, section?: ChargeSection) =>
    setOpen(section ? { charge, section } : { charge })

  const { active, changed, ended } = useMemo(() => {
    const order = ordering(details)
    const live = charges.filter((charge) => !charge.endDate).sort(order)
    return {
      active: live,
      changed: live.filter((charge) => isChargeCustomised(details?.get(charge.id))),
      ended: charges.filter((charge) => charge.endDate).sort(order),
    }
  }, [charges, details])

  const rows =
    variant === 'summary'
      ? changed
      : view === 'changed'
        ? changed
        : view === 'ended'
          ? ended
          : active

  const addButton = onAdd ? (
    <Button
      type="button"
      size="sm"
      className="h-8 px-3"
      onClick={onAdd}
      disabled={Boolean(isLoading || error)}
    >
      <PlusIcon aria-hidden />
      {addLabel}
    </Button>
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
        showTitle
        title={title}
        {...(sectionDescription ? { description: sectionDescription } : {})}
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
            ...(addButton ? { action: addButton } : {}),
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
      width: narrow ? 220 : 280,
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
      key: 'price',
      header: 'Price',
      width: narrow ? 160 : 200,
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
      width: narrow ? 230 : 360,
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

  if (!narrow && charges.some((charge) => details?.get(charge.id)?.quantity !== undefined)) {
    columns.splice(2, 0, {
      key: 'quantity',
      header: 'Quantity',
      width: 100,
      text: (charge) => details?.get(charge.id)?.quantity ?? '',
      cell: (charge) => (
        <span className="tabular-nums">{details?.get(charge.id)?.quantity ?? '—'}</span>
      ),
    })
  }

  if (hasActions) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (charge: Charge) => (
        // The row opens the sheet, so the menu's own click must not reach it —
        // the sheet is a dialog, and opening one dismisses the menu that was
        // being opened.
        <span className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <RowActionsMenu
            label={nameOf(charge)}
            extra={[
              ...(onRowClick ? [] : [{ label: 'View details', onSelect: () => openAt(charge) }]),
              ...(extraActions?.(charge) ?? []),
              {
                label: 'Copy price ID',
                onSelect: () => void navigator.clipboard?.writeText(charge.id),
              },
            ]}
            onEdit={
              onEdit && !charge.endDate && (canEdit?.(charge) ?? true)
                ? () => onEdit(charge)
                : undefined
            }
            onRemove={onTerminate && !charge.endDate ? () => onTerminate(charge) : undefined}
            removeLabel={removeLabel}
          />
        </span>
      ),
    })
  }

  // The views only exist where there is something to switch to: a plan whose
  // charges are all active and all as set has one button, which is not a choice.
  const views: Array<{ id: View; label: string }> = [
    { id: 'active', label: `Active ${active.length}` },
    ...(changed.length > 0 ? [{ id: 'changed' as const, label: `Changed ${changed.length}` }] : []),
    ...(ended.length > 0 ? [{ id: 'ended' as const, label: `Ended ${ended.length}` }] : []),
  ]

  // The section controls stay above the table in every view.
  const viewSwitch =
    views.length > 1 ? (
      <ButtonGroup>
        {views.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={view === option.id ? 'secondary' : 'outline'}
            aria-pressed={view === option.id}
            onClick={() => setView(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </ButtonGroup>
    ) : null

  const showAllButton = onShowAll ? (
    <Button variant="outline" size="sm" className="h-8 px-3" onClick={onShowAll}>
      Show all charges
      <ArrowRightIcon aria-hidden />
    </Button>
  ) : null
  // While the summary has nothing to list, the way through sits in the empty
  // body. Once a change appears, it moves up beside the title.
  const summaryEmpty = variant === 'summary' && rows.length === 0
  const titleAction = variant === 'summary' && !summaryEmpty ? showAllButton : undefined

  const toolbarAction =
    variant === 'full' && (viewSwitch || addButton) ? (
      <span className="flex items-center gap-2">
        {viewSwitch}
        {addButton}
      </span>
    ) : undefined

  const charge = (count: number) => `${count} active charge${count === 1 ? '' : 's'}`
  const description =
    variant === 'summary'
      ? changed.length > 0
        ? `${changed.length} of ${charge(active.length)} ${changed.length === 1 ? 'is' : 'are'} changed here`
        : `${charge(active.length)}, all as the plan sets them`
      : sectionDescription

  return (
    <>
      <Section
        table
        showTitle
        title={title}
        {...(description ? { description } : {})}
        action={variant === 'summary' ? titleAction : toolbarAction}
      >
        {rows.length === 0 ? (
          <SectionEmpty
            scene="catalog"
            title={
              variant === 'summary'
                ? 'No changes'
                : view === 'ended'
                  ? 'No charges have ended'
                  : 'No charges yet'
            }
            description={
              variant === 'summary'
                ? 'Every charge is billed as the plan sets it. Changed charges show here.'
                : undefined
            }
            {...(summaryEmpty && showAllButton ? { action: showAllButton } : {})}
          />
        ) : (
          <DetailTable
            compact
            label="Charges"
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
              ...(facets ?? []),
            ]}
            noun="charges"
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
        onClose={() => setOpen(null)}
      />
    </>
  )
}
