import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  type BillingPeriod,
  type Charge,
  InvoiceCadence,
  PriceType,
  TierMode,
} from '@fp/domain'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'

import { provenance } from '@ui/provenance'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable } from '../../shared/DetailTable'

/**
 * A charges section: what an add-on or cost sheet bills, at a glance.
 *
 * The reference add-on "Charges" section: a flush `Section` holding a
 * `SimpleTable` of charge (with a fixed/usage dot), billing model, how it is
 * billed (period, timing) and price.
 *
 * Presentational: it takes `Charge[]` and reports intent. Adding and terminating
 * are the page's to wire, so this can render in a story without a network.
 */
export const ChargeTableProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section', 'pages/shared/DetailTable', 'ui/button'],
  note: 'Flush charges section for add-on and cost-sheet detail pages.',
})

export interface ChargeTableProps {
  charges: Charge[]
  onAdd?: () => void
  onEdit?: (charge: Charge) => void
  onTerminate?: (charge: Charge) => void
  locale?: string
  /** Section heading; defaults to "Charges". */
  title?: string
  /**
   * The sentence shown when there are no charges, in the caller's own noun.
   *
   * This table is shared by plans, add-ons, and cost sheets, so it cannot name
   * the thing it is inside. It used to say "A plan bills nothing until it has a
   * charge", which read as plan copy on the add-on page, and it told the reader
   * to add a charge on a surface that offers no way to. The default below is
   * noun-free and only asks for a charge when `onAdd` is wired; a caller that
   * can name its entity should.
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
      return `${charge.tiers.length} tier${charge.tiers.length === 1 ? '' : 's'} · ${
        charge.tierMode === 'SLAB' ? 'Slab' : 'Volume'
      }`
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

/** Fixed and usage charges, told apart by a small neutral dot. */
function KindDot({ usage }: { usage: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        usage
          ? 'bg-muted-foreground/50 size-1.5 rounded-full'
          : 'bg-foreground/60 size-1.5 rounded-full'
      }
    />
  )
}

export function ChargeTable({
  charges,
  onAdd,
  onEdit,
  onTerminate,
  emptyDescription,
  title = 'Charges',
}: ChargeTableProps) {
  const hasActions = Boolean(onEdit || onTerminate)
  const addButton = onAdd ? (
    <Button type="button" size="sm" className="h-9 px-3" onClick={onAdd}>
      <PlusIcon aria-hidden />
      Add charges
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
      <Section title={title} flush>
        <SectionEmpty title="No charges yet" description={emptyText} action={addButton} />
      </Section>
    )
  }

  return (
    <Section title={title} flush bare>
      <DetailTable
        label="Charges"
        {...(addButton ? { action: addButton } : {})}
        facet={{ label: 'Billing model', value: (charge) => modelLabel(charge) }}
        noun="charges"
        rows={charges}
        columns={[
          {
            key: 'name',
            header: 'Charge',
            sortBy: (charge) => charge.displayName || charge.meterName || '',
            cell: (charge) => (
              <span className="flex items-center gap-2.5">
                <KindDot usage={charge.type === PriceType.Usage} />
                <span className="font-medium">
                  {charge.displayName || charge.meterName || 'Charge'}
                </span>
              </span>
            ),
          },
          {
            key: 'model',
            header: 'Billing model',
            sortBy: (charge) => modelLabel(charge),
            cell: (charge) => <span className="text-muted-foreground">{modelLabel(charge)}</span>,
          },
          {
            key: 'billed',
            header: 'Billed',
            cell: (charge) => <span className="text-muted-foreground">{billedLabel(charge)}</span>,
          },
          {
            key: 'price',
            header: 'Price',
            cell: (charge) => <span className="tabular-nums">{valueOf(charge)}</span>,
          },
          ...(hasActions
            ? [
                {
                  key: 'actions',
                  header: '',
                  className: 'w-12',
                  cell: (charge: Charge) => (
                    <RowActionsMenu
                      label={charge.displayName || 'charge'}
                      onEdit={onEdit ? () => onEdit(charge) : undefined}
                      onRemove={onTerminate ? () => onTerminate(charge) : undefined}
                      removeLabel="Terminate"
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </Section>
  )
}
