import { GaugeIcon, PlusIcon, RepeatIcon } from '@ui/icons'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { ErrorState, LoadingRows } from '@ui/compositions/feedback/States'
import {
  BILLING_PERIOD_LABEL,
  type BillingPeriod,
  BILLING_MODEL_LABEL,
  BillingModel,
  type Charge,
  InvoiceCadence,
  PriceType,
  TierMode,
  chargeToDraft,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { DetailTable, type DetailColumn } from '../../shared/DetailTable'
import { Section } from '@ui/compositions/layout/Section'
import { chargeLabel, money, pricingSummary } from './PlanPreviewCard'

export interface PlanChargesViewProps {
  charges: Charge[]
  onAdd: () => void
  onEdit: (charge: Charge) => void
  onTerminate: (charge: Charge) => void
  readOnly?: boolean
  /** The plan's prices are still being fetched: skeleton rows, no add action. */
  loading?: boolean
  /** The fetch failed. Shown in place of the list — never as "No charges yet". */
  error?: boolean
  /** Re-runs the fetch; the error state's "Try again". */
  onRetry?: () => void
  /** Singular unit of a meter ("call"), for "per call" wording. */
  meterUnit?: (meterId: string) => string | undefined
}

/**
 * The bands of a tiered charge, as a pricing page writes them.
 *
 * `upTo` is the top of the band and `null` is the unbounded last one, so the
 * ranges are built from the previous band's ceiling rather than stored. A
 * flat amount is a fee charged on top of the per-unit rate for that band, and
 * is only printed when there is one.
 */
function TierBands({ charge, unit }: { charge: Charge; unit?: string | undefined }) {
  const currency = (charge.currency || 'usd').toUpperCase()
  const per = unit ?? 'unit'
  let floor = 0
  return (
    <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs tabular-nums">
      {charge.tiers.map((tier, index) => {
        const from = floor + 1
        const to = tier.upTo
        floor = to ?? floor
        const flat = Number(tier.flatAmount ?? 0)
        return (
          <li key={index}>
            {from.toLocaleString()}
            {to === null ? '+' : `–${to.toLocaleString()}`}:{' '}
            {money(Number(tier.unitAmount || 0), currency)} / {per}
            {flat > 0 ? ` + ${money(flat, currency)}` : ''}
          </li>
        )
      })}
    </ul>
  )
}

/** "Flat fee", "Volume tiered", "Slab tiered", "Package". */
function modelLabel(charge: Charge): string {
  if (charge.billingModel === BillingModel.Tiered) {
    return charge.tierMode === TierMode.Slab ? 'Slab tiered' : 'Volume tiered'
  }
  return BILLING_MODEL_LABEL[charge.billingModel]
}

const typeLabel = (charge: Charge) => (charge.type === PriceType.Usage ? 'Usage' : 'Fixed')

const periodLabel = (charge: Charge) =>
  BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ?? charge.billingPeriod

const timingLabel = (charge: Charge) =>
  charge.invoiceCadence === InvoiceCadence.Advance ? 'In advance' : 'In arrears'

/** A plan's charges as one searchable, filterable table. */
export function PlanChargesView({
  charges,
  onAdd,
  onEdit,
  onTerminate,
  readOnly,
  loading,
  error,
  onRetry,
  meterUnit,
}: PlanChargesViewProps) {
  const add = readOnly ? null : (
    <Button
      type="button"
      size="sm"
      className="h-8 px-3"
      onClick={onAdd}
      disabled={Boolean(loading || error)}
    >
      <PlusIcon aria-hidden />
      Add charge
    </Button>
  )
  const meterName = (id: string) => charges.find((c) => c.meterId === id)?.meterName ?? id
  const nameOf = (charge: Charge) => chargeLabel(chargeToDraft(charge), meterName)
  const priceOf = (charge: Charge) =>
    charge.displayAmount && charge.billingModel === BillingModel.FlatFee
      ? charge.displayAmount
      : pricingSummary(
          chargeToDraft(charge),
          (charge.currency || 'usd').toUpperCase(),
          undefined,
          charge.meterId ? meterUnit?.(charge.meterId) : undefined,
        )

  if (loading || error || charges.length === 0) {
    return (
      <Section table showTitle title="Charges" action={add}>
        {loading ? (
          <div className="p-6">
            <LoadingRows rows={3} columns={5} />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState
              title="Charges could not be loaded"
              description="The plan's prices did not load, so nothing is shown rather than a wrong list."
              {...(onRetry ? { onRetry } : {})}
            />
          </div>
        ) : (
          <SectionEmpty
            scene="catalog"
            title="No charges yet"
            description="Nothing is billed yet. Add a fixed fee, a usage charge, or both."
          />
        )}
      </Section>
    )
  }

  const columns: DetailColumn<Charge>[] = [
    {
      key: 'name',
      header: 'Charge',
      sortBy: (charge) => nameOf(charge).toLowerCase(),
      text: nameOf,
      cell: (charge) => {
        const Icon = charge.type === PriceType.Usage ? GaugeIcon : RepeatIcon
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate font-medium">{nameOf(charge)}</span>
          </span>
        )
      },
    },
    {
      key: 'type',
      header: 'Type',
      sortBy: typeLabel,
      text: typeLabel,
      cell: (charge) => <span className="text-muted-foreground">{typeLabel(charge)}</span>,
    },
    {
      key: 'model',
      header: 'Model',
      sortBy: modelLabel,
      text: modelLabel,
      cell: (charge) => <span className="text-muted-foreground">{modelLabel(charge)}</span>,
    },
    {
      key: 'period',
      header: 'Billed',
      text: (charge) => `${periodLabel(charge)} ${timingLabel(charge)}`,
      cell: (charge) => (
        <span className="text-muted-foreground">
          {periodLabel(charge)}, {timingLabel(charge).toLowerCase()}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      text: priceOf,
      /*
       * A tiered charge shows its tiers, not just "3 tiers, from $0.01".
       *
       * The summary is what the row had, and it is not enough to check a
       * price with — the only place the actual bands existed was inside the
       * edit form, so reading a plan meant opening every tiered charge in
       * turn and closing it again. They are few and short; they fit here.
       */
      cell: (charge) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="tabular-nums">{priceOf(charge)}</span>
          {charge.billingModel === BillingModel.Tiered && charge.tiers.length > 0 ? (
            <TierBands
              charge={charge}
              unit={charge.meterId ? meterUnit?.(charge.meterId) : undefined}
            />
          ) : null}
        </div>
      ),
    },
    ...(readOnly
      ? []
      : [
          {
            key: 'actions',
            header: '',
            width: 48,
            cell: (charge: Charge) => (
              <RowActionsMenu
                label={charge.displayName || charge.meterName || 'charge'}
                extra={[
                  {
                    label: 'Copy price ID',
                    onSelect: () => void navigator.clipboard?.writeText(charge.id),
                  },
                ]}
                onEdit={() => onEdit(charge)}
                onRemove={() => onTerminate(charge)}
                removeLabel="Terminate"
              />
            ),
          },
        ]),
  ]

  return (
    <Section table showTitle title="Charges" action={add}>
      <DetailTable<Charge>
        compact
        label="Charges"
        noun="charges"
        rows={charges}

        facets={[
          { id: 'type', label: 'Type', value: typeLabel },
          { id: 'model', label: 'Model', value: modelLabel },
          { id: 'period', label: 'Billing period', value: periodLabel },
        ]}
        columns={columns}
      />
    </Section>
  )
}
