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
import { cn } from '@ui/lib/cn'
import { RowActionsMenu } from '../../shared/RowActionsMenu'
import { Section } from '@ui/compositions/layout/Section'
import { chargeLabel, pricingSummary } from './PlanPreviewCard'

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

/** Fixed and usage charges each get one quiet treatment: a tinted header band and a thin rail on their rows. */
const GROUPS = [
  {
    type: PriceType.Fixed,
    title: 'Fixed charges',
    note: 'Billed at the start of each period',
    icon: RepeatIcon,
    band: 'bg-muted/60',
    tile: 'bg-foreground/8 text-foreground/70',
    rail: 'border-l-foreground/40',
  },
  {
    type: PriceType.Usage,
    title: 'Usage charges',
    note: 'Billed at the end of the period the usage happened in',
    icon: GaugeIcon,
    band: 'bg-muted/60',
    tile: 'bg-foreground/8 text-foreground/70',
    rail: 'border-l-muted-foreground/40',
  },
] as const

/** "Flat fee", "Volume tiered", "Slab tiered", "Package". */
function modelLabel(charge: Charge): string {
  if (charge.billingModel === BillingModel.Tiered) {
    return charge.tierMode === TierMode.Slab ? 'Slab tiered' : 'Volume tiered'
  }
  return BILLING_MODEL_LABEL[charge.billingModel]
}

/** "Monthly, in advance" / "Monthly, in arrears". */
function cadenceLabel(charge: Charge): string {
  const period = BILLING_PERIOD_LABEL[charge.billingPeriod as BillingPeriod] ?? charge.billingPeriod
  return `${period}, ${charge.invoiceCadence === InvoiceCadence.Advance ? 'in advance' : 'in arrears'}`
}

/** A plan's charges, grouped by when they bill. */
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
  const meterName = (id: string) => charges.find((c) => c.meterId === id)?.meterName ?? id

  return (
    <Section
      title="Charges"
      flush
      action={
        readOnly || loading || error || charges.length === 0 ? undefined : (
          <Button type="button" size="sm" className="h-8 px-3" onClick={onAdd}>
            <PlusIcon aria-hidden />
            Add charge
          </Button>
        )
      }
    >
      {loading ? (
        <div className="p-6">
          <LoadingRows rows={3} columns={4} />
        </div>
      ) : error ? (
        <div className="p-6">
          <ErrorState
            title="Charges could not be loaded"
            description="The plan's prices did not load, so nothing is shown rather than a wrong list."
            {...(onRetry ? { onRetry } : {})}
          />
        </div>
      ) : charges.length === 0 ? (
        <SectionEmpty
          title="No charges yet"
          description="Nothing is billed yet. Add a fixed fee, a usage charge, or both."
          action={
            readOnly ? null : (
              <Button type="button" size="sm" className="h-8 px-3" onClick={onAdd}>
                <PlusIcon aria-hidden />
                Add the first charge
              </Button>
            )
          }
        />
      ) : (
        GROUPS.map((group) => {
          const rows = charges.filter((c) => c.type === group.type)
          if (rows.length === 0) return null
          const Icon = group.icon
          return (
            <div key={group.type} role="group" aria-label={group.title}>
              <div
                className={cn(
                  'flex items-center gap-3 border-y px-6 py-2.5 first:border-t-0',
                  group.band,
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-6 items-center justify-center rounded-md [&_svg]:size-3.5',
                    group.tile,
                  )}
                >
                  <Icon />
                </span>
                <span className="text-[13px] font-medium">{group.title}</span>
                <span className="text-muted-foreground text-xs tabular-nums">{rows.length}</span>
                <span className="text-muted-foreground ml-auto hidden text-xs sm:block">
                  {group.note}
                </span>
              </div>
              <ul className="divide-border/50 divide-y">
                {rows.map((charge) => {
                  const draft = chargeToDraft(charge)
                  const currency = (charge.currency || 'usd').toUpperCase()
                  return (
                    <li
                      key={charge.id}
                      className={cn(
                        'grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.5fr)_32px] items-center gap-4 border-l-2 py-4 pr-6 pl-[22px]',
                        group.rail,
                      )}
                    >
                      <p className="truncate text-sm font-medium">
                        {chargeLabel(draft, meterName)}
                      </p>
                      <span className="text-muted-foreground truncate text-[13px]">
                        {modelLabel(charge)}
                      </span>
                      <span className="text-muted-foreground truncate text-[13px]">
                        {cadenceLabel(charge)}
                      </span>
                      <span className="truncate text-[13px] tabular-nums">
                        {charge.displayAmount && charge.billingModel === BillingModel.FlatFee
                          ? charge.displayAmount
                          : pricingSummary(
                              draft,
                              currency,
                              undefined,
                              charge.meterId ? meterUnit?.(charge.meterId) : undefined,
                            )}
                      </span>
                      {readOnly ? (
                        <span />
                      ) : (
                        <RowActionsMenu
                          label={charge.displayName || charge.meterName || 'charge'}
                          onEdit={() => onEdit(charge)}
                          onRemove={() => onTerminate(charge)}
                          removeLabel="Terminate"
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })
      )}
    </Section>
  )
}
